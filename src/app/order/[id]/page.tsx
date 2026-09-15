'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthProvider'
import { Tables } from '@/lib/database.types'
import { validateUTR } from '@/lib/validation'
import { formatIST } from '@/lib/dateUtils'
import { Trc20Logo, Bep20Logo } from '@/components/NetworkLogos'
import {
  MessageSquare,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Lock,
  Wallet,
  Coins,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  CreditCard,
  Zap,
  XCircle,
} from 'lucide-react'

type Order = Tables<'orders'>

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      type="button"
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {label ? (copied ? 'Copied!' : label) : (copied ? 'Copied' : 'Copy')}
    </button>
  )
}

export default function OrderCheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  const orderId = params?.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [adminWallets, setAdminWallets] = useState<{ trc20?: string; bep20?: string }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Payment method settings
  const [allowManualPayment, setAllowManualPayment] = useState<boolean | null>(null)

  // BondPay gateway state
  const [bondPayLoading, setBondPayLoading] = useState(false)
  const [bondPayError, setBondPayError] = useState('')

  // Reference submission state (UTR for BUY, TXID for SELL)
  const [refInput, setRefInput] = useState('')
  const [refError, setRefError] = useState('')
  const [submittingRef, setSubmittingRef] = useState(false)
  const [refSuccess, setRefSuccess] = useState(false)

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!orderId) return
    // Wait until auth is resolved before fetching
    if (authLoading || !user) return

    let isMounted = true

    async function fetchOrderAndConfigs() {
      try {
        const { data: orderData, error: fetchErr } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()

        if (!isMounted) return

        if (fetchErr || !orderData) {
          setError('Order not found or access denied.')
          setLoading(false)
          return
        }

        setOrder(orderData)
        if (orderData.payment_gateway_ref) {
          setRefInput(orderData.payment_gateway_ref)
        }

        // Fetch admin deposit wallets from system_configs
        const { data: configs } = await supabase.from('system_configs').select('*')
        if (configs && isMounted) {
          const map: Record<string, string> = {}
          configs.forEach((c) => {
            map[c.key] = c.value
          })
          setAdminWallets({
            trc20: map['admin_trc20_address'],
            bep20: map['admin_bep20_address'],
          })
        }

        // Fetch payment settings from system_settings or fallback to /api/admin/settings
        try {
          const { data: paymentSettings, error: psErr } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'allow_manual_payment')
            .maybeSingle()

          if (!psErr && paymentSettings) {
            const rawVal = paymentSettings.value
            if (isMounted) setAllowManualPayment(rawVal === false || rawVal === 'false' ? false : true)
          } else {
            const res = await fetch('/api/admin/settings')
            const data = await res.json()
            if (isMounted && typeof data?.allow_manual_payment === 'boolean') {
              setAllowManualPayment(data.allow_manual_payment)
            } else if (isMounted) {
              setAllowManualPayment(true)
            }
          }
        } catch {
          if (isMounted) setAllowManualPayment(true)
        }

        setLoading(false)
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Error fetching order details.')
          setLoading(false)
        }
      }
    }

    fetchOrderAndConfigs()

    // Realtime subscription for order status and reference updates
    const channel = supabase
      .channel(`order-live-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (!isMounted) return
          const updated = payload.new as Order
          setOrder(updated)
          if (updated.payment_gateway_ref) {
            setRefInput(updated.payment_gateway_ref)
          }
        }
      )
      .subscribe()

    // Realtime subscription for system_configs
    const configsChannel = supabase
      .channel('system-configs-checkout')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_configs',
        },
        () => {
          supabase
            .from('system_configs')
            .select('*')
            .then(({ data }) => {
              if (data && isMounted) {
                const map: Record<string, string> = {}
                data.forEach((c) => {
                  map[c.key] = c.value
                })
                setAdminWallets({
                  trc20: map['admin_trc20_address'],
                  bep20: map['admin_bep20_address'],
                })
              }
            })
        }
      )
      .subscribe()

    // Realtime subscription for system_settings (manual payment toggle)
    const settingsChannel = supabase
      .channel(`system-settings-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          if (!isMounted) return
          const row = payload.new as { key?: string; value?: any }
          if (row?.key === 'allow_manual_payment') {
            const val = row.value
            setAllowManualPayment(val === false || val === 'false' ? false : true)
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
      supabase.removeChannel(configsChannel)
      supabase.removeChannel(settingsChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, user?.id, authLoading])

  const handleRefSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order) return
    if (order.status === 'CANCELLED') {
      setRefError('Cannot submit details for a cancelled order.')
      return
    }

    const cleaned = refInput.trim()
    const isSell = order.order_type === 'SELL'

    if (isSell) {
      if (!cleaned || cleaned.length < 10) {
        setRefError('Please enter a valid Transaction Hash / TXID (minimum 10 characters).')
        return
      }
    } else {
      const res = validateUTR(cleaned)
      if (!res.valid) {
        setRefError(res.error || 'Invalid 12-digit UTR reference.')
        return
      }
    }

    setRefError('')
    setSubmittingRef(true)

    try {
      const { data, error: updateError } = await supabase
        .from('orders')
        .update({
          payment_gateway_ref: cleaned,
          status: 'IN_PROGRESS',
        })
        .eq('id', order.id)
        .select()
        .single()

      if (updateError) {
        setRefError(updateError.message || 'Failed to submit reference.')
      } else if (data) {
        setOrder(data)
        setRefSuccess(true)
        setTimeout(() => setRefSuccess(false), 4000)
      }
    } catch (err: any) {
      setRefError(err?.message || 'Error updating order.')
    } finally {
      setSubmittingRef(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading order checkout...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Order Unavailable</h2>
          <p className="text-sm text-slate-400">{error || 'Could not find the requested trade order.'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isPending = order.status === 'PENDING'
  const isInProgress = order.status === 'IN_PROGRESS'
  const isCompleted = order.status === 'COMPLETED'
  const isCancelled = order.status === 'CANCELLED'
  const isSell = order.order_type === 'SELL'

  const activeAdminWallet = order.network === 'BEP20'
    ? (adminWallets.bep20 || '0xExampleAdminBEP20WalletAddressHere0000')
    : (adminWallets.trc20 || 'TExampleAdminTRC20WalletAddressHere34')

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Navigation Back */}
        <Link
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition text-sm"
          href="/dashboard"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Order Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">Order #{order.id.slice(0, 8)}</h1>
                <CopyButton text={order.id} label="Copy ID" />
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  isSell
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {order.order_type ?? 'BUY'}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                Placed on: <span className="text-slate-200 font-medium">{formatIST(order.created_at)}</span>
              </p>
              {order.completed_at && (
                <p className="text-xs text-emerald-400 mt-1">
                  Completed on: {formatIST(order.completed_at)}
                </p>
              )}
            </div>
            <div>
              {isPending && (
                <span className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  {isSell ? 'Awaiting USDT Deposit' : 'Payment in Progress / Pending Verification'}
                </span>
              )}
              {isInProgress && (
                <span className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  {isSell ? 'Deposit Verification & Payout in Progress' : 'In Progress / Verification Underway'}
                </span>
              )}
              {isCompleted && (
                <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSell ? 'Completed / INR Dispatched' : 'Completed / USDT Dispatched'}
                </span>
              )}
              {isCancelled && (
                <span className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded-full flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Cancelled
                </span>
              )}
            </div>
          </div>

          {/* Trade Details Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm pt-1">
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
              <p className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                {isSell ? 'INR Payout Value' : 'Total INR to Pay'}
              </p>
              <p className="text-xl font-bold text-emerald-400">
                ₹{Number(order.inr_amount).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
              <p className="text-slate-400 text-xs flex items-center gap-1 mb-1">
                <Wallet className="w-3.5 h-3.5 text-blue-400" />
                {isSell ? 'USDT to Deposit / Send' : 'USDT to Receive'}
              </p>
              <p className={`text-xl font-bold ${isSell ? 'text-rose-400' : 'text-blue-400'}`}>
                {Number(order.usdt_amount).toFixed(4)} USDT
              </p>
            </div>
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
              <p className="text-slate-400 text-xs mb-1">Applied Rate</p>
              <p className="font-semibold text-slate-200">
                ₹{Number(order.rate_applied).toFixed(2)} / USDT
              </p>
            </div>
            <div className="bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
              <p className="text-slate-400 text-xs mb-1">Selected Network</p>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 mt-0.5 rounded text-xs font-bold border ${
                order.network === 'BEP20' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}>
                {order.network === 'BEP20' ? <Bep20Logo className="w-3.5 h-3.5 text-amber-400" /> : <Trc20Logo className="w-3.5 h-3.5 text-red-400" />}
                USDT ({order.network ?? 'TRC20'})
              </span>
            </div>

            {/* Destination Payout or User Payout Account */}
            {isSell ? (
              <div className="col-span-2 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                    Your Registered Payout Details (INR Destination)
                  </p>
                  {order.user_payout_details && <CopyButton text={order.user_payout_details} />}
                </div>
                <p className="font-mono text-sm font-semibold text-rose-300 truncate mt-1 select-all">
                  {order.user_payout_details || 'No payout details provided'}
                </p>
              </div>
            ) : (
              <div className="col-span-2 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-blue-400" />
                    Your Receiving Wallet Address
                  </p>
                  <CopyButton text={order.wallet_address || (order as any).trc20_address || ''} />
                </div>
                <p className="font-mono text-xs text-slate-200 truncate mt-1" title={order.wallet_address || (order as any).trc20_address}>
                  {order.wallet_address || (order as any).trc20_address}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Check if Cancelled */}
        {isCancelled ? (
          <div className="bg-slate-900 border border-red-500/30 rounded-xl p-6 sm:p-8 text-center space-y-5 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Order Cancelled
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                This order has been marked as cancelled by an administrator. Checkout, payment instructions, and submissions are disabled for this order.
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg transition text-sm shadow-lg shadow-indigo-600/20"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Dashboard
              </Link>
            </div>
          </div>
        ) : isSell ? (
          /* ========================================================================= */
          /* SELL USDT FLOW: Display Admin's Deposit Wallet & Instructions             */
          /* ========================================================================= */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-lg shrink-0">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Deposit USDT to Admin Escrow
                  <span className="text-xs font-normal px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    Network: {order.network ?? 'TRC20'}
                  </span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Transfer the exact USDT amount from your personal wallet to the official StreetExchange deposit address below.
                </p>
              </div>
            </div>

            {/* Admin Deposit Wallet Card */}
            <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-5 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-rose-400" />
                  Official System Deposit Address ({order.network ?? 'TRC20'})
                </span>
                <span className="text-xs text-slate-400">Escrow Protected</span>
              </div>

              <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 rounded-lg p-3.5 gap-2">
                <div className="overflow-hidden">
                  <p className="text-[11px] text-slate-400">StreetExchange Deposit Address</p>
                  <p className="font-mono font-bold text-white text-xs sm:text-sm select-all break-all mt-0.5">
                    {activeAdminWallet}
                  </p>
                </div>
                <div className="shrink-0">
                  <CopyButton text={activeAdminWallet} label="Copy Address" />
                </div>
              </div>

              {/* Step instructions */}
              <div className="space-y-2 pt-1 text-xs text-slate-300">
                <p className="font-semibold text-white">Deposit Instructions:</p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-400">
                  <li>
                    Open your wallet (Binance, Trust Wallet, MetaMask, Bybit, etc.).
                  </li>
                  <li>
                    Initiate a withdrawal of exactly{' '}
                    <strong className="text-rose-300 font-mono">
                      {Number(order.usdt_amount).toFixed(4)} USDT
                    </strong>{' '}
                    on the <strong className="text-white">{order.network ?? 'TRC20'}</strong> network.
                  </li>
                  <li>
                    Paste the admin deposit address above as the transfer destination.
                  </li>
                  <li>
                    After transfer, copy the <strong>Transaction Hash (TXID)</strong> and submit below.
                  </li>
                </ol>
              </div>

              {/* TXID Submission Form */}
              <form onSubmit={handleRefSubmit} className="pt-3 border-t border-slate-800 space-y-3">
                <label htmlFor="order-txid" className="block text-xs font-medium text-slate-300">
                  Have you transferred? Enter Transaction Hash / TXID:
                </label>
                <div className="flex gap-2">
                  <input
                    id="order-txid"
                    type="text"
                    placeholder="e.g. 0xabc123... or tron tx hash"
                    value={refInput}
                    onChange={(e) => {
                      setRefInput(e.target.value.trim())
                      setRefError('')
                    }}
                    className="bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-lg px-3 py-2 text-xs font-mono text-white flex-1 outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={submittingRef || refInput.length < 8}
                    className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5 shrink-0 shadow-lg shadow-rose-600/20"
                  >
                    {submittingRef ? (
                      'Saving...'
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Submit TXID
                      </>
                    )}
                  </button>
                </div>

                {refError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {refError}
                  </p>
                )}
                {refSuccess && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> TXID submitted! Admin has been notified to verify and release your INR payout.
                  </p>
                )}
                {order.payment_gateway_ref && !refSuccess && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    Submitted TXID: <span className="text-rose-300 font-semibold">{order.payment_gateway_ref}</span>
                  </p>
                )}
              </form>
            </div>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3 text-emerald-300 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              <p>
                Once your deposit is confirmed on the blockchain, the admin will immediately dispatch{' '}
                <strong>₹{Number(order.inr_amount).toLocaleString('en-IN')}</strong> to your registered payout UPI / Bank:{' '}
                <span className="font-mono text-white font-semibold">{order.user_payout_details}</span>.
              </p>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* BUY USDT FLOW: Existing UPI Payment Section & Instructions                */
          /* ========================================================================= */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-xl">

            {/* ----------------------------------------------------------------- */}
            {/* Case A: Manual payment is DISABLED — force BondPay                */}
            {/* ----------------------------------------------------------------- */}
            {allowManualPayment === false ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      Instant UPI Payment via BondPay
                      <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Automatic Gateway
                      </span>
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Manual payments are currently disabled. Please pay automatically using BondPay / Instant UPI.
                    </p>
                  </div>
                </div>

                {/* Notice banner */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                  <p>
                    <strong>Manual payments are currently disabled.</strong> Please pay automatically
                    using <strong>BondPay / Instant UPI</strong>. You will be redirected to a
                    secure payment page to complete your order.
                  </p>
                </div>

                {/* Order summary */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Amount to Pay</span>
                    <span className="font-bold text-white text-base">₹{Number(order.inr_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Receiving USDT</span>
                    <span className="font-bold text-violet-400 text-base">{Number(order.usdt_amount).toFixed(4)} USDT</span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Destination ({order.network ?? 'TRC20'})</span>
                    <span className="font-mono text-slate-300 truncate max-w-[200px]" title={order.wallet_address || ''}>
                      {order.wallet_address}
                    </span>
                  </div>
                </div>

                {/* BondPay CTA */}
                {bondPayError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {bondPayError}
                  </div>
                )}

                <button
                  id="bondpay-checkout-btn"
                  type="button"
                  disabled={bondPayLoading || order.status === 'COMPLETED' || order.status === 'CANCELLED'}
                  onClick={async () => {
                    setBondPayLoading(true)
                    setBondPayError('')
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                      if (session?.access_token) {
                        headers['Authorization'] = `Bearer ${session.access_token}`
                      }

                      const res = await fetch('/api/payment/bondpay/create', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ orderId: order.id }),
                      })
                      const data = await res.json()
                      if (!res.ok || !data.payment_url) {
                        throw new Error(data.error || 'Gateway error. Please try again.')
                      }
                      window.location.href = data.payment_url
                    } catch (err: any) {
                      setBondPayError(err?.message || 'Could not initiate payment. Please try again.')
                      setBondPayLoading(false)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {bondPayLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Connecting to BondPay...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Pay with BondPay (₹{Number(order.inr_amount).toLocaleString('en-IN')}) →
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-slate-500">
                  You'll be securely redirected to BondPay's checkout. Do not close this tab.
                </p>
              </>
            ) : (
              /* ----------------------------------------------------------------- */
              /* Case B: Manual payment is ENABLED — show existing UPI flow        */
              /* ----------------------------------------------------------------- */
              <>
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
                <Clock className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  UPI Payment Gateway Status
                  <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Gateway Integration in Progress
                  </span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Automatic payment processing is currently in setup. Your order request has been logged successfully in our system.
                </p>
              </div>
            </div>

            {/* Conditional: Waiting for Payment Details vs Active UPI Transfer */}
            {!order.assigned_upi_id ? (
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-6 sm:p-8 space-y-6 text-center relative overflow-hidden shadow-2xl">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-4 max-w-lg mx-auto">
                  <div className="relative inline-flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Clock className="w-8 h-8 animate-pulse" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
                    </span>
                  </div>

                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium mb-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      Ticket #{order.id.slice(0, 8).toUpperCase()} Queued
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      Waiting to get your payment details...
                    </h2>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      Your order ticket has been registered in the system. An administrator is currently assigning your dedicated UPI payment details.
                    </p>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-left grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Amount to Pay</span>
                      <span className="font-bold text-white text-base">₹{Number(order.inr_amount).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Receiving USDT</span>
                      <span className="font-bold text-violet-400 text-base">{Number(order.usdt_amount).toFixed(4)} USDT</span>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Destination ({order.network ?? 'TRC20'})</span>
                      <span className="font-mono text-slate-300 truncate max-w-[200px]" title={order.wallet_address || (order as any).trc20_address}>
                        {order.wallet_address || (order as any).trc20_address}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 py-2.5 px-4 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>
                      <strong>Live updates active:</strong> This page will automatically update the moment your UPI ID is provided.
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Expected time: <strong className="text-slate-300">1–3 minutes</strong>. Please keep this screen open or check back shortly.
                  </p>
                </div>
              </div>
            ) : (
              /* Assigned UPI payment instructions */
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-violet-400" />
                    Manual UPI Transfer Instructions
                  </span>
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Payment Details Assigned
                  </span>
                </div>

                <div className="flex items-center justify-between bg-slate-900/90 border border-emerald-500/30 rounded-lg p-3.5 shadow-sm">
                  <div>
                    <p className="text-xs text-slate-400">Assigned StreetExchange UPI ID</p>
                    <p className="font-mono font-bold text-violet-400 text-base select-all">{order.assigned_upi_id}</p>
                  </div>
                  <CopyButton text={order.assigned_upi_id} label="Copy UPI ID" />
                </div>

                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside pl-1">
                  <li>Open Google Pay, PhonePe, Paytm, or your banking UPI app.</li>
                  <li>
                    Send exactly{' '}
                    <strong className="text-white font-mono">
                      ₹{Number(order.inr_amount).toLocaleString('en-IN')}
                    </strong>{' '}
                    to <span className="font-mono text-violet-300 font-semibold select-all">{order.assigned_upi_id}</span>.
                  </li>
                  <li>Note down the 12-digit UPI / UTR Transaction Reference Number.</li>
                  <li>Submit the UTR below for immediate clearance.</li>
                </ol>

                <form onSubmit={handleRefSubmit} className="pt-2 border-t border-slate-800 space-y-3">
                  <label htmlFor="order-utr" className="block text-xs font-medium text-slate-300">
                    Have you already transferred? Enter 12-Digit UTR Reference:
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="order-utr"
                      type="text"
                      maxLength={12}
                      placeholder="e.g. 123456789012"
                      value={refInput}
                      onChange={(e) => {
                        setRefInput(e.target.value.replace(/\D/g, '').slice(0, 12))
                        setRefError('')
                      }}
                      className="bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm font-mono text-white flex-1 outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={submittingRef || refInput.length !== 12}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5 shrink-0"
                    >
                      {submittingRef ? (
                        'Saving...'
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Submit UTR
                        </>
                      )}
                    </button>
                  </div>

                  {refError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {refError}
                    </p>
                  )}
                  {refSuccess && (
                    <p className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> UTR reference saved. Admin verification notified!
                    </p>
                  )}
                  {order.payment_gateway_ref && !refSuccess && (
                    <p className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      Recorded UTR: <span className="text-indigo-300 font-semibold">{order.payment_gateway_ref}</span>
                    </p>
                  )}
                </form>
              </div>
            )}

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3 text-amber-300 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                An admin will review your trade order shortly. Once payment confirmation is attached, your status will update to{' '}
                <strong>IN_PROGRESS</strong> / <strong>COMPLETED</strong>.
              </p>
            </div>
            </>
            )}
          </div>
        )}

        {/* Support & Community Section */}
        <div className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-xl p-6 space-y-4 shadow-xl">
          <h3 className="text-base font-semibold text-indigo-200">Need Help or Instant Trade Support?</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            If you have questions regarding your order or want to complete manual payment verification with an admin, contact our support team on Discord:
          </p>

          <a
            href="https://discord.gg/XhGGT7XGXq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40"
          >
            <MessageSquare className="w-4 h-4" />
            Join Our Discord Support
          </a>
        </div>

      </div>
    </div>
  )
}
