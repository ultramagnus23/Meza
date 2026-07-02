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

    const { data: cameras, error } = await supabase
      .from('cameras')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data: cameras })
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
    const { restaurant_id, name, rtsp_url, snapshot_interval_seconds, fps, table_regions, queue_region } = body

    if (!restaurant_id || !name || !rtsp_url) {
      return NextResponse.json(
        { error: 'restaurant_id, name and rtsp_url are required' },
        { status: 400 }
      )
    }

    const { data: camera, error } = await supabase
      .from('cameras')
      .insert({
        restaurant_id,
        name,
        rtsp_url,
        snapshot_interval_seconds: snapshot_interval_seconds || 300,
        fps: fps || 1,
        table_regions: table_regions || [],
        queue_region: queue_region || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: camera })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
