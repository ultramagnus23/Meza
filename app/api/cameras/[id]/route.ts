import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

async function getRestaurantId(supabase: SupabaseClient, ownerId: string) {
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', ownerId)
    .single()
  return data?.id
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: camera, error } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', params.id)
      .eq('restaurant_id', (await getRestaurantId(supabase, user.id)))
      .single()

    if (error) throw error
    if (!camera) {
      return NextResponse.json({ error: 'Camera not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: camera })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const { data: camera, error } = await supabase
      .from('cameras')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('restaurant_id', (await getRestaurantId(supabase, user.id)))
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: camera })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('cameras')
      .delete()
      .eq('id', params.id)
      .eq('restaurant_id', (await getRestaurantId(supabase, user.id)))

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
