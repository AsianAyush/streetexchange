import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Admin email and password are required.' },
        { status: 400 }
      )
    }

    const envEmail = (process.env.ADMIN_EMAIL || 'admin@streetexchange.com').trim().toLowerCase()
    const envPassword = (process.env.ADMIN_PASSWORD || 'StreetExchangeAdmin2025!').trim()

    const inputEmail = String(email).trim().toLowerCase()
    const inputPassword = String(password).trim()

    // Accept configured email or alias like admin@streetexchange.in if configured as admin@streetexchange.com
    const isEmailMatch =
      inputEmail === envEmail ||
      (envEmail === 'admin@streetexchange.com' && inputEmail === 'admin@streetexchange.in')

    const isPasswordMatch = inputPassword === envPassword

    if (!isEmailMatch || !isPasswordMatch) {
      return NextResponse.json(
        { error: 'Invalid admin credentials. Please check password in .env.local.' },
        { status: 401 }
      )
    }

    // Target email in Supabase auth
    const targetEmail = envEmail

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    // Use the SERVICE ROLE key (not anon key) for the admin RPC — the anon key
    // does not have the required permissions to execute sync_admin_password.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
      return NextResponse.json(
        { error: 'Server configuration error. Contact the administrator.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Sync admin password in Supabase auth to match .env.local
    const { error: rpcError } = await (supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: unknown }>
    }).rpc('sync_admin_password', {
      p_email: targetEmail,
      p_password: envPassword,
    })

    if (rpcError) {
      console.error('Error syncing admin credentials with database:', rpcError)
      return NextResponse.json(
        { error: 'Database error syncing admin credentials.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email: targetEmail,
    })
  } catch (err) {
    console.error('Admin login API error:', err)
    return NextResponse.json(
      { error: 'Internal server error during admin login.' },
      { status: 500 }
    )
  }
}
