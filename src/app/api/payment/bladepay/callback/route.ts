/**
 * BladePay Webhook / Callback Handler Route
 * POST /api/payment/bladepay/callback
 *
 * Implements the official BladePay webhook & callback specifications:
 * 1. Receives incoming POST payload from BladePay.
 * 2. Implements exact MD5 signature verification:
 *    - Excludes `sign` from payload data.
 *    - Sorts non-empty keys alphabetically: Object.keys(data).sort().
 *    - Builds string: `pairs.join('&') + '&key=gw_45e7feef35887c0fd6195f50dee597dfd872b31c19704205c7549afe3ce0a83e'`.
 *    - Computes lowercase MD5 hash and compares against incoming `sign`.
 * 3. If valid and `payinState === 2` (or status is success):
 *    - Updates order in Supabase to PROCESSING/SUCCESS (IN_PROGRESS in order status enum).
 *    - Saves UTR to `payment_gateway_ref` and `gateway_order_no`.
 *    - Sends Discord webhook notification.
 * 4. Responds with plain text "SUCCESS" to acknowledge receipt.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { sendDiscordOrderAlert } from '@/lib/discordOrderNotifier'

const DEFAULT_API_KEY =
  process.env.BLADEPAY_API_KEY ||
  process.env.BLADEPAY_API_TOKEN ||
  'gw_45e7feef35887c0fd6195f50dee597dfd872b31c19704205c7549afe3ce0a83e'

/** Service-role Supabase client — bypasses RLS for background webhook updates */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Exact MD5 signature verification per BladePay official documentation:
 * 1. Exclude `sign` from payload data.
 * 2. Sort non-empty keys alphabetically.
 * 3. Build string: `pairs.join('&') + '&key=' + apiKey`.
 * 4. Compute lowercase MD5 hash and compare against incoming `sign`.
 */
function verifyBladePaySignature(payload: Record<string, any>, apiKey: string): boolean {
  if (!payload || typeof payload !== 'object') return false

  const { sign, ...data } = payload
  if (!sign || typeof sign !== 'string') return false

  const sortedKeys = Object.keys(data).filter((k) => k !== 'sign').sort()
  const pairs: string[] = []

  for (const key of sortedKeys) {
    const val = data[key]
    if (val !== '' && val !== null && val !== undefined) {
      pairs.push(`${key}=${val}`)
    }
  }

  const stringToSign = `${pairs.join('&')}&key=${apiKey}`
  const computedHash = crypto
    .createHash('md5')
    .update(stringToSign, 'utf8')
    .digest('hex')
    .toLowerCase()

  try {
    const a = Buffer.from(sign.toLowerCase(), 'utf8')
    const b = Buffer.from(computedHash, 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return sign.toLowerCase() === computedHash
  }
}

// ---------------------------------------------------------------------------
// POST /api/payment/bladepay/callback
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, any> = {}

  try {
    body = await req.json()
  } catch {
    try {
      const text = await req.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    } catch {
      console.error('[BladePay Callback] Unable to parse request body')
      return new NextResponse('SUCCESS', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
  }

  const {
    merchantOrderNo,
    gatewayOrderNo,
    payinState,
    status,
    amount,
    actualAmount,
    utr,
    sign,
  } = body

  console.info('[BladePay Callback] Received notification:', {
    merchantOrderNo,
    gatewayOrderNo,
    payinState,
    status,
    amount: actualAmount || amount,
    utr,
    hasSign: !!sign,
  })

  // 1. Validate merchantOrderNo exists
  if (!merchantOrderNo) {
    console.warn('[BladePay Callback] Missing merchantOrderNo in payload')
    return new NextResponse('SUCCESS', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // 2. MD5 Signature verification
  const isValid = verifyBladePaySignature(body, DEFAULT_API_KEY)
  if (!isValid) {
    console.error('[BladePay Callback] Invalid MD5 signature! Rejecting payload.')
    return new NextResponse('Invalid signature', {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.info('[BladePay Callback] MD5 signature verified successfully ✓')

  const supabase = createServiceClient()

  // 3. Locate the order in Supabase by ID or merchant_order_no
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status, inr_amount, usdt_amount, user_id, order_type, network, wallet_address, payment_gateway_ref')
    .or(`id.eq.${merchantOrderNo},merchant_order_no.eq.${merchantOrderNo}`)
    .maybeSingle()

  if (fetchErr || !order) {
    console.warn(`[BladePay Callback] Order not found for reference: ${merchantOrderNo}`, fetchErr?.message)
    // Return SUCCESS to prevent endless gateway retries for non-existent orders
    return new NextResponse('SUCCESS', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // 4. Idempotency Check:
  // If already COMPLETED, acknowledge receipt immediately
  if (order.status === 'COMPLETED') {
    console.info(`[BladePay Callback] Order ${order.id} is already COMPLETED — skipping re-processing`)
    return new NextResponse('SUCCESS', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // 5. Evaluate BladePay State:
  // payinState === 2 represents SUCCESS per documentation specs
  const normalizedStatus = String(status || '').toUpperCase()
  const isSuccess =
    payinState === 2 ||
    payinState === '2' ||
    normalizedStatus === 'SUCCESS' ||
    normalizedStatus === 'COMPLETED' ||
    normalizedStatus === 'PAID'

  const now = new Date().toISOString()
  const utrRef = utr ? String(utr).trim() : null

  if (isSuccess) {
    console.info(`[BladePay Callback] Payment SUCCESS for order ${order.id}. Updating Supabase...`)

    // Update order in Supabase:
    // Move to IN_PROGRESS (PROCESSING), save UTR in payment_gateway_ref, save gateway_order_no
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'IN_PROGRESS',
        gateway_order_no: gatewayOrderNo ? String(gatewayOrderNo) : null,
        payment_gateway: 'BLADEPAY',
        payment_gateway_ref: utrRef || order.payment_gateway_ref || null,
        updated_at: now,
      })
      .eq('id', order.id)

    if (updateErr) {
      console.error(`[BladePay Callback] Failed to update order ${order.id}:`, updateErr.message)
      return new NextResponse('SUCCESS', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }

    console.info(`[BladePay Callback] Order ${order.id} updated to IN_PROGRESS (UTR: ${utrRef || 'N/A'})`)

    // Fetch user profile for enriched Discord notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, username, phone, discord_id')
      .eq('id', order.user_id)
      .maybeSingle()

    // Send Discord webhook notification
    sendDiscordOrderAlert({
      id: order.id,
      user_id: order.user_id,
      user_email: profile?.email,
      phone: profile?.phone,
      discord_id: profile?.discord_id,
      order_type: order.order_type,
      inr_amount: Number(order.inr_amount),
      usdt_amount: Number(order.usdt_amount),
      network: order.network,
      wallet_address: order.wallet_address,
      status: 'IN_PROGRESS',
      created_at: now,
      _overrideTitle: '✅ Payment Received via BladePay',
      _overrideColor: 0x8b5cf6, // Violet
    }).catch((alertErr) => {
      console.warn('[BladePay Callback] Discord notification failed (non-fatal):', alertErr)
    })
  } else {
    console.info(`[BladePay Callback] Non-success status received: ${status} (payinState: ${payinState})`)
  }

  // 6. Return plain text "SUCCESS" to acknowledge receipt
  return new NextResponse('SUCCESS', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

// ---------------------------------------------------------------------------
// GET /api/payment/bladepay/callback — User returnUrl redirect
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://streetexchange.vercel.app'

  const merchantOrderNo = req.nextUrl.searchParams.get('merchantOrderNo')
  if (merchantOrderNo) {
    return NextResponse.redirect(`${siteBase}/order/${merchantOrderNo}`)
  }

  return NextResponse.redirect(`${siteBase}/dashboard`)
}
