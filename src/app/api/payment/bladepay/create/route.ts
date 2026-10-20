/**
 * BladePay Create Payin API Route
 * POST /api/payment/bladepay/create
 *
 * Implements the official BladePay API documentation specs:
 * 1. Checks Supabase orders table for existing payment_url and gateway_order_no when status is 'PENDING'.
 *    If found, returns the cached payment_url immediately (idempotency).
 * 2. If no URL exists, makes HTTP POST request to:
 *    https://api.bladepay.pro/merchant/api/payin/create
 *    Headers:
 *      Authorization: Bearer <BLADEPAY_API_KEY>
 *      Content-Type: application/json
 *    Payload:
 *      {
 *        "merchantOrderNo": order.id,
 *        "amount": Number(order.amount).toFixed(2),
 *        "currency": "INR",
 *        "payinName": user.name || "Customer",
 *        "payinPhone": user.phone || "9876543210",
 *        "payinEmail": user.email || "customer@streetexchange.vercel.app",
 *        "notifyUrl": "https://streetexchange.vercel.app/api/payment/bladepay/callback",
 *        "returnUrl": `https://streetexchange.vercel.app/order/${order.id}`
 *      }
 * 3. Extracts cashierUrl (response.data.data.cashierUrl) and gatewayOrderNo (response.data.data.gatewayOrderNo).
 * 4. Saves payment_url and gateway_order_no to Supabase orders table immediately,
 *    then returns { success: true, payment_url: cashierUrl }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

const BLADEPAY_CREATE_ENDPOINT =
  process.env.BLADEPAY_API_URL ||
  (process.env.BLADEPAY_BASE_URL ? `${process.env.BLADEPAY_BASE_URL.replace(/\/+$/, '')}/merchant/api/payin/create` : null) ||
  'https://api.bladepay.pro/merchant/api/payin/create'

const DEFAULT_API_KEY =
  process.env.BLADEPAY_API_KEY ||
  process.env.BLADEPAY_API_TOKEN ||
  'gw_45e7feef35887c0fd6195f50dee597dfd872b31c19704205c7549afe3ce0a83e'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const serviceClient = createServiceClient()
  let user: { id: string; email?: string } | null = null
  let authSource = 'none'

  // 1. Authenticate user via Authorization: Bearer <token> or SSR cookies
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim()
    if (token) {
      const { data: tokenUserData, error: tokenErr } = await serviceClient.auth.getUser(token)
      if (!tokenErr && tokenUserData?.user) {
        user = tokenUserData.user
        authSource = 'Bearer header'
      } else if (tokenErr) {
        console.warn('[bladepay/create] Bearer token validation warning:', tokenErr.message)
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
        console.warn('[bladepay/create] Cookie session validation warning:', cookieErr.message)
      }
    } catch (err: any) {
      console.warn('[bladepay/create] Cookie reading error:', err?.message)
    }
  }

  console.log(`[bladepay/create] Auth check: user=${user?.email || user?.id || 'none'} via ${authSource}`)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised: Please sign in.' }, { status: 401 })
  }

  // 2. Parse request body
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

  console.log(`[bladepay/create] Processing order ${orderId} for user ${user.id}`)

  // 3. Fetch order from Supabase
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

  if (orderErr && !order) {
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
      console.error('[bladepay/create] Fallback query error:', fallbackErr)
    }
  }

  if (orderErr || !order) {
    console.error(`[bladepay/create] Order fetch error for ${orderId}:`, orderErr?.message || orderErr)
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  // Verify ownership
  if (order.user_id !== user.id) {
    console.warn(`[bladepay/create] User ${user.id} attempted to pay for order belonging to ${order.user_id}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Order is already ${order.status}. Cannot initiate payment.` },
      { status: 409 },
    )
  }

  // 4. Idempotency Check:
  // Check Supabase orders table for an existing payment_url and gateway_order_no when status is 'PENDING'.
  // If found, return cached payment_url immediately.
  if (order.payment_url && order.status === 'PENDING') {
    console.log(`[bladepay/create] Idempotency hit: Reusing cached payment_url for order ${orderId}: ${order.payment_url}`)
    return NextResponse.json({
      success: true,
      payment_url: order.payment_url,
      gateway_order_no: order.gateway_order_no ?? null,
      cached: true,
    })
  }

  // 5. Fetch user profile for enriched payer details
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('username, phone, email')
    .eq('id', user.id)
    .maybeSingle()

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://streetexchange.vercel.app'

  const notifyUrl = 'https://streetexchange.vercel.app/api/payment/bladepay/callback'
  const returnUrl = `https://streetexchange.vercel.app/order/${order.id}`

  const orderAmount = Number(order.inr_amount ?? (order as any).amount ?? 0).toFixed(2)

  // 6. Build official BladePay payload specification
  const payload = {
    merchantOrderNo: order.id,
    amount: orderAmount,
    currency: 'INR',
    payinName: profile?.username || (user as any)?.user_metadata?.name || 'Customer',
    payinPhone: profile?.phone || '9876543210',
    payinEmail: user.email || profile?.email || 'customer@streetexchange.vercel.app',
    notifyUrl,
    returnUrl,
  }

  console.log('[bladepay/create] Sending POST request to BladePay:', {
    endpoint: BLADEPAY_CREATE_ENDPOINT,
    payload,
  })

  try {
    const response = await fetch(BLADEPAY_CREATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${DEFAULT_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })

    const rawText = await response.text()
    console.log(`[bladepay/create] BladePay HTTP ${response.status}:`, rawText)

    let resJson: any = {}
    try {
      resJson = JSON.parse(rawText)
    } catch {
      console.error('[bladepay/create] Non-JSON response received from BladePay:', rawText)
      return NextResponse.json(
        { success: false, error: 'BladePay gateway returned an invalid response. Please try again.' },
        { status: 502 },
      )
    }

    if (!response.ok) {
      const errMsg = resJson?.msg || resJson?.message || `BladePay HTTP ${response.status}`
      console.error('[bladepay/create] BladePay returned HTTP error:', errMsg, resJson)
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: response.status >= 400 && response.status < 500 ? response.status : 400 },
      )
    }

    // 7. Extract cashierUrl and gatewayOrderNo from response
    // Official spec: response.data.data.cashierUrl and response.data.data.gatewayOrderNo
    const dataObj = resJson?.data?.data || resJson?.data || resJson
    const cashierUrl = dataObj?.cashierUrl || dataObj?.paymentUrl || dataObj?.payment_url
    const gatewayOrderNo = dataObj?.gatewayOrderNo || dataObj?.gateway_order_no || dataObj?.orderNo

    if (!cashierUrl || typeof cashierUrl !== 'string' || !cashierUrl.trim()) {
      console.error('[bladepay/create] Missing cashierUrl in BladePay response:', resJson)
      return NextResponse.json(
        { success: false, error: resJson?.msg || 'BladePay did not return a valid cashier URL.' },
        { status: 400 },
      )
    }

    const finalGatewayOrderNo = gatewayOrderNo ? String(gatewayOrderNo) : order.id

    // 8. Save payment_url and gateway_order_no to Supabase orders table immediately
    const { error: updateErr } = await serviceClient
      .from('orders')
      .update({
        payment_url: cashierUrl.trim(),
        gateway_order_no: finalGatewayOrderNo,
        merchant_order_no: order.id,
        payment_gateway: 'BLADEPAY',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) {
      console.warn('[bladepay/create] Primary update failed, retrying without payment_gateway:', updateErr.message)
      await (serviceClient.from('orders') as any).update({
        payment_url: cashierUrl.trim(),
        gateway_order_no: finalGatewayOrderNo,
        merchant_order_no: order.id,
      }).eq('id', orderId)
    }

    console.log(`[bladepay/create] Successfully saved cashierUrl and gatewayOrderNo to order ${orderId}`)

    // 9. Return { success: true, payment_url: cashierUrl }
    return NextResponse.json({
      success: true,
      payment_url: cashierUrl.trim(),
      gateway_order_no: finalGatewayOrderNo,
    })
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    console.error('[bladepay/create] Request error:', err?.message || err)
    return NextResponse.json(
      {
        success: false,
        error: isTimeout
          ? 'BladePay gateway request timed out. Please try again.'
          : (err?.message || 'Failed to connect to BladePay gateway.'),
      },
      { status: 504 },
    )
  }
}
