/**
 * WatchPays Order Creation API
 * POST /api/payment/watchpays/create
 *
 * Initiates a WatchPays payment session for an existing order.
 * 1. Validates the request (auth via Bearer header or cookies + order ownership)
 * 2. Generates a unique merchant_order_no
 * 3. Fetches WatchPays credentials from Supabase system_settings
 * 4. Calls WatchPays to create the payment session
 * 5. Persists merchant_order_no, gateway_order_no, payment_url, payment_gateway on the order
 * 6. Returns { success: true, payment_url } for the client to redirect
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { createWatchPaysOrder } from '@/lib/watchpays'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// POST /api/payment/watchpays/create
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const serviceClient = createServiceClient()
  let user: { id: string; email?: string } | null = null
  let authSource = 'none'

  // 1. Auth check — resolve via Authorization: Bearer <token> or SSR cookies
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim()
    if (token) {
      const { data: tokenUserData, error: tokenErr } = await serviceClient.auth.getUser(token)
      if (!tokenErr && tokenUserData?.user) {
        user = tokenUserData.user
        authSource = 'Bearer header'
      } else if (tokenErr) {
        console.warn('[watchpays/create] Bearer token validation warning:', tokenErr.message)
      }
    }
  }

  if (!user) {
    try {
      const serverSupabase = await createServerClient()
      const { data: cookieUserData, error: cookieErr } = await serverSupabase.auth.getUser()
      if (!cookieErr && cookieUserData?.user) {
        user = cookieUserData.user
        authSource = 'Cookie session'
      } else if (cookieErr) {
        console.warn('[watchpays/create] Cookie session validation warning:', cookieErr.message)
      }
    } catch (err: any) {
      console.warn('[watchpays/create] Cookie reading error:', err?.message)
    }
  }

  console.log(`[watchpays/create] Auth check: user=${user?.email || user?.id || 'none'} via ${authSource}`)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised: Please sign in.' }, { status: 401 })
  }

  // 2. Parse body
  let body: { orderId: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { orderId } = body
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: '`orderId` is required' }, { status: 400 })
  }

  console.log(`[watchpays/create] Processing order ${orderId} for user ${user.id}`)

  // 3. Fetch order — verify it exists and belongs to the authenticated user
  let order: any = null
  let orderErr: any = null

  try {
    const res = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    order = res.data
    orderErr = res.error
  } catch (err: any) {
    orderErr = err
  }

  // Fallback: if select('*') or single() errored, retry with safe explicit columns
  if (orderErr && !order) {
    console.warn('[watchpays/create] Retrying order fetch with safe column select:', orderErr?.message || orderErr)
    try {
      const fallbackRes = await serviceClient
        .from('orders')
        .select('id, inr_amount, user_id, status, merchant_order_no, payment_url, gateway_order_no, payment_gateway')
        .eq('id', orderId)
        .maybeSingle()
      if (fallbackRes.data && !fallbackRes.error) {
        order = fallbackRes.data
        orderErr = null
      }
    } catch (fallbackErr: any) {
      console.error('[watchpays/create] Fallback query error:', fallbackErr)
    }
  }

  if (orderErr || !order) {
    console.error(`[watchpays/create] Order fetch error for ${orderId}:`, orderErr?.message || orderErr)
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  if (order.user_id !== user.id) {
    console.warn(`[watchpays/create] User ${user.id} attempted to pay for order belonging to ${order.user_id}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Order is already ${order.status}. Cannot initiate payment.` },
      { status: 409 },
    )
  }

  // 4. If a payment_url already exists for this order and status is strictly PENDING, return it immediately
  //    (idempotency — avoids creating duplicate WatchPays sessions on re-clicks)
  if (order.payment_url && order.status === 'PENDING') {
    console.log(`[watchpays/create] Reusing existing payment_url for order ${orderId}: ${order.payment_url}`)
    return NextResponse.json({
      success: true,
      payment_url: order.payment_url,
      gateway_order_no: (order as any).gateway_order_no ?? null,
      gateway: 'WATCHPAYS',
      cached: true,
    })
  }

  // 5. Load WatchPays API credentials (API Key, Merchant ID) from process.env
  let merchantId = process.env.WATCHPAYS_MERCHANT_ID
  let apiKey = process.env.WATCHPAYS_API_KEY

  // Fallback to system_settings if process.env values are not set
  if (!merchantId || !apiKey) {
    try {
      const { data: settingsRows } = await serviceClient
        .from('system_settings')
        .select('key, value')
        .in('key', ['watchpays_merchant_id', 'watchpays_api_key'])

      const settingsMap: Record<string, string> = {}
      settingsRows?.forEach((row) => {
        let val = typeof row.value === 'string' ? row.value : String(row.value)
        if (val.startsWith('"') && val.endsWith('"')) {
          try {
            val = JSON.parse(val)
          } catch {
            val = val.slice(1, -1)
          }
        }
        settingsMap[row.key] = val
      })

      merchantId = merchantId || settingsMap['watchpays_merchant_id']
      apiKey = apiKey || settingsMap['watchpays_api_key']
    } catch (err: any) {
      console.warn('[watchpays/create] Failed to fetch system_settings fallback:', err?.message)
    }
  }

  if (!merchantId || !apiKey) {
    console.error('[watchpays/create] Missing WatchPays credentials in process.env')
    return NextResponse.json(
      { success: false, message: 'Payment gateway is not configured. Missing credentials.' },
      { status: 500 },
    )
  }

  // 6. Deterministic merchant_order_no — reuse if already assigned to this order
  let merchantOrderNo = order.merchant_order_no
  if (!merchantOrderNo) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8).toUpperCase()
    merchantOrderNo = `WP_${timestamp}_${random}`

    const supabase = serviceClient
    // Save merchant_order_no beforehand so callback webhook can locate order
    await supabase.from('orders').update({
      merchant_order_no: merchantOrderNo,
    }).eq('id', orderId)
  }

  // WatchPays callback URL — use the deployed domain
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://streetexchange.vercel.app'
  const callbackUrl = `${baseUrl}/api/payment/watchpays/callback`

  console.log(`[watchpays/create] Calling WatchPays for amount ₹${order.inr_amount} (merchantOrderNo: ${merchantOrderNo})`)

  // 7. Call WatchPays gateway
  const watchPaysData = await createWatchPaysOrder({
    amount: Number(order.inr_amount),
    merchantOrderNo,
    merchantId,
    apiKey,
    callbackUrl,
  })

  console.log('[watchpays/create] WatchPays response:', {
    success: watchPaysData.success,
    hasUrl: !!watchPaysData.payment_url,
    orderNo: watchPaysData.order_no,
    message: watchPaysData.message,
  })

  // Helper to verify URL format
  const isValidUrl = (url?: string): boolean => {
    if (!url || typeof url !== 'string' || !url.trim()) return false
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return url.startsWith('http://') || url.startsWith('https://')
    }
  }

  // 2. Verify that the WatchPays endpoint generates a valid payment_url and gateway_order_no
  if (!watchPaysData.success || !watchPaysData.payment_url || !isValidUrl(watchPaysData.payment_url)) {
    console.error('[watchpays/create] Gateway failure or invalid payment_url:', watchPaysData.message)
    return NextResponse.json(
      {
        success: false,
        message: watchPaysData.message || 'WatchPays gateway unreachable. Please try BondPay.',
        error: watchPaysData.message || 'WatchPays gateway unreachable. Please try BondPay.',
      },
      { status: 400 },
    )
  }

  // Ensure gateway_order_no is verified
  if (!watchPaysData.order_no) {
    console.warn('[watchpays/create] Missing gateway order_no, falling back to merchantOrderNo')
    watchPaysData.order_no = merchantOrderNo
  }

  // 3. Save payment_url and gateway_order_no to Supabase immediately upon receiving response:
  const { error: updateErr } = await serviceClient.from('orders').update({
    payment_url: watchPaysData.payment_url,
    gateway_order_no: watchPaysData.order_no,
    payment_gateway: 'WATCHPAYS'
  }).eq('id', orderId);

  if (updateErr) {
    console.warn('[watchpays/create] Primary update failed, retrying without payment_gateway:', updateErr.message)
    const { error: fallbackErr } = await (serviceClient.from('orders') as any).update({
      payment_url: watchPaysData.payment_url,
      gateway_order_no: watchPaysData.order_no,
    }).eq('id', orderId)
    if (fallbackErr) {
      console.error('[watchpays/create] Failed to persist gateway fields:', fallbackErr.message)
    }
  } else {
    console.log(`[watchpays/create] Successfully saved gateway details to order ${orderId}`)
  }

  // 4. Return { success: true, payment_url: watchPaysData.payment_url }
  return NextResponse.json({
    success: true,
    payment_url: watchPaysData.payment_url,
  })
}
