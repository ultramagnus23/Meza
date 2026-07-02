import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase(req)
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: {
        user: data.user,
        session: data.session,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
