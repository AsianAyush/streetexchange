/**
 * Admin Settings API Route
 * GET  /api/admin/settings  — read allow_manual_payment from system_settings
 * POST /api/admin/settings  — update allow_manual_payment in system_settings
 *
 * Both methods resolve the caller's admin privileges.
 * Supports both Bearer token (from client localStorage) and SSR cookies.
 * Writes use the service-role key to bypass RLS.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

// Service-role client — bypasses RLS for writes and profile checks
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Verify incoming request is from an authenticated ADMIN user.
 * Checks both Authorization: Bearer <token> header and SSR session cookies.
 * Validates admin status via public.profiles (is_admin, role) or user metadata.
 */
async function verifyAdmin(req: NextRequest): Promise<{ adminId: string; email?: string } | NextResponse> {
  const serviceClient = createServiceClient()
  let user: { id: string; email?: string; user_metadata?: Record<string, any>; app_metadata?: Record<string, any> } | null = null
  let authSource = 'none'

  // 1. Check Authorization: Bearer <token> header (sent from browser localStorage clients)
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim()
    if (token) {
      const { data: tokenUserData, error: tokenErr } = await serviceClient.auth.getUser(token)
      if (!tokenErr && tokenUserData?.user) {
        user = tokenUserData.user
        authSource = 'Bearer header'
      } else if (tokenErr) {
        console.warn('[admin/settings] Bearer token validation warning:', tokenErr.message)
      }
    }
  }

  // 2. Fall back to Next.js cookie session
  if (!user) {
    try {
      const serverSupabase = await createServerClient()
      const { data: cookieUserData, error: cookieErr } = await serverSupabase.auth.getUser()
      if (!cookieErr && cookieUserData?.user) {
        user = cookieUserData.user
        authSource = 'Cookie session'
      } else if (cookieErr) {
        console.warn('[admin/settings] Cookie session validation warning:', cookieErr.message)
      }
    } catch (err: any) {
      console.warn('[admin/settings] Cookie reading error:', err?.message)
    }
  }

  // If no authenticated user found
  if (!user) {
    console.error('[admin/settings] 401 Unauthorized: No valid session from Bearer token or cookies')
    return NextResponse.json(
      { error: 'Unauthorised: Please log in as an administrator.' },
      { status: 401 }
    )
  }

  // 3. Resolve admin status from public.profiles using serviceClient (bypasses RLS)
  const { data: profile, error: profileErr } = await serviceClient
    .from('profiles')
    .select('id, role, is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error(`[admin/settings] Database error querying profile for user ${user.id}:`, profileErr.message)
  }

  const roleStr = (
    profile?.role ||
    user.user_metadata?.role ||
    user.app_metadata?.role ||
    ''
  ).toString().toLowerCase()

  const isAdminFlag =
    profile?.is_admin === true ||
    user.user_metadata?.is_admin === true ||
    user.app_metadata?.is_admin === true

  const isAdmin = isAdminFlag || roleStr === 'admin'

  console.log(
    `[admin/settings] Auth check: user=${user.email || user.id} via ${authSource} | role=${roleStr || 'none'} | is_admin=${isAdminFlag} | verifiedAdmin=${isAdmin}`
  )

  if (!isAdmin) {
    console.warn(`[admin/settings] 403 Forbidden: User ${user.email || user.id} lacks admin privileges.`)
    return NextResponse.json(
      { error: 'Forbidden: Administrator privileges required.' },
      { status: 403 }
    )
  }

  return { adminId: user.id, email: user.email }
}

// ---------------------------------------------------------------------------
// GET — Read allow_manual_payment
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const serviceClient = createServiceClient()

  // Verify caller's admin privileges with graceful fallback
  const auth = await verifyAdmin(req)
  const isAdmin = !(auth instanceof NextResponse)

  if (!isAdmin) {
    console.warn('[admin/settings GET] Caller is not authenticated admin; falling back to public setting read')
  }

  try {
    const { data, error } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'allow_manual_payment')
      .maybeSingle()

    if (error) {
      console.warn('[admin/settings GET] system_settings query warning (table may need migration):', error.message)
      // Default to true (manual enabled) gracefully if table does not exist
      return NextResponse.json({
        allow_manual_payment: true,
        is_admin: isAdmin,
        notice: 'Using default configuration'
      })
    }

    // value is stored as JSONB boolean (true / false)
    const allowManualPayment = data?.value === true || data?.value === 'true' || data === null

    console.log(`[admin/settings GET] allow_manual_payment = ${allowManualPayment} (isAdmin: ${isAdmin})`)

    return NextResponse.json({
      allow_manual_payment: allowManualPayment,
      is_admin: isAdmin,
    })
  } catch (err: any) {
    console.error('[admin/settings GET] Unexpected error:', err?.message)
    return NextResponse.json({ allow_manual_payment: true, is_admin: isAdmin })
  }
}

// ---------------------------------------------------------------------------
// POST — Update allow_manual_payment
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Strict admin authorization for mutating system settings
  const auth = await verifyAdmin(req)
  if (auth instanceof NextResponse) return auth

  let body: { allow_manual_payment: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.allow_manual_payment !== 'boolean') {
    return NextResponse.json(
      { error: '`allow_manual_payment` must be a boolean' },
      { status: 400 },
    )
  }

  // Use service-role client to bypass RLS on writes
  const serviceClient = createServiceClient()

  console.log(`[admin/settings POST] Admin ${auth.email || auth.adminId} updating allow_manual_payment to ${body.allow_manual_payment}`)

  const { error } = await serviceClient
    .from('system_settings')
    .upsert(
      {
        key: 'allow_manual_payment',
        value: body.allow_manual_payment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )

  if (error) {
    console.error('[admin/settings POST] Database error on upsert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[admin/settings POST] Successfully updated allow_manual_payment to ${body.allow_manual_payment}`)

  return NextResponse.json({
    success: true,
    allow_manual_payment: body.allow_manual_payment,
  })
}
