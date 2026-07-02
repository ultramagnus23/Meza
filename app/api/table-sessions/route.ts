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
    const tableNumber = searchParams.get('tableNumber')

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    let query = supabase
      .from('table_sessions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('start_time', startDate.toISOString())
      .order('start_time', { ascending: false })

    if (tableNumber) {
      query = query.eq('table_number', parseInt(tableNumber))
    }

    const { data: sessions, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: sessions })
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
    const { restaurant_id, ...data } = body

    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('table_sessions')
      .insert({ ...data, restaurant_id })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
