import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase(req)
    const { error } = await supabase.auth.signOut()
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
