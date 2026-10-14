/**
 * WatchPays Webhook Callback Handler
 * POST /api/payment/watchpays/callback
 *
 * Called by WatchPays servers when a payment status changes.
 * This endpoint is PUBLIC (no user auth) — WatchPays server calls it directly.
 *
 * Payload shape (per WatchPays docs):
 *   { orderNo, merchantOrder, status, amount }
 *
 * Flow:
 *  1. Parse + validate the incoming payload
 *  2. Look up the order in Supabase by merchant_order_no
 *  3. Verify order status is strictly PENDING (idempotency)
 *  4. If status === "success", update order to PROCESSING / AWAITING_VERIFICATION
 *  5. Store gateway_order_no for reconciliation
 *  6. Fire Discord alert
 *  7. Return plain string "success" (required by WatchPays spec)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { sendDiscordOrderAlert } from '@/lib/discordOrderNotifier'

/** WatchPays requires a plain "success" response string */
const SUCCESS_RESPONSE = new NextResponse('success', {
  status: 200,
  headers: { 'Content-Type': 'text/plain' },
})

/** Service-role Supabase client — needed to update orders without RLS blocking */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// POST /api/payment/watchpays/callback
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: {
    orderNo?: string
    merchantOrder?: string
    status?: string
    amount?: string | number
  }

  try {
    body = await req.json()
  } catch {
    // WatchPays might send form-encoded — try parsing as text fallback
    try {
      const text = await req.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    } catch {
      console.error('[watchpays/callback] Could not parse request body')
      return SUCCESS_RESPONSE // Always return "success" to WatchPays
    }
  }

  const { orderNo, merchantOrder, status, amount } = body

  console.info('[watchpays/callback] Received payload:', {
    orderNo,
    merchantOrder,
    status,
    amount,
  })

  // 1. Validate we have enough to act on
  if (!merchantOrder) {
    console.warn('[watchpays/callback] Missing merchantOrder field — ignoring')
    return SUCCESS_RESPONSE
  }

  const supabase = createServiceClient()

  // 2. Look up the order by merchant_order_no
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status, inr_amount, usdt_amount, user_id, order_type, network, wallet_address')
    .eq('merchant_order_no', merchantOrder)
    .single()

  if (fetchErr || !order) {
    console.warn('[watchpays/callback] Order not found for merchantOrder:', merchantOrder)
    return SUCCESS_RESPONSE // Return "success" so WatchPays doesn't retry endlessly
  }

  // 3. Idempotency — skip if already COMPLETED or IN_PROGRESS
  if (order.status === 'COMPLETED') {
    console.info('[watchpays/callback] Order already COMPLETED — skipping:', order.id)
    return SUCCESS_RESPONSE
  }

  // 4. Strictly check that order is still in PENDING state before processing
  //    This prevents double-processing on duplicate webhook calls
  if (order.status !== 'PENDING' && order.status !== 'AWAITING_VERIFICATION') {
    console.info(`[watchpays/callback] Order ${order.id} is in "${order.status}" state — already processed, skipping`)
    return SUCCESS_RESPONSE
  }

  // 5. Process payment success
  if (status === 'success' || status === 'SUCCESS') {
    const now = new Date().toISOString()

    // Update order to PROCESSING (awaiting admin verification / crypto dispatch)
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        status: 'IN_PROGRESS',
        gateway_order_no: orderNo ?? null,
        payment_gateway: 'WATCHPAYS',
        updated_at: now,
      })
      .eq('id', order.id)

    if (updateErr) {
      console.error('[watchpays/callback] Failed to update order status:', updateErr.message)
      return SUCCESS_RESPONSE
    }

    console.info('[watchpays/callback] Order moved to PROCESSING via WatchPays:', order.id)

    // 6. Fetch user profile for enriched Discord notification
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
      status: 'IN_PROGRESS',
      created_at: now,
      // Custom embed override to signal this is a WatchPays gateway completion
      _overrideTitle: '✅ Payment Received via WatchPays',
      _overrideColor: 0x6366f1, // Indigo
    }).catch((err) => {
      console.warn('[watchpays/callback] Discord alert failed (non-fatal):', err)
    })
  } else {
    // Log other status values for visibility (e.g. failed, pending)
    console.info(`[watchpays/callback] Status "${status}" for order ${order.id} — no state transition applied`)
  }

  // 7. Return plain "success" string as required by WatchPays docs
  return SUCCESS_RESPONSE
}
