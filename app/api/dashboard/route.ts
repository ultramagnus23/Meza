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

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Today's orders
    const { data: todayOrders } = await supabase
      .from('pos_orders')
      .select('total_amount')
      .eq('restaurant_id', restaurantId)
      .gte('timestamp', today.toISOString())
      .eq('status', 'COMPLETED')

    // Current occupancy (latest snapshot)
    const { data: latestOccupancy } = await supabase
      .from('occupancy_snapshots')
      .select('occupancy_percentage, people_count, queue_length')
      .eq('restaurant_id', restaurantId)
      .order('timestamp', { ascending: false })
      .limit(1)

    // Average dwell time (last 7 days)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)

    const { data: sessions } = await supabase
      .from('table_sessions')
      .select('dwell_time')
      .eq('restaurant_id', restaurantId)
      .gte('start_time', weekStart.toISOString())
      .not('dwell_time', 'is', null)

    // Active experiments
    const { count: activeExperiments } = await supabase
      .from('experiments')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'active')

    // Pending recommendations
    const { count: pendingRecs } = await supabase
      .from('recommendations')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('implemented', false)

    const todayRevenue = todayOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0
    const todayOrdersCount = todayOrders?.length || 0

    return NextResponse.json({
      success: true,
      data: {
        current_occupancy: latestOccupancy?.[0]?.occupancy_percentage || 0,
        today_revenue: todayRevenue,
        today_orders: todayOrdersCount,
        avg_order_value: todayOrdersCount > 0 ? todayRevenue / todayOrdersCount : 0,
        avg_dwell_time: sessions?.length
          ? Math.round(sessions.reduce((sum, s) => sum + (s.dwell_time || 0), 0) / sessions.length)
          : 0,
        avg_queue_length: latestOccupancy?.[0]?.queue_length || 0,
        active_experiments: activeExperiments || 0,
        pending_recommendations: pendingRecs || 0,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
