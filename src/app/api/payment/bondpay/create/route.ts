/**
 * BondPay Order Creation API
 * POST /api/payment/bondpay/create
 *
 * Initiates a BondPay payment session for an existing order.
 * 1. Validates the request (auth via Bearer header or cookies + order ownership)
 * 2. Generates a unique merchant_order_no
 * 3. Calls BondPay to create the payment session
 * 4. Persists merchant_order_no, gateway_order_no, payment_url on the order record
 * 5. Returns { success: true, payment_url } for the client to redirect
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { createBondPayOrder } from '@/lib/bondpay'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// POST /api/payment/bondpay/create
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
        console.warn('[bondpay/create] Bearer token validation warning:', tokenErr.message)
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
        console.warn('[bondpay/create] Cookie session validation warning:', cookieErr.message)
      }
    } catch (err: any) {
      console.warn('[bondpay/create] Cookie reading error:', err?.message)
    }
  }

  console.log(`[bondpay/create] Auth check: user=${user?.email || user?.id || 'none'} via ${authSource}`)

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

  console.log(`[bondpay/create] Processing order ${orderId} for user ${user.id}`)

  // 3. Fetch order — verify it exists and belongs to the authenticated user
  const { data: order, error: orderErr } = await serviceClient
    .from('orders')
    .select('id, inr_amount, user_id, status, merchant_order_no, payment_url')
    .eq('id', orderId)
    .maybeSingle()

  if (orderErr || !order) {
    console.error(`[bondpay/create] Order fetch error for ${orderId}:`, orderErr?.message)
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  if (order.user_id !== user.id) {
    console.warn(`[bondpay/create] User ${user.id} attempted to pay for order belonging to ${order.user_id}`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    return NextResponse.json(
      { error: `Order is already ${order.status}. Cannot initiate payment.` },
      { status: 409 },
    )
  }

  // 4. If a payment_url already exists for this order, return it immediately
  //    (idempotency — avoids creating duplicate BondPay sessions on re-clicks)
  if (order.payment_url && order.merchant_order_no) {
    console.log(`[bondpay/create] Reusing existing payment_url for order ${orderId}: ${order.payment_url}`)
    return NextResponse.json({ success: true, payment_url: order.payment_url })
  }

  // 5. Generate a unique merchant_order_no
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  const merchantOrderNo = `ORDER_${timestamp}_${random}`

  console.log(`[bondpay/create] Calling BondPay for amount ₹${order.inr_amount} (merchantOrderNo: ${merchantOrderNo})`)

  // 6. Call BondPay gateway
  const bondPayResult = await createBondPayOrder({
    amount: Number(order.inr_amount),
    merchantOrderNo,
  })

  console.log(`[bondpay/create] BondPay response:`, {
    success: bondPayResult.success,
    hasUrl: !!bondPayResult.payment_url,
    message: bondPayResult.message,
    gatewayOrderNo: bondPayResult.order_no,
  })

  if (!bondPayResult.success || !bondPayResult.payment_url) {
    console.error('[bondpay/create] Gateway failure:', bondPayResult.message)
    return NextResponse.json(
      { error: bondPayResult.message || 'Payment gateway error. Please try again.' },
      { status: 502 },
    )
  }

  // 7. Persist the gateway fields on the order record using serviceClient
  const { error: updateErr } = await serviceClient
    .from('orders')
    .update({
      merchant_order_no: merchantOrderNo,
      gateway_order_no: bondPayResult.order_no ?? null,
      payment_url: bondPayResult.payment_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('[bondpay/create] Failed to persist gateway fields:', updateErr.message)
  } else {
    console.log(`[bondpay/create] Successfully saved gateway details to order ${orderId}`)
  }

  return NextResponse.json({ success: true, payment_url: bondPayResult.payment_url })
}
