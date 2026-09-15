/**
 * BondPay Webhook Callback Handler
 * POST /api/payment/bondpay/callback
 *
 * Called by BondPay servers when a payment status changes.
 * This endpoint is PUBLIC (no user auth) — BondPay's server calls it directly.
 *
 * Payload shape (per BondPay docs):
 *   { orderNo, merchantOrder, status, amount, createtime, updatetime }
 *
 * Flow:
 *  1. Parse + validate the incoming payload
 *  2. Look up the order in Supabase by merchant_order_no
 *  3. Idempotency check — skip if already COMPLETED
 *  4. If status === "success" or "pending", immediately set order to PROCESSING (locks UI / blocks repayment)
 *  5. If status === "success", mark order COMPLETED and fire Discord alert
 *  6. Always respond HTTP 200 with { status: "ok", message: "Callback received successfully" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { sendDiscordOrderAlert } from '@/lib/discordOrderNotifier'

const OK_RESPONSE = NextResponse.json(
  { status: 'ok', message: 'Callback received successfully' },
  { status: 200 },
)

/** Service-role Supabase client — needed to update orders without RLS blocking */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// POST /api/payment/bondpay/callback
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    orderNo?: string
    merchantOrder?: string
    status?: string
    amount?: string | number
    createtime?: string | number
    updatetime?: string | number
  }

  try {
    body = await req.json()
  } catch {
    // BondPay might send form-encoded — try parsing as text fallback
    try {
      const text = await req.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    } catch {
      console.error('[bondpay/callback] Could not parse request body')
      return OK_RESPONSE // Always 200 to BondPay
    }
  }

  const { orderNo, merchantOrder, status, amount } = body

  console.info('[bondpay/callback] Received payload:', {
    orderNo,
    merchantOrder,
    status,
    amount,
  })

  // 1. Validate we have enough to act on
  if (!merchantOrder) {
    console.warn('[bondpay/callback] Missing merchantOrder field — ignoring')
    return OK_RESPONSE
  }

  const supabase = createServiceClient()

  // 2. Look up the order by merchant_order_no
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status, inr_amount, usdt_amount, user_id, order_type, network, wallet_address')
    .eq('merchant_order_no', merchantOrder)
    .single()

  if (fetchErr || !order) {
    console.warn('[bondpay/callback] Order not found for merchantOrder:', merchantOrder)
    return OK_RESPONSE // Return 200 so BondPay doesn't retry endlessly
  }

  // 3. Idempotency — skip if already COMPLETED
  if (order.status === 'COMPLETED') {
    console.info('[bondpay/callback] Order already COMPLETED — skipping:', order.id)
    return OK_RESPONSE
  }

  // 4. Immediately lock order to PROCESSING on any success/pending signal
  //    This prevents the user from re-paying while the full completion flow runs.
  if (status === 'success' || status === 'SUCCESS' || status === 'pending' || status === 'PENDING') {
    const { error: lockErr } = await supabase
      .from('orders')
      .update({
        status: 'PROCESSING',
        gateway_order_no: orderNo ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('merchant_order_no', merchantOrder)

    if (lockErr) {
      console.warn('[bondpay/callback] Failed to set PROCESSING status:', lockErr.message)
      // Non-fatal — continue to attempt full completion
    } else {
      console.info('[bondpay/callback] Order locked to PROCESSING:', order.id)
    }
  }

  // 5. Process payment success
  if (status === 'success' || status === 'SUCCESS') {
    const now = new Date().toISOString()

    // Mark order COMPLETED
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'COMPLETED',
        gateway_order_no: orderNo ?? null,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', order.id)

    if (updateErr) {
      console.error('[bondpay/callback] Failed to update order status:', updateErr.message)
      // Still return 200 — we'll handle reconciliation manually
      return OK_RESPONSE
    }

    console.info('[bondpay/callback] Order COMPLETED via BondPay:', order.id)

    // 5. Fetch user profile for enriched Discord notification
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, username, phone, discord_id')
      .eq('id', order.user_id)
      .single()

    // Fire Discord alert asynchronously — don't block the response
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
      status: 'COMPLETED',
      created_at: now,
      // Custom embed override to signal this is a gateway completion
      _overrideTitle: '✅ BondPay Payment Confirmed!',
      _overrideColor: 0x10b981, // Emerald
    }).catch((err) => {
      console.warn('[bondpay/callback] Discord alert failed (non-fatal):', err)
    })
  } else {
    // Log other status values for visibility (e.g. failed)
    console.info(`[bondpay/callback] Status "${status}" for order ${order.id} — PROCESSING lock applied (if success/pending), no COMPLETED transition`)
  }

  return OK_RESPONSE
}
