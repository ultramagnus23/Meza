import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

const VALID_SOURCES = ['manual', 'sensor', 'weather_api'] as const

const NUMERIC_FIELDS = [
  'temperature', 'humidity', 'music_volume', 'lighting_brightness', 'lighting_temperature',
  'co2_ppm', 'pm25_ugm3', 'outdoor_aqi', 'lux', 'sound_level_db',
] as const

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

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data: snapshots, error } = await supabase
      .from('environment_snapshots')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })

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
    const { restaurant_id, ...data } = body

    if (!restaurant_id) {
      return NextResponse.json({ error: 'restaurant_id required' }, { status: 400 })
    }

    if (data.source !== undefined && !VALID_SOURCES.includes(data.source)) {
      return NextResponse.json(
        { error: `source must be one of: ${VALID_SOURCES.join(', ')}` },
        { status: 400 }
      )
    }

    for (const field of NUMERIC_FIELDS) {
      if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'number') {
        return NextResponse.json({ error: `${field} must be a number` }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from('environment_snapshots')
      .insert({ ...data, restaurant_id })

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
