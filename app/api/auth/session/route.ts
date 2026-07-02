import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const supabase = getServerSupabase(req)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error

    return NextResponse.json({
      success: true,
      data: { user: user ?? null },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
