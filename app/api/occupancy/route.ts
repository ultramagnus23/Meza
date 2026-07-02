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
    const days = parseInt(searchParams.get('days') || '7')
    const hour = searchParams.get('hour')

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('occupancy_snapshots')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })

    if (hour !== null && hour !== undefined) {
      const today = new Date().toISOString().split('T')[0]
      const hourStart = `${today}T${hour.toString().padStart(2, '0')}:00:00`
      const hourEnd = `${today}T${(parseInt(hour) + 1).toString().padStart(2, '0')}:00:00`
      query = query.gte('timestamp', hourStart).lt('timestamp', hourEnd)
    }

    const { data: snapshots, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data: snapshots })
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

    const body = await req.json()
    const { restaurant_id, snapshots } = body

    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    }

    // Handle single snapshot or batch
    let insertData: any[]
    if (Array.isArray(snapshots)) {
      insertData = snapshots.map((s: any) => ({ ...s, restaurant_id }))
    } else {
      insertData = [{ ...body, restaurant_id }]
    }

    const { error } = await supabase
      .from('occupancy_snapshots')
      .insert(insertData)

    if (error) throw error

    return NextResponse.json({ success: true, count: insertData.length })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
