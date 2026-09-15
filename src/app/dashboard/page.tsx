'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthProvider'
import { Tables } from '@/lib/database.types'
import { TradeStats } from '@/components/TradeStats'
import { checkOrderCreationAllowed } from '@/lib/createOrderGuard'
import { sendDiscordOrderAlert } from '@/lib/discordOrderNotifier'
import { Trc20Logo, Bep20Logo } from '@/components/NetworkLogos'
import { formatIST } from '@/lib/dateUtils'
import {
  validateINRAmount,
  validateUSDTAmount,
  validateWalletAddress,
  Network,
  calcUSDTFromINR,
  calcINRFromUSDT,
  formatINR,
  MIN_INR_AMOUNT,
  MAX_INR_AMOUNT,
} from '@/lib/validation'
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ChevronRight,
  Wifi,
  WifiOff,
  Package,
  Plus,
  XCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  CreditCard,
} from 'lucide-react'

type Order = Tables<'orders'>
type Rates = Tables<'rates'>

const BUY_PRESET_AMOUNTS = [1000, 5000, 10000, 25000, 50000]
const SELL_PRESET_AMOUNTS = [20, 50, 100, 250, 500]

function StatusBadge({ status }: { status: Order['status'] }) {
  const classes: Record<string, string> = {
    PENDING: 'badge badge-pending',
    AWAITING_VERIFICATION: 'badge badge-pending',
    IN_PROGRESS: 'badge badge-in-progress',
    COMPLETED: 'badge badge-completed',
    CANCELLED: 'badge badge-cancelled',
  }
  const labels: Record<string, string> = {
    PENDING: '⏳ Pending',
    AWAITING_VERIFICATION: '⏳ Awaiting Verification',
    IN_PROGRESS: '🔄 In Progress',
    COMPLETED: '✅ Completed',
    CANCELLED: '✗ Cancelled',
  }
  return <span className={classes[status] || 'badge'}>{labels[status] || status}</span>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="text-white/30 hover:text-white/70 transition-colors p-1 rounded">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [rates, setRates] = useState<Rates | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [rtConnected, setRtConnected] = useState<boolean | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(true)

  // Order form state
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY')
  const [inrAmount, setInrAmount] = useState('')
  const [sellUsdtAmount, setSellUsdtAmount] = useState('')
  const [network, setNetwork] = useState<Network>('TRC20')
  const [walletAddress, setWalletAddress] = useState('')
  const [userPayoutDetails, setUserPayoutDetails] = useState('')
  const [inrError, setInrError] = useState('')
  const [sellUsdtError, setSellUsdtError] = useState('')
  const [addrError, setAddrError] = useState('')
  const [payoutError, setPayoutError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [rateFlash, setRateFlash] = useState<'up' | 'down' | null>(null)

  // Pre-fill from query params if redirected from home calculator
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const typeParam = params.get('type')?.toUpperCase()
      const inrParam = params.get('inr')
      const usdtParam = params.get('usdt')
      const netParam = params.get('net') as Network | null
      const addrParam = params.get('addr')
      const payoutParam = params.get('payout')

      if (typeParam === 'SELL' || typeParam === 'BUY') {
        setOrderType(typeParam as 'BUY' | 'SELL')
      }

      const initialNet: Network = netParam === 'BEP20' ? 'BEP20' : 'TRC20'
      if (netParam === 'BEP20' || netParam === 'TRC20') {
        setNetwork(initialNet)
      }

      if (inrParam) {
        setInrAmount(inrParam)
        setInrError(validateINRAmount(parseFloat(inrParam)).error || '')
      }
      if (usdtParam) {
        setSellUsdtAmount(usdtParam)
      }
      if (addrParam) {
        setWalletAddress(addrParam)
        setAddrError(validateWalletAddress(addrParam, initialNet).error || '')
      }
      if (payoutParam) {
        setUserPayoutDetails(payoutParam)
      }
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      const t = setTimeout(() => router.push('/login'), 200)
      return () => clearTimeout(t)
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const userId = user?.id
    if (!userId) return

    let isMounted = true

    // Fetch rates
    supabase.from('rates').select('*').order('updated_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data && isMounted) setRates(data) })

    // Fetch orders
    supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      .then(
        ({ data }) => {
          if (!isMounted) return
          if (data) setOrders(data)
          setLoadingOrders(false)
        },
        () => { if (isMounted) setLoadingOrders(false) }
      )

    // Realtime: rates
    const ratesChannel = supabase.channel('dashboard-rates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rates' }, (payload) => {
        if (!isMounted) return
        const newRate = payload.new as Rates
        setRates((prev) => {
          if (prev && newRate.usdt_buy_inr > prev.usdt_buy_inr) setRateFlash('up')
          else if (prev && newRate.usdt_buy_inr < prev.usdt_buy_inr) setRateFlash('down')
          setTimeout(() => setRateFlash(null), 2000)
          return newRate
        })
      })
      .subscribe((status) => {
        if (!isMounted) return
        if (status === 'SUBSCRIBED') {
          setRtConnected(true)
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRtConnected(false)
        }
      })

    // Realtime: orders
    const ordersChannel = supabase.channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!isMounted) return
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) => prev.map((o) => o.id === (payload.new as Order).id ? payload.new as Order : o))
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(ratesChannel)
      supabase.removeChannel(ordersChannel)
    }
  }, [user?.id, supabase])

  const activeRate = orderType === 'BUY'
    ? (rates?.usdt_buy_inr ?? 91.5)
    : (rates?.usdt_sell_inr ?? 89.5)

  const handleInrChange = (val: string) => {
    setInrAmount(val)
    if (val) setInrError(validateINRAmount(parseFloat(val)).error || '')
    else setInrError('')
  }

  const handleSellUsdtChange = (val: string) => {
    setSellUsdtAmount(val)
    if (val) setSellUsdtError(validateUSDTAmount(val, activeRate).error || '')
    else setSellUsdtError('')
  }

  const handleAddrChange = (val: string) => {
    setWalletAddress(val)
    if (val) setAddrError(validateWalletAddress(val, network).error || '')
    else setAddrError('')
  }

  const handlePayoutChange = (val: string) => {
    setUserPayoutDetails(val)
    if (!val.trim()) {
      setPayoutError('Payout UPI ID or Bank account details are required.')
    } else if (val.trim().length < 4) {
      setPayoutError('Please enter valid payout details (at least 4 characters).')
    } else {
      setPayoutError('')
    }
  }

  const handleNetworkChange = (newNetwork: Network) => {
    setNetwork(newNetwork)
    setWalletAddress('')
    setAddrError('')
  }

  const inrNum = parseFloat(inrAmount) || 0
  const sellUsdtNum = parseFloat(sellUsdtAmount) || 0

  // Calculations
  const buyUsdtResult = calcUSDTFromINR(inrNum, activeRate)
  const sellInrResult = calcINRFromUSDT(sellUsdtNum, activeRate)

  const isAddressValid = orderType === 'BUY' ? validateWalletAddress(walletAddress, network).valid : true
  const isPayoutValid = orderType === 'SELL' ? (userPayoutDetails.trim().length >= 4 && !payoutError) : true

  const isBuyValid =
    !inrError &&
    inrNum >= MIN_INR_AMOUNT &&
    inrNum <= MAX_INR_AMOUNT &&
    isAddressValid &&
    !addrError &&
    !!walletAddress

  const isSellValid =
    !sellUsdtError &&
    sellUsdtNum > 0 &&
    sellInrResult >= MIN_INR_AMOUNT &&
    sellInrResult <= MAX_INR_AMOUNT &&
    isPayoutValid &&
    !!userPayoutDetails.trim()

  const formValid = orderType === 'BUY' ? isBuyValid : isSellValid

  const handleCreateOrder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSubmitError(null)

    // 1. Amount Limits Validation
    let finalInrAmount: number
    let finalUsdtAmount: number

    if (orderType === 'BUY') {
      if (inrNum < MIN_INR_AMOUNT || inrNum > MAX_INR_AMOUNT) {
        setSubmitError(`Amount must be between ₹${MIN_INR_AMOUNT.toLocaleString('en-IN')} and ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')}`)
        return
      }
      finalInrAmount = inrNum
      finalUsdtAmount = Number(buyUsdtResult.toFixed(4))
    } else {
      const inrValue = Number(sellInrResult.toFixed(2))
      if (sellUsdtNum <= 0 || inrValue < MIN_INR_AMOUNT || inrValue > MAX_INR_AMOUNT) {
        const minUsdt = (MIN_INR_AMOUNT / activeRate).toFixed(2)
        const maxUsdt = (MAX_INR_AMOUNT / activeRate).toFixed(2)
        setSubmitError(`Sell order must be between ${minUsdt} USDT and ${maxUsdt} USDT (₹${MIN_INR_AMOUNT.toLocaleString('en-IN')} – ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')})`)
        return
      }
      finalInrAmount = inrValue
      finalUsdtAmount = Number(sellUsdtNum.toFixed(4))
    }

    // 2. Buy vs Sell validation
    if (orderType === 'BUY') {
      const validation = validateWalletAddress(walletAddress, network)
      if (!validation.valid) {
        if (network === 'TRC20') {
          setSubmitError('Invalid TRC-20 Address. Must start with "T" and be 34 characters long.')
        } else {
          setSubmitError('Invalid BEP-20 Address. Must start with "0x" followed by 40 hex characters.')
        }
        return
      }
    } else {
      if (!userPayoutDetails.trim() || userPayoutDetails.trim().length < 4) {
        setSubmitError('Please enter your payout UPI ID or bank account details.')
        return
      }
    }

    setSubmitting(true)

    try {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
      const activeUser = currentUser || user

      if (userError && !activeUser) {
        throw new Error('Session expired. Please log in again.')
      }
      if (!activeUser) {
        throw new Error('Please log in to create an order.')
      }

      // ── Order Creation Guard: ban check + active order limit ──────────
      const guard = await checkOrderCreationAllowed(supabase, activeUser.id)
      if (!guard.allowed) {
        throw new Error(guard.error)
      }
      // ─────────────────────────────────────────────────────────────────

      // Ensure profile exists in profiles table before placing order (satisfies orders_user_id_fkey)
      if (!guard.profile && !profile) {
        try {
          await supabase.from('profiles').upsert({
            id: activeUser.id,
            email: activeUser.email || '',
            username: (activeUser.user_metadata?.username as string) || activeUser.email?.split('@')[0] || 'Trader',
            phone: (activeUser.user_metadata?.phone as string) || null,
            discord_id: (activeUser.user_metadata?.discord_id as string) || null,
            created_ip: (activeUser.user_metadata?.created_ip as string) || null,
            is_banned: false,
          }, { onConflict: 'id', ignoreDuplicates: true })
        } catch {
          // Ignore non-critical profile upsert failure
        }
      }

      // Insert order into Supabase
      const insertPayload: any = {
        user_id: activeUser.id,
        order_type: orderType,
        inr_amount: finalInrAmount,
        usdt_amount: finalUsdtAmount,
        rate_applied: activeRate,
        network: network,
        status: 'PENDING',
      }

      if (orderType === 'BUY') {
        insertPayload.wallet_address = walletAddress.trim()
        insertPayload.user_payout_details = null
      } else {
        insertPayload.wallet_address = null
        insertPayload.user_payout_details = userPayoutDetails.trim()
      }

      const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert([insertPayload])
        .select()
        .single()

      if (insertError) {
        console.error('[handleCreateOrder] Supabase insert error:', insertError)
        const detailedMsg =
          insertError.message ||
          insertError.details ||
          insertError.hint ||
          'Failed to save order to database.'
        throw new Error(detailedMsg)
      }

      // Trigger Discord Webhook Notification asynchronously
      sendDiscordOrderAlert({
        ...order,
        user_email: activeUser.email || (profile as any)?.email || guard.profile?.email,
        phone: guard.profile?.phone || (profile as any)?.phone || (activeUser.user_metadata as any)?.phone,
        discord_id: guard.profile?.discord_id || (profile as any)?.discord_id || (activeUser.user_metadata as any)?.discord_id,
      }).catch((err) => {
        console.error('[Discord Webhook] Failed to send order notification:', err)
      })

      // Redirect to the checkout page
      router.push(`/order/${order.id}`)
    } catch (err: any) {
      const errMsg =
        err?.message ||
        err?.error_description ||
        err?.details ||
        err?.hint ||
        (typeof err === 'string' ? err : 'Failed to create order. Please try again.')
      console.error('Failed to create order:', errMsg, err)
      setSubmitError(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-white/40 mt-0.5">
              Welcome back, <span className="text-white/70">{profile?.username || (user?.user_metadata?.username as string) || user?.email?.split('@')[0]}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {rtConnected === null ? null : rtConnected ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400/70">
                <WifiOff className="w-3.5 h-3.5" />
                Connecting…
              </span>
            )}
          </div>
        </div>

        {/* Rate banner */}
        {rates && (
          <div className={`bg-card p-5 transition-all duration-500 rounded-2xl border border-white/5 ${
            rateFlash === 'up' ? 'border-emerald-500/40 bg-emerald-500/5' :
            rateFlash === 'down' ? 'border-red-500/40 bg-red-500/5' : ''
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Live Exchange Rates</p>
                <div className="flex items-center gap-2">
                  <span className="live-dot" />
                  <span className="text-xs text-white/40">Real-time Exchange rates</span>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="text-center">
                  <p className="text-xs text-white/30 mb-1 flex items-center justify-center gap-1">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-400" /> Buy USDT
                  </p>
                  <p className={`text-2xl font-bold transition-colors ${rateFlash === 'up' ? 'text-emerald-400' : rateFlash === 'down' ? 'text-red-400' : 'text-white'}`}>
                    ₹{Number(rates.usdt_buy_inr).toFixed(2)}
                  </p>
                  <p className="text-xs text-white/30">per USDT</p>
                </div>
                <div className="w-px bg-white/5" />
                <div className="text-center">
                  <p className="text-xs text-white/30 mb-1 flex items-center justify-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-rose-400" /> Sell USDT
                  </p>
                  <p className="text-2xl font-bold text-white">₹{Number(rates.usdt_sell_inr).toFixed(2)}</p>
                  <p className="text-xs text-white/30">per USDT</p>
                </div>
              </div>
              {rateFlash && (
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${rateFlash === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {rateFlash === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  Rate Updated
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Trade Statistics & Analytics Widget */}
        <TradeStats />

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Order form */}
          <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-white/5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                Place Trade Order
              </h2>
            </div>

            {/* Dual-Tab Switcher: BUY USDT vs SELL USDT */}
            <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setOrderType('BUY')
                  setSubmitError(null)
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  orderType === 'BUY'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Buy USDT
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('SELL')
                  setSubmitError(null)
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                  orderType === 'SELL'
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Sell USDT
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              {/* Network Selector Tabs */}
              <div>
                <label className="block text-xs font-medium text-white/40 mb-2">
                  {orderType === 'BUY' ? 'Receiving Network' : 'USDT Deposit Network'}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleNetworkChange('TRC20')}
                    className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                      network === 'TRC20'
                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                    }`}
                  >
                    <Trc20Logo className="w-3.5 h-3.5" />
                    <span>TRC-20 (TRON)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNetworkChange('BEP20')}
                    className={`py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-2 ${
                      network === 'BEP20'
                        ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                    }`}
                  >
                    <Bep20Logo className="w-3.5 h-3.5" />
                    <span>BEP-20 (BNB Chain)</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              {orderType === 'BUY' ? (
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">
                    INR Amount to Pay{' '}
                    <span className="text-white/20">(₹1,000 – ₹50,000)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-semibold">₹</span>
                    <input
                      id="dashboard-inr-amount"
                      type="number"
                      min={1000}
                      max={50000}
                      step={100}
                      value={inrAmount}
                      onChange={(e) => handleInrChange(e.target.value)}
                      placeholder="Enter amount"
                      className={`input-field pl-8 ${inrError ? 'error' : inrNum >= 1000 && !inrError ? 'success' : ''}`}
                    />
                  </div>
                  {inrError && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {inrError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {BUY_PRESET_AMOUNTS.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => handleInrChange(String(amt))}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        ₹{amt >= 1000 ? `${amt / 1000}K` : amt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5">
                    USDT Amount to Sell{' '}
                    <span className="text-white/20">
                      (Min ~{(MIN_INR_AMOUNT / activeRate).toFixed(1)} USDT – Max ~{(MAX_INR_AMOUNT / activeRate).toFixed(1)} USDT)
                    </span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-semibold">USDT</span>
                    <input
                      id="dashboard-sell-usdt-amount"
                      type="number"
                      min={1}
                      step="any"
                      value={sellUsdtAmount}
                      onChange={(e) => handleSellUsdtChange(e.target.value)}
                      placeholder="Enter USDT amount to sell"
                      className={`input-field pl-14 ${sellUsdtError ? 'error' : sellUsdtNum > 0 && !sellUsdtError ? 'success' : ''}`}
                    />
                  </div>
                  {sellUsdtError && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {sellUsdtError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SELL_PRESET_AMOUNTS.map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => handleSellUsdtChange(String(amt))}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {amt} USDT
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Output summary box */}
              <div className="bg-white/3 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between text-xs text-white/30 mb-1">
                  <span>{orderType === 'BUY' ? 'You will receive' : 'You will receive (INR payout)'}</span>
                  <span>Rate: ₹{activeRate.toFixed(2)}/USDT</span>
                </div>
                {orderType === 'BUY' ? (
                  <p className="text-3xl font-bold text-emerald-400">
                    {inrNum >= 1000 ? buyUsdtResult.toFixed(4) : '0.0000'}{' '}
                    <span className="text-sm font-normal text-white/40">USDT</span>
                  </p>
                ) : (
                  <p className="text-3xl font-bold text-rose-400">
                    ₹{sellUsdtNum > 0 ? sellInrResult.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}{' '}
                    <span className="text-sm font-normal text-white/40">INR</span>
                  </p>
                )}
                <p className="text-xs text-white/40 mt-1">
                  {orderType === 'BUY' ? (
                    <>
                      Receiving Network:{' '}
                      <span className="text-white/70 font-semibold">
                        {network === 'TRC20' ? 'TRC-20 (TRON)' : 'BEP-20 (BNB Chain)'}
                      </span>
                    </>
                  ) : (
                    <>
                      Deposit Network:{' '}
                      <span className="text-white/70 font-semibold">
                        {network === 'TRC20' ? 'TRC-20 (TRON)' : 'BEP-20 (BNB Chain)'}
                      </span>
                      {sellUsdtNum > 0 && (
                        <span className="text-white/40 ml-2">
                          (You deposit {sellUsdtNum.toFixed(4)} USDT)
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>

              {/* Conditional: BUY = Wallet Address Input, SELL = Payout UPI/Bank Details */}
              {orderType === 'BUY' ? (
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-400" />
                    {network === 'TRC20' ? 'Your TRC-20 Payout Address (Starts with T)' : 'Your BEP-20 Payout Address (Starts with 0x)'}
                  </label>
                  <input
                    id="dashboard-wallet-address"
                    type="text"
                    value={walletAddress}
                    onChange={(e) => handleAddrChange(e.target.value)}
                    placeholder={network === 'TRC20' ? 'T... (34 characters)' : '0x... (42 characters)'}
                    className={`input-field font-mono text-xs ${addrError ? 'error' : isAddressValid && walletAddress ? 'success' : ''}`}
                    maxLength={network === 'TRC20' ? 34 : 42}
                  />
                  {addrError ? (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {addrError}
                    </p>
                  ) : isAddressValid && walletAddress && (
                    <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Valid {network === 'TRC20' ? 'TRC-20' : 'BEP-20'} address
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-white/40 mb-1.5 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-rose-400" />
                    Your Payout UPI ID / Bank Details (Where you receive INR)
                  </label>
                  <input
                    id="dashboard-payout-details"
                    type="text"
                    value={userPayoutDetails}
                    onChange={(e) => handlePayoutChange(e.target.value)}
                    placeholder="e.g. yourname@okhdfcbank or 9876543210@paytm"
                    className={`input-field text-xs font-mono ${payoutError ? 'error' : isPayoutValid && userPayoutDetails ? 'success' : ''}`}
                  />
                  {payoutError ? (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {payoutError}
                    </p>
                  ) : isPayoutValid && userPayoutDetails ? (
                    <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Payout destination set
                    </p>
                  ) : (
                    <p className="text-[11px] text-white/30 mt-1">
                      After admin verifies your USDT deposit, INR payout will be credited here.
                    </p>
                  )}
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!formValid || submitting}
                className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg ${
                  orderType === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                }`}
                id="dashboard-proceed-btn"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {orderType === 'BUY'
                        ? `Proceed to Buy USDT (${network})`
                        : `Proceed to Sell USDT (${network})`}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Orders list */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              Your Orders
              <span className="text-xs text-white/30 font-normal ml-auto">Live updates via Realtime</span>
            </h2>

            {loadingOrders ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card h-24 shimmer rounded-2xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-card p-10 text-center space-y-3 rounded-2xl border border-white/5">
                <Package className="w-10 h-10 text-white/10 mx-auto" />
                <p className="text-white/30 text-sm">No orders yet.</p>
                <p className="text-xs text-white/20">Fill in the form to place your first trade.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                {orders.map((order) => {
                  const isCancelled = order.status === 'CANCELLED'
                  const isCompleted = order.status === 'COMPLETED'
                  const isSell = order.order_type === 'SELL'

                  const cardInner = (
                    <>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <StatusBadge status={order.status} />

                            {/* Order Type Badge */}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                              isSell
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                              {order.order_type ?? 'BUY'}
                            </span>

                            {/* Network Badge */}
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${
                              order.network === 'BEP20'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/30'
                            }`}>
                              {order.network === 'BEP20' ? <Bep20Logo className="w-3 h-3 text-amber-400" /> : <Trc20Logo className="w-3 h-3 text-red-400" />}
                              USDT ({order.network ?? 'TRC20'})
                            </span>

                            <span className="text-xs text-white/20 font-mono">{order.id.slice(0, 8)}…</span>

                            {/* State indicators for Buy vs Sell */}
                            {!isSell && !order.assigned_upi_id && order.status === 'PENDING' && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 animate-pulse" /> Awaiting Payment Details
                              </span>
                            )}
                            {!isSell && order.assigned_upi_id && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && !order.payment_gateway_ref && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                Payment Details Ready
                              </span>
                            )}
                            {isSell && order.status === 'PENDING' && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5 animate-pulse" /> Awaiting Crypto Deposit
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatIST(order.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">
                            {formatINR(Number(order.inr_amount))}
                          </p>
                          <p className={`text-sm font-semibold ${isSell ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {isSell ? `Deposit ${Number(order.usdt_amount).toFixed(4)} USDT` : `→ ${Number(order.usdt_amount).toFixed(4)} USDT`}
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-white/5 pt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/30">Rate Applied</span>
                          <span className="text-white/60">₹{Number(order.rate_applied).toFixed(2)}/USDT</span>
                        </div>

                        {/* Destination or Payout Detail */}
                        {isSell ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/30">Your Payout UPI/Bank</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-rose-300 font-mono text-xs">
                                {order.user_payout_details || '—'}
                              </span>
                              {order.user_payout_details && <CopyButton text={order.user_payout_details} />}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/30">{order.network ?? 'TRC20'} Payout Address</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white/50 font-mono">
                                {(order.wallet_address || '').slice(0, 6)}…{(order.wallet_address || '').slice(-6)}
                              </span>
                              <CopyButton text={order.wallet_address || ''} />
                            </div>
                          </div>
                        )}

                        {order.payment_gateway_ref && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/30">{isSell ? 'Deposit TXID' : 'UTR Ref'}</span>
                            <span className="text-white/50 font-mono">{order.payment_gateway_ref}</span>
                          </div>
                        )}

                        {isCancelled ? (
                          <div className="pt-1 flex items-center justify-between text-xs text-red-400/80">
                            <span className="flex items-center gap-1.5 font-medium">
                              <XCircle className="w-3.5 h-3.5 text-red-400" /> Order Cancelled
                            </span>
                            <span className="text-white/30 text-[11px]">Checkout unavailable</span>
                          </div>
                        ) : (
                          <div className="pt-1 flex items-center justify-between text-xs text-violet-400 group-hover:text-violet-300">
                            <span>
                              {isCompleted ? 'View Order Details →' : isSell ? 'Deposit USDT & View Details →' : 'View Order Checkout & Payment →'}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        )}
                      </div>
                    </>
                  )

                  if (isCancelled) {
                    return (
                      <div
                        key={order.id}
                        className="block bg-card/60 p-5 rounded-2xl border border-white/5 opacity-75 cursor-default select-none"
                      >
                        {cardInner}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={order.id}
                      href={`/order/${order.id}`}
                      className="block bg-card p-5 card-hover group transition-colors hover:border-violet-500/30 rounded-2xl border border-white/5"
                    >
                      {cardInner}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
