import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

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
    const endpoint = searchParams.get('endpoint')

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Revenue by day
    if (endpoint === 'by-day') {
      const { data: orders, error } = await supabase
        .from('pos_orders')
        .select('timestamp, total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', startDate.toISOString())
        .eq('status', 'COMPLETED')
        .order('timestamp', { ascending: true })

      if (error) throw error

      const revenueByDay = new Map<string, number>()
      for (const order of orders ?? []) {
        const day = order.timestamp.split('T')[0]
        revenueByDay.set(day, (revenueByDay.get(day) || 0) + order.total_amount)
      }

      const data = Array.from(revenueByDay.entries())
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return NextResponse.json({ success: true, data })
    }

    // Revenue summary
    if (endpoint === 'summary') {
      const { data: ordersRaw, error } = await supabase
        .from('pos_orders')
        .select('total_amount, guest_count, table_number, channel')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', startDate.toISOString())
        .eq('status', 'COMPLETED')

      if (error) throw error
      const orders = ordersRaw ?? []

      const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0)
      const totalOrders = orders.length
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const totalGuests = orders.reduce((sum, o) => sum + (o.guest_count || 1), 0)

      const channelBreakdown = new Map<string, { orders: number; revenue: number }>()
      for (const order of orders) {
        const channel = order.channel || 'DIRECT'
        const existing = channelBreakdown.get(channel) || { orders: 0, revenue: 0 }
        existing.orders += 1
        existing.revenue += order.total_amount
        channelBreakdown.set(channel, existing)
      }

      return NextResponse.json({
        success: true,
        data: {
          totalRevenue,
          totalOrders,
          avgOrderValue,
          totalGuests,
          avgGuestsPerOrder: totalOrders > 0 ? totalGuests / totalOrders : 0,
          channelBreakdown: Array.from(channelBreakdown.entries()).map(
            ([channel, stats]) => ({
              channel,
              ...stats,
              avgOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
            })
          ),
        },
      })
    }

    // Revenue by hour
    if (endpoint === 'by-hour') {
      const { data: orders, error } = await supabase
        .from('pos_orders')
        .select('timestamp, total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('timestamp', startDate.toISOString())
        .eq('status', 'COMPLETED')

      if (error) throw error

      const hourlyData = new Map<number, { orders: number; revenue: number }>()
      for (let h = 0; h < 24; h++) {
        hourlyData.set(h, { orders: 0, revenue: 0 })
      }

      for (const order of orders ?? []) {
        const hour = new Date(order.timestamp).getHours()
        const existing = hourlyData.get(hour)!
        existing.orders += 1
        existing.revenue += order.total_amount
      }

      const data = Array.from(hourlyData.entries()).map(([hour, stats]) => ({
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        orders: stats.orders,
        revenue: stats.revenue,
        avgOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
      }))

      return NextResponse.json({ success: true, data })
    }

    // Default: revenue by day
    const { data: orders, error } = await supabase
      .from('pos_orders')
      .select('timestamp, total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('timestamp', startDate.toISOString())
      .eq('status', 'COMPLETED')
      .order('timestamp', { ascending: true })

    if (error) throw error

    const revenueByDay = new Map<string, number>()
    for (const order of orders ?? []) {
      const day = order.timestamp.split('T')[0]
      revenueByDay.set(day, (revenueByDay.get(day) || 0) + order.total_amount)
    }

    const data = Array.from(revenueByDay.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
