/**
 * Unified Payment Gateway Dispatcher
 * POST /api/payment/create
 *
 * This route abstracts the payment gateway selection from the frontend.
 * It reads the `active_gateway` setting from Supabase system_settings,
 * then proxies the payment creation request to either:
 *   - /api/payment/bondpay/create  (if active_gateway === 'BONDPAY')
 *   - /api/payment/watchpays/create (if active_gateway === 'WATCHPAYS')
 *
 * The client only needs to call POST /api/payment/create with { orderId }
 * and the correct gateway is selected automatically based on admin config.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { POST as bondPayHandler } from '@/app/api/payment/bondpay/create/route'
import { POST as watchPaysHandler } from '@/app/api/payment/watchpays/create/route'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type ActiveGateway = 'BONDPAY' | 'WATCHPAYS'

/**
 * Fetch the active gateway setting from Supabase.
 * Defaults to WATCHPAYS if not configured (never hardcode BONDPAY).
 */
async function getActiveGateway(): Promise<ActiveGateway> {
  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'active_gateway')
      .maybeSingle()

    if (error) {
      console.warn('[payment/create] Failed to fetch active_gateway setting:', error.message)
      return 'WATCHPAYS'
    }

    // value is stored as JSONB — could be "BONDPAY" or "WATCHPAYS" (with or without quotes)
    const rawValue = data?.value
    const gateway = (typeof rawValue === 'string' ? rawValue : String(rawValue || '')).toUpperCase().trim()

    if (gateway === 'BONDPAY') return 'BONDPAY'
    return 'WATCHPAYS' // Default fallback: WATCHPAYS
  } catch (err) {
    console.error('[payment/create] Error fetching active gateway:', err)
    return 'WATCHPAYS'
  }
}

// ---------------------------------------------------------------------------
// POST /api/payment/create — Unified dispatcher with Idempotency & Gateway Switch
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read the request body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const orderId = body?.orderId
  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: '`orderId` is required' }, { status: 400 })
  }

  // Optional: explicit gateway from client (dual-gateway selector)
  const requestedGateway: string | undefined =
    body?.paymentGateway
      ? String(body.paymentGateway).toUpperCase().trim()
      : undefined

  const serviceClient = createServiceClient()

  // 2. Safe order fetching with error handling and fallback logic
  let order: any = null
  let orderError: any = null

  try {
    const res = await serviceClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    order = res.data
    orderError = res.error
  } catch (err: any) {
    orderError = err
  }

  // Safe fallback: if select('*') or single() errored, retry with core safe column selection.
  // Ensures that if payment_gateway column is missing, null, or unselected,
  // order creation still proceeds without throwing a 404 error.
  if (orderError && !order) {
    console.warn('[payment/create] Retrying order fetch with safe column select:', orderError?.message || orderError)
    try {
      const fallbackRes = await serviceClient
        .from('orders')
        .select('id, user_id, status, inr_amount, payment_url, gateway_order_no, payment_gateway')
        .eq('id', orderId)
        .maybeSingle()
      if (fallbackRes.data && !fallbackRes.error) {
        order = fallbackRes.data
        orderError = null
      }
    } catch (fallbackErr: any) {
      console.error('[payment/create] Fallback query error:', fallbackErr)
    }
  }

  if (orderError || !order) {
    console.error('[payment/create] Order fetch error:', orderError)
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Strictly check order status
  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Order is already ${order.status}. Cannot initiate payment.` },
      { status: 409 },
    )
  }

  // 3. Gateway Selection Priority:
  //   a. First check: Payload `paymentGateway` (sent directly from frontend selection).
  //   b. Second check: `order.payment_gateway` from Supabase `orders` table.
  //   c. Third check: Global `active_gateway` from `system_settings` table.
  //   d. Fallback: Default to 'WATCHPAYS' (or active setting), NEVER hardcode 'BONDPAY'.
  const activeGatewaySetting = await getActiveGateway()

  let chosenGateway: ActiveGateway
  if (requestedGateway === 'WATCHPAYS' || requestedGateway === 'BONDPAY') {
    chosenGateway = requestedGateway as ActiveGateway
  } else if (order.payment_gateway === 'WATCHPAYS' || order.payment_gateway === 'BONDPAY') {
    chosenGateway = order.payment_gateway as ActiveGateway
  } else if (activeGatewaySetting === 'BONDPAY' || activeGatewaySetting === 'WATCHPAYS') {
    chosenGateway = activeGatewaySetting as ActiveGateway
  } else {
    chosenGateway = 'WATCHPAYS'
  }

  console.log(`[payment/create] Gateway chosen: ${chosenGateway} (requested: ${requestedGateway ?? 'none'}, order: ${order.payment_gateway}, setting: ${activeGatewaySetting})`)

  // 4. Idempotency Check & Gateway Switch Handling:
  // If order already has an active payment_url AND status is strictly 'PENDING':
  // If user explicitly switched gateways (e.g. from BONDPAY to WATCHPAYS):
  //   - Do NOT return the old cached payment_url.
  //   - Clear order.payment_url and gateway_order_no in Supabase, update payment_gateway = chosenGateway,
  //     and process a fresh session through the new gateway.
  // Else (no gateway switch):
  //   - Immediately return existing payment_url and frozen gateway.
  const isGatewaySwitch = Boolean(
    order.payment_url && (
      (requestedGateway && requestedGateway !== order.payment_gateway) ||
      (order.payment_gateway && order.payment_gateway !== chosenGateway)
    )
  )

  if (isGatewaySwitch) {
    console.log(`[payment/create] Gateway switch detected for order ${orderId}: ${order.payment_gateway} -> ${chosenGateway}. Clearing old payment_url and starting fresh session.`)
    await (serviceClient.from('orders') as any)
      .update({
        payment_url: null,
        gateway_order_no: null,
        merchant_order_no: null,
        payment_gateway: chosenGateway,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    order.payment_url = null
    order.gateway_order_no = null
    order.merchant_order_no = null
    order.payment_gateway = chosenGateway
  } else if (order.payment_url && order.status === 'PENDING') {
    console.log(`[payment/create] Idempotent hit: Reusing existing payment_url for order ${orderId}: ${order.payment_url}`)
    return NextResponse.json({
      success: true,
      payment_url: order.payment_url,
      gateway_order_no: order.gateway_order_no || null,
      gateway: chosenGateway,
      cached: true,
    })
  }

  // Persist the chosen gateway to the order explicitly before routing
  await (serviceClient.from('orders') as any)
    .update({ payment_gateway: chosenGateway })
    .eq('id', orderId)
    .then(({ error }: { error: any }) => {
      if (error) console.warn('[payment/create] Could not persist payment_gateway to order:', error.message)
    })
    .catch(() => {})

  // 5. Route request to chosen gateway handler
  const baseUrl = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || 'https://streetexchange.vercel.app'
  const targetPath = chosenGateway === 'WATCHPAYS'
    ? '/api/payment/watchpays/create'
    : '/api/payment/bondpay/create'

  const targetUrl = `${baseUrl}${targetPath}`

  console.log(`[payment/create] Routing to ${targetPath} using gateway: ${chosenGateway} for orderId=${orderId}`)

  // Forward the request to the appropriate gateway route
  // Supports direct in-process handler invocation with clean HTTP fetch fallback
  const reqBody = { ...body, orderId, paymentGateway: chosenGateway, gateway: chosenGateway }
  let response: Response

  try {
    const forwardReq = new NextRequest(targetUrl, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify(reqBody),
    })
    response = chosenGateway === 'WATCHPAYS'
      ? await watchPaysHandler(forwardReq)
      : await bondPayHandler(forwardReq)
  } catch (directErr: any) {
    console.warn(`[payment/create] Direct handler call to ${chosenGateway} failed, falling back to fetch:`, directErr?.message || directErr)
    const headers = new Headers()
    const authHeader = req.headers.get('authorization')
    if (authHeader) headers.set('authorization', authHeader)
    headers.set('Content-Type', 'application/json')
    const cookieHeader = req.headers.get('cookie')
    if (cookieHeader) headers.set('cookie', cookieHeader)

    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
      signal: AbortSignal.timeout(30_000),
    })
  }

  try {
    const responseBody = await response.text()
    let parsed: any
    try {
      parsed = JSON.parse(responseBody)
    } catch {
      parsed = { message: responseBody }
    }

    // Include which gateway was used in the response
    if (typeof parsed === 'object' && parsed !== null) {
      parsed.gateway = chosenGateway
    }

    // 6. Once the gateway returns the new payment_url and order_no, update orders table in Supabase immediately
    if (response.ok && parsed?.payment_url) {
      const newUrl = parsed.payment_url
      const newOrderNo = parsed.gateway_order_no || parsed.order_no || null

      const updatePayload: Record<string, any> = {
        payment_url: newUrl,
        payment_gateway: chosenGateway,
        updated_at: new Date().toISOString(),
      }
      if (newOrderNo) {
        updatePayload.gateway_order_no = newOrderNo
      }

      let { error: updateErr } = await (serviceClient
        .from('orders') as any)
        .update(updatePayload)
        .eq('id', orderId)

      if (updateErr && updatePayload.payment_gateway) {
        console.warn('[payment/create] Retrying update without payment_gateway:', updateErr.message)
        delete updatePayload.payment_gateway
        const retryRes = await (serviceClient.from('orders') as any)
          .update(updatePayload)
          .eq('id', orderId)
        updateErr = retryRes.error
      }

      if (updateErr) {
        console.error('[payment/create] Failed to update orders with payment_url and gateway_order_no:', updateErr.message)
      } else {
        console.log(`[payment/create] Successfully updated order ${orderId} with payment_url and gateway_order_no: ${newOrderNo}`)
      }
    }

    return NextResponse.json(parsed, { status: response.status })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[payment/create] Failed to process ${chosenGateway} response:`, message)
    return NextResponse.json(
      { error: `Payment gateway error: ${message}`, gateway: chosenGateway },
      { status: 502 },
    )
  }
}
