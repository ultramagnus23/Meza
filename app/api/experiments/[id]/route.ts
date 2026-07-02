import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await req.json()

    const { data: experiment, error } = await supabase
      .from('experiments')
      .update(body)
      .eq('id', id)
      .eq('restaurant_id', (await getRestaurantId(supabase, user.id)))
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: experiment })
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

    const { id } = params

    const { error } = await supabase
      .from('experiments')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', (await getRestaurantId(supabase, user.id)))

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

async function getRestaurantId(supabase: SupabaseClient, ownerId: string) {
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', ownerId)
    .single()
  return data?.id
}
