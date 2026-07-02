import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import Papa from 'papaparse'

export async function GET(req: Request) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const restaurantId = searchParams.get('restaurantId')
    const days = parseInt(searchParams.get('days') || '30')

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: orders, error } = await supabase
      .from('pos_orders')
      .select(`
        *,
        items: pos_order_items(*)
      `)
      .eq('restaurant_id', restaurantId)
      .gte('timestamp', startDate.toISOString())
      .eq('status', 'COMPLETED')
      .order('timestamp', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data: orders })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const restaurantId = formData.get('restaurantId') as string

    if (!file || !restaurantId) {
      return NextResponse.json(
        { error: 'File and restaurantId are required' },
        { status: 400 }
      )
    }

    const text = await file.text()
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (parsed.errors.length > 0 || parsed.data.length === 0) {
      return NextResponse.json(
        { error: 'Invalid CSV file' },
        { status: 400 }
      )
    }

    const ordersMap = new Map<string, any[]>()
    const menuItems = new Map<string, { name: string; category: string; price: number }>()

    for (const row of parsed.data as any[]) {
      const orderId = row.posOrderId || row.order_id || row.id
      if (!orderId) continue

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, [])
      }
      ordersMap.get(orderId)!.push(row)

      const itemName = row.menu_item || row.item || row.product
      if (itemName && !menuItems.has(itemName)) {
        menuItems.set(itemName, {
          name: itemName,
          category: row.category || 'Uncategorized',
          price: parseFloat(row.price) || 0,
        })
      }
    }

    const insertedOrders: any[] = []

    for (const [orderId, items] of ordersMap) {
      const firstRow = items[0]
      const totalAmount = items.reduce(
        (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0),
        0
      )

      const { data: order, error: orderError } = await supabase
        .from('pos_orders')
        .insert({
          restaurant_id: restaurantId,
          external_id: orderId,
          timestamp: new Date(firstRow.order_time || firstRow.order_date || firstRow.timestamp).toISOString(),
          total_amount: totalAmount,
          order_type: firstRow.order_type || 'DINE_IN',
          channel: firstRow.channel || 'DIRECT',
          payment_method: firstRow.payment_method,
          guest_count: parseInt(firstRow.guest_count) || null,
          table_number: parseInt(firstRow.table_number) || null,
          status: 'COMPLETED',
        })
        .select()
        .single()

      if (orderError) {
        if (orderError.code === '23505') continue
        throw orderError
      }

      for (const item of items) {
        const itemName = item.menu_item || item.item || item.product
        const quantity = parseInt(item.quantity) || 1
        const price = parseFloat(item.price) || 0
        const isDessert = item.is_dessert === 'true' || item.category?.toLowerCase().includes('dessert')
        const isDrink = item.is_drink === 'true' || item.category?.toLowerCase().includes('drink') || item.category?.toLowerCase().includes('beverage')

        await supabase.from('pos_order_items').insert({
          order_id: order.id,
          item_name: itemName,
          category: item.category || menuItems.get(itemName)?.category,
          quantity,
          price,
          total: quantity * price,
          is_dessert: isDessert,
          is_drink: isDrink,
        })
      }

      insertedOrders.push(order)
    }

    return NextResponse.json({
      success: true,
      count: insertedOrders.length,
      message: `Processed ${insertedOrders.length} orders`,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
