/**
 * Order Action API Route
 * POST /api/order/action
 *
 * Accepts: { orderId: string, action: 'CANCEL' | 'MARK_PAID' }
 *
 * - CANCEL      → sets order status to 'CANCELLED' + sends red Discord webhook
 * - MARK_PAID   → sets order status to 'AWAITING_VERIFICATION' + sends green Discord webhook
 *
 * Auth: The caller must be the authenticated owner of the order.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendDiscordWebhook } from '@/lib/discord'
import { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Service-role client — bypasses RLS for reads and writes
// ---------------------------------------------------------------------------
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// POST /api/order/action
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse request body
  let body: { orderId?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { orderId, action } = body

  if (!orderId || typeof orderId !== 'string') {
    return NextResponse.json({ error: '`orderId` is required.' }, { status: 400 })
  }

  if (action !== 'CANCEL' && action !== 'MARK_PAID') {
    return NextResponse.json(
      { error: '`action` must be either "CANCEL" or "MARK_PAID".' },
      { status: 400 }
    )
  }

  // 2. Authenticate the caller
  const serviceClient = createServiceClient()
  let userId: string | null = null

  // Try Bearer token first (used by browser clients with Supabase auth)
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim()
    if (token) {
      const { data, error } = await serviceClient.auth.getUser(token)
      if (!error && data?.user) {
        userId = data.user.id
      }
    }
  }

  // Fall back to cookie-based session
  if (!userId) {
    try {
      const serverSupabase = await createServerClient()
      const { data, error } = await serverSupabase.auth.getUser()
      if (!error && data?.user) {
        userId = data.user.id
      }
    } catch (err: any) {
      console.warn('[order/action] Cookie session read error:', err?.message)
    }
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorised: Please log in to perform this action.' },
      { status: 401 }
    )
  }

  // 3. Fetch the order — verify it exists and belongs to the caller
  const { data: order, error: fetchErr } = await serviceClient
    .from('orders')
    .select('id, user_id, status, inr_amount, usdt_amount, order_type, network')
    .eq('id', orderId)
    .maybeSingle()

  if (fetchErr || !order) {
    console.error('[order/action] Order fetch error:', fetchErr?.message)
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  if (order.user_id !== userId) {
    console.warn(
      `[order/action] User ${userId} attempted to act on order ${orderId} owned by ${order.user_id}`
    )
    return NextResponse.json(
      { error: 'Forbidden: You do not own this order.' },
      { status: 403 }
    )
  }

  // 4. Guard: only allow actions on PENDING orders
  if (order.status !== 'PENDING') {
    return NextResponse.json(
      {
        error: `Action not allowed: Order is currently '${order.status}'. Only PENDING orders can be acted upon.`,
      },
      { status: 409 }
    )
  }

  // 5. Apply the action
  if (action === 'CANCEL') {
    // -----------------------------------------------------------------------
    // CANCEL — set status to CANCELLED
    // -----------------------------------------------------------------------
    const { error: updateErr } = await serviceClient
      .from('orders')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (updateErr) {
      console.error('[order/action] CANCEL update error:', updateErr.message)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Send red Discord alert
    await sendDiscordWebhook({
      title: '🚨 Order Cancelled by User',
      color: 0xEF4444,
      fields: [
        { name: 'Order ID', value: `\`${orderId}\``, inline: true },
        { name: 'Amount (INR)', value: `₹${Number(order.inr_amount).toLocaleString('en-IN')}`, inline: true },
        { name: 'Status', value: 'CANCELLED', inline: true },
      ],
    })

    console.log(`[order/action] Order ${orderId} cancelled by user ${userId}`)

    return NextResponse.json({ success: true, status: 'CANCELLED' })
  }

  // action === 'MARK_PAID'
  // -------------------------------------------------------------------------
  // MARK_PAID — set status to AWAITING_VERIFICATION
  // -------------------------------------------------------------------------
  const { error: updateErr } = await serviceClient
    .from('orders')
    .update({
      status: 'AWAITING_VERIFICATION',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('[order/action] MARK_PAID update error:', updateErr.message)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Send green Discord alert
  await sendDiscordWebhook({
    title: '🟢 Payment Submitted by User',
    color: 0x10B981,
    fields: [
      { name: 'Order ID', value: `\`${orderId}\``, inline: true },
      { name: 'Amount (INR)', value: `₹${Number(order.inr_amount).toLocaleString('en-IN')}`, inline: true },
      { name: 'Status', value: 'AWAITING_VERIFICATION', inline: true },
      {
        name: 'Message',
        value: 'User confirmed manual payment completion.',
      },
    ],
  })

  console.log(`[order/action] Order ${orderId} marked as paid by user ${userId}`)

  return NextResponse.json({ success: true, status: 'AWAITING_VERIFICATION' })
}
