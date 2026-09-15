'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { TradeStats } from '@/components/TradeStats'
import { Trc20Logo, Bep20Logo } from '@/components/NetworkLogos'
import { formatIST } from '@/lib/dateUtils'
import {
  validateTRC20Address,
  validateBEP20Address,
} from '@/lib/validation'
import {
  ShieldCheck,
  LogOut,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  AlertCircle,
  Check,
  X,
  Play,
  QrCode,
  Send,
  Edit3,
  Copy,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  ToggleLeft,
  ToggleRight,
  CreditCard,
  Zap,
} from 'lucide-react'

type Order = Tables<'orders'> & { profiles?: { username: string; email: string } }
type Rates = Tables<'rates'>
type OrderStatus = Order['status']
type FilterType = 'ALL' | 'NEEDS_UPI' | 'BUY' | 'SELL' | OrderStatus

const STATUS_FILTERS: Array<{ value: FilterType; label: string }> = [
  { value: 'ALL', label: 'All Orders' },
  { value: 'NEEDS_UPI', label: '⏳ Awaiting UPI (Buy)' },
  { value: 'BUY', label: '🟢 Buy Orders' },
  { value: 'SELL', label: '🔴 Sell Orders' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'AWAITING_VERIFICATION', label: 'Awaiting Verification' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function StatusBadge({ status }: { status: OrderStatus }) {
  const classes: Record<OrderStatus, string> = {
    PENDING: 'badge badge-pending',
    AWAITING_VERIFICATION: 'badge badge-pending',
    IN_PROGRESS: 'badge badge-in-progress',
    COMPLETED: 'badge badge-completed',
    CANCELLED: 'badge badge-cancelled',
  }
  const labels: Record<OrderStatus, string> = {
    PENDING: '⏳ Pending',
    AWAITING_VERIFICATION: '⏳ Awaiting Verification',
    IN_PROGRESS: '🔄 In Progress',
    COMPLETED: '✅ Completed',
    CANCELLED: '✗ Cancelled',
  }
  return <span className={classes[status] || 'badge badge-pending'}>{labels[status] || status}</span>
}

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
      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/70 hover:text-white"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {label ? (copied ? 'Copied!' : label) : (copied ? 'Copied' : 'Copy')}
    </button>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [adminUser, setAdminUser] = useState<{ email: string; username: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Rates state
  const [rates, setRates] = useState<Rates | null>(null)
  const [buyRate, setBuyRate] = useState('')
  const [sellRate, setSellRate] = useState('')
  const [rateUpdating, setRateUpdating] = useState(false)
  const [rateSuccess, setRateSuccess] = useState(false)
  const [rateError, setRateError] = useState('')

  // Admin Wallet Config state
  const [adminTrc20, setAdminTrc20] = useState('')
  const [adminBep20, setAdminBep20] = useState('')
  const [walletUpdating, setWalletUpdating] = useState(false)
  const [walletSuccess, setWalletSuccess] = useState(false)
  const [walletError, setWalletError] = useState('')

  // Orders state
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FilterType>('ALL')
  const [search, setSearch] = useState('')
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [expandedUserStats, setExpandedUserStats] = useState<Record<string, boolean>>({})

  // UPI assignment state (for BUY orders)
  const [upiInputs, setUpiInputs] = useState<Record<string, string>>({})
  const [assigningUpiId, setAssigningUpiId] = useState<string | null>(null)
  const [editingUpiOrderId, setEditingUpiOrderId] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<Record<string, string>>({})
  const [assignSuccess, setAssignSuccess] = useState<Record<string, string>>({})

  // Payment Gateway Settings state
  const [allowManualPayment, setAllowManualPayment] = useState<boolean>(true)
  const [paymentSettingLoading, setPaymentSettingLoading] = useState(false)
  const [paymentSettingUpdating, setPaymentSettingUpdating] = useState(false)
  const [paymentSettingSuccess, setPaymentSettingSuccess] = useState(false)
  const [paymentSettingError, setPaymentSettingError] = useState('')

  // fetchOrders — defined before any useEffect that references it (const is NOT hoisted)
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(username, email)')
      .order('created_at', { ascending: false })
    if (data) setOrders(data as Order[])
    setLoadingOrders(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  // Stats
  const totalVolume = orders.reduce((s, o) => s + Number(o.inr_amount), 0)
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length
  const inProgressCount = orders.filter((o) => o.status === 'IN_PROGRESS').length
  const buyCount = orders.filter((o) => (o.order_type || 'BUY') === 'BUY').length
  const sellCount = orders.filter((o) => o.order_type === 'SELL').length
  const awaitingUpiCount = orders.filter(
    (o) => (o.order_type || 'BUY') === 'BUY' && !o.assigned_upi_id && o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  ).length

  // Auth check
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, username, email, is_admin')
        .eq('id', user.id)
        .single()

      const roleStr = (profile?.role || '').toString().toUpperCase()
      const isAdmin = roleStr === 'ADMIN' || profile?.is_admin === true

      if (!profile || !isAdmin) {
        console.warn('Unauthorized admin access attempt:', user.email, profile)
        router.push('/admin/login')
        return
      }

      setAdminUser({ email: profile.email, username: profile.username })
      setAuthChecked(true)
    }
    checkAdmin()
  }, [router, supabase])

  // Fetch data after auth confirmed
  useEffect(() => {
    if (!authChecked) return

    let isMounted = true

    // Fetch rates
    supabase.from('rates').select('*').order('updated_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data && isMounted) {
          setRates(data)
          setBuyRate(String(data.usdt_buy_inr))
          setSellRate(String(data.usdt_sell_inr))
        }
      })

    // Fetch admin wallet configs
    supabase.from('system_configs').select('*')
      .then(({ data }) => {
        if (data && isMounted) {
          data.forEach((c) => {
            if (c.key === 'admin_trc20_address') setAdminTrc20(c.value)
            if (c.key === 'admin_bep20_address') setAdminBep20(c.value)
          })
        }
      })

    // Fetch all orders with user info via join
    fetchOrders()

    // Fetch payment gateway settings
    supabase.auth.getSession().then(({ data: { session } }) => {
      const headers: Record<string, string> = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      fetch('/api/admin/settings', { headers })
        .then((r) => r.json())
        .then((data) => {
          if (isMounted && typeof data.allow_manual_payment === 'boolean') {
            setAllowManualPayment(data.allow_manual_payment)
          }
        })
        .catch((err) => {
          console.warn('Failed to load admin settings:', err)
        })
        .finally(() => { if (isMounted) setPaymentSettingLoading(false) })
    })

    // Realtime subscriptions
    const ratesChannel = supabase.channel('admin-rates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rates' }, (payload) => {
        if (isMounted) setRates(payload.new as Rates)
      })
      .subscribe()

    const configsChannel = supabase.channel('admin-system-configs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_configs' }, () => {
        supabase.from('system_configs').select('*').then(({ data }) => {
          if (data && isMounted) {
            data.forEach((c) => {
              if (c.key === 'admin_trc20_address') setAdminTrc20(c.value)
              if (c.key === 'admin_bep20_address') setAdminBep20(c.value)
            })
          }
        })
      })
      .subscribe()

    const ordersChannel = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (!isMounted) return
        if (payload.eventType === 'INSERT') {
          fetchOrders()
        } else if (payload.eventType === 'UPDATE') {
          setOrders((prev) => prev.map((o) => o.id === (payload.new as Order).id
            ? { ...o, ...payload.new } : o))
        }
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(ratesChannel)
      supabase.removeChannel(configsChannel)
      supabase.removeChannel(ordersChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, fetchOrders])

  const handleUpdateRates = async () => {
    if (!adminUser || !rates) return
    const buy = parseFloat(buyRate)
    const sell = parseFloat(sellRate)
    if (isNaN(buy) || isNaN(sell) || buy <= 0 || sell <= 0) {
      setRateError('Rates must be positive numbers.')
      return
    }
    if (sell >= buy) {
      setRateError('Sell rate should be less than buy rate (spread).')
      return
    }

    setRateUpdating(true)
    setRateError('')

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('rates').update({
      usdt_buy_inr: buy,
      usdt_sell_inr: sell,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }).eq('id', rates.id)

    if (error) {
      setRateError(error.message)
    } else {
      setRateSuccess(true)
      setTimeout(() => setRateSuccess(false), 3000)
    }
    setRateUpdating(false)
  }

  const handleUpdateWallets = async () => {
    setWalletError('')

    const trimmedTrc20 = adminTrc20.trim()
    const trimmedBep20 = adminBep20.trim()

    if (!trimmedTrc20 || !trimmedBep20) {
      setWalletError('Both TRC-20 and BEP-20 deposit wallet addresses are required.')
      return
    }

    const trcCheck = validateTRC20Address(trimmedTrc20)
    if (!trcCheck.valid) {
      setWalletError(`TRC-20 Address error: ${trcCheck.error}`)
      return
    }

    const bepCheck = validateBEP20Address(trimmedBep20)
    if (!bepCheck.valid) {
      setWalletError(`BEP-20 Address error: ${bepCheck.error}`)
      return
    }

    setWalletUpdating(true)

    try {
      const now = new Date().toISOString()
      const { error: upsertErr } = await supabase.from('system_configs').upsert([
        { key: 'admin_trc20_address', value: trimmedTrc20, updated_at: now },
        { key: 'admin_bep20_address', value: trimmedBep20, updated_at: now },
      ])

      if (upsertErr) throw upsertErr

      setWalletSuccess(true)
      setTimeout(() => setWalletSuccess(false), 3000)
    } catch (err: any) {
      setWalletError(err?.message || 'Failed to update deposit wallet addresses.')
    } finally {
      setWalletUpdating(false)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId)
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString()
    }

    await supabase.from('orders').update(updateData).eq('id', orderId)
    setUpdatingOrderId(null)
  }

  const handleAssignUpi = async (orderId: string) => {
    const rawUpi = upiInputs[orderId]?.trim()
    if (!rawUpi) {
      setAssignError((prev) => ({ ...prev, [orderId]: 'Please enter a valid UPI ID.' }))
      return
    }

    setAssigningUpiId(orderId)
    setAssignError((prev) => ({ ...prev, [orderId]: '' }))

    const order = orders.find((o) => o.id === orderId)
    const nextStatus: OrderStatus = order?.status === 'PENDING' ? 'IN_PROGRESS' : (order?.status ?? 'IN_PROGRESS')

    const { error } = await supabase
      .from('orders')
      .update({
        assigned_upi_id: rawUpi,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)

    if (error) {
      setAssignError((prev) => ({ ...prev, [orderId]: error.message }))
    } else {
      setAssignSuccess((prev) => ({ ...prev, [orderId]: 'UPI payment details assigned & sent!' }))
      setEditingUpiOrderId(null)
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, assigned_upi_id: rawUpi, status: nextStatus } : o))
      )
      setTimeout(() => {
        setAssignSuccess((prev) => {
          const next = { ...prev }
          delete next[orderId]
          return next
        })
      }, 3000)
    }
    setAssigningUpiId(null)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const handleToggleManualPayment = async () => {
    const newValue = !allowManualPayment
    setPaymentSettingUpdating(true)
    setPaymentSettingError('')
    setPaymentSettingSuccess(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ allow_manual_payment: newValue }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update setting')
      setAllowManualPayment(newValue)
      setPaymentSettingSuccess(true)
      setTimeout(() => setPaymentSettingSuccess(false), 3000)
    } catch (err: any) {
      setPaymentSettingError(err?.message || 'Failed to update payment setting.')
    } finally {
      setPaymentSettingUpdating(false)
    }
  }

  const toggleUserStats = (orderId: string) => {
    setExpandedUserStats((prev) => ({ ...prev, [orderId]: !prev[orderId] }))
  }

  const filteredOrders = orders.filter((order) => {
    if (statusFilter === 'NEEDS_UPI') {
      if ((order.order_type || 'BUY') !== 'BUY' || order.assigned_upi_id || order.status === 'COMPLETED' || order.status === 'CANCELLED') return false
    } else if (statusFilter === 'BUY') {
      if ((order.order_type || 'BUY') !== 'BUY') return false
    } else if (statusFilter === 'SELL') {
      if (order.order_type !== 'SELL') return false
    } else if (statusFilter !== 'ALL' && order.status !== statusFilter) {
      return false
    }

    if (search) {
      const s = search.toLowerCase()
      return (
        order.id.toLowerCase().includes(s) ||
        (order.wallet_address || '').toLowerCase().includes(s) ||
        (order.user_payout_details || '').toLowerCase().includes(s) ||
        (order.order_type || '').toLowerCase().includes(s) ||
        (order.network || '').toLowerCase().includes(s) ||
        order.user_id.toLowerCase().includes(s) ||
        (order.profiles?.username?.toLowerCase().includes(s)) ||
        (order.profiles?.email?.toLowerCase().includes(s)) ||
        (order.payment_gateway_ref?.toLowerCase().includes(s)) ||
        (order.assigned_upi_id?.toLowerCase().includes(s))
      )
    }
    return true
  })

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-white/30">Verifying admin credentials…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Admin navbar */}
      <nav className="border-b border-amber-500/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">StreetExchange</span>
              <span className="text-amber-500 text-xs font-semibold ml-2">Admin Panel</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30 hidden sm:block">{adminUser?.email}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Volume', value: `₹${(totalVolume / 100000).toFixed(2)}L`, icon: TrendingUp, color: 'violet' },
            { label: 'Buy Orders', value: String(buyCount), icon: ArrowDownLeft, color: 'emerald' },
            { label: 'Sell Orders', value: String(sellCount), icon: ArrowUpRight, color: 'rose' },
            { label: 'Awaiting UPI', value: String(awaitingUpiCount), icon: Clock, color: 'amber' },
            { label: 'In Progress', value: String(inProgressCount), icon: RefreshCw, color: 'blue' },
            { label: 'Completed', value: String(completedCount), icon: CheckCircle2, color: 'emerald' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card p-5 rounded-2xl border border-white/5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                stat.color === 'violet' ? 'bg-violet-500/15' :
                stat.color === 'amber' ? 'bg-amber-500/15' :
                stat.color === 'emerald' ? 'bg-emerald-500/15' :
                stat.color === 'rose' ? 'bg-rose-500/15' : 'bg-blue-500/15'
              }`}>
                <stat.icon className={`w-5 h-5 ${
                  stat.color === 'violet' ? 'text-violet-400' :
                  stat.color === 'amber' ? 'text-amber-400' :
                  stat.color === 'emerald' ? 'text-emerald-400' :
                  stat.color === 'rose' ? 'text-rose-400' : 'text-blue-400'
                }`} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/30">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Rate Modifier Panel */}
        <div className="bg-card p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="font-bold text-white">Dynamic Rate Modifier</h2>
            <span className="text-xs text-white/30 ml-auto">
              Current: Buy ₹{rates ? Number(rates.usdt_buy_inr).toFixed(2) : '—'} / Sell ₹{rates ? Number(rates.usdt_sell_inr).toFixed(2) : '—'}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="admin-buy-rate" className="block text-xs font-medium text-white/40 mb-1.5">
                USDT Buy Rate (₹ per USDT - Users Buy from Platform)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                <input
                  id="admin-buy-rate"
                  type="number"
                  step="0.01"
                  min="1"
                  value={buyRate}
                  onChange={(e) => setBuyRate(e.target.value)}
                  className="input-field pl-8"
                  placeholder="91.50"
                />
              </div>
            </div>
            <div>
              <label htmlFor="admin-sell-rate" className="block text-xs font-medium text-white/40 mb-1.5">
                USDT Sell Rate (₹ per USDT - Users Sell to Platform)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">₹</span>
                <input
                  id="admin-sell-rate"
                  type="number"
                  step="0.01"
                  min="1"
                  value={sellRate}
                  onChange={(e) => setSellRate(e.target.value)}
                  className="input-field pl-8"
                  placeholder="89.50"
                />
              </div>
            </div>
          </div>

          {rateError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {rateError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleUpdateRates}
              disabled={rateUpdating}
              id="admin-publish-rates-btn"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {rateUpdating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4" />
              )}
              {rateUpdating ? 'Publishing…' : 'Publish Live Rates'}
            </button>
            {rateSuccess && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in-up">
                <Check className="w-4 h-4" />
                Rates published! Users will see updated rates instantly.
              </div>
            )}
          </div>
        </div>

        {/* Admin Crypto Deposit Wallet Configuration Panel */}
        <div className="bg-card p-6 rounded-2xl border border-white/5 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <h2 className="font-bold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-violet-400" />
              Crypto Deposit Wallet Configuration (Sell USDT Flow)
            </h2>
            <span className="text-xs text-white/30 ml-auto">
              System Escrow Wallets for User Crypto Deposits
            </span>
          </div>
          <p className="text-xs text-white/40">
            When users initiate a <strong>Sell USDT</strong> order, these active addresses will be presented to the user to send their crypto.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="admin-trc20-input" className="block text-xs font-medium text-white/40 mb-1.5 flex items-center gap-1.5">
                <Trc20Logo className="w-3.5 h-3.5 text-red-400" />
                Admin TRC-20 (TRON) Deposit Wallet
              </label>
              <input
                id="admin-trc20-input"
                type="text"
                value={adminTrc20}
                onChange={(e) => setAdminTrc20(e.target.value)}
                placeholder="T... (34 characters)"
                className="input-field font-mono text-xs"
                maxLength={34}
              />
              <p className="text-[11px] text-white/30 mt-1">Must begin with &apos;T&apos; and be 34 Base58 characters.</p>
            </div>

            <div>
              <label htmlFor="admin-bep20-input" className="block text-xs font-medium text-white/40 mb-1.5 flex items-center gap-1.5">
                <Bep20Logo className="w-3.5 h-3.5 text-amber-400" />
                Admin BEP-20 (BNB Chain) Deposit Wallet
              </label>
              <input
                id="admin-bep20-input"
                type="text"
                value={adminBep20}
                onChange={(e) => setAdminBep20(e.target.value)}
                placeholder="0x... (42 characters)"
                className="input-field font-mono text-xs"
                maxLength={42}
              />
              <p className="text-[11px] text-white/30 mt-1">Must begin with &apos;0x&apos; and be 42 hexadecimal characters.</p>
            </div>
          </div>

          {walletError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {walletError}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleUpdateWallets}
              disabled={walletUpdating}
              id="admin-save-wallets-btn"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-violet-600/20"
            >
              {walletUpdating ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              {walletUpdating ? 'Saving Wallets…' : 'Save System Wallets'}
            </button>
            {walletSuccess && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in-up">
                <Check className="w-4 h-4" />
                System deposit addresses updated! All Sell USDT checkouts now show these addresses.
              </div>
            )}
          </div>
        </div>

        {/* Payment Gateway Settings Panel */}
        <div className="bg-card p-6 rounded-2xl border border-white/5 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-cyan-400" />
              Payment Gateway Settings
            </h2>
            <span className="text-xs text-white/30 ml-auto">
              Platform-wide payment controls
            </span>
          </div>

          <p className="text-xs text-white/40">
            Toggle manual UPI payment on or off for <strong>all users</strong>. When disabled, users
            on the Buy checkout page will only be able to pay via the <strong>BondPay</strong> instant
            gateway — the manual QR/UTR entry option is hidden.
          </p>

          {/* Toggle Row */}
          <div className="flex items-center justify-between bg-white/3 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${
                allowManualPayment ? 'bg-emerald-500/15' : 'bg-amber-500/15'
              }`}>
                {allowManualPayment
                  ? <QrCode className="w-5 h-5 text-emerald-400" />
                  : <Zap className="w-5 h-5 text-amber-400" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Allow Manual Payment / UPI Submissions
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {allowManualPayment
                    ? 'Manual UPI / QR code payments are currently ENABLED platform-wide'
                    : 'Manual payments are DISABLED — users must use BondPay / Instant UPI'}
                </p>
              </div>
            </div>

            {/* Animated toggle switch */}
            <button
              id="admin-manual-payment-toggle"
              type="button"
              onClick={handleToggleManualPayment}
              disabled={paymentSettingUpdating}
              aria-pressed={allowManualPayment}
              aria-label="Toggle manual payment"
              className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 ${
                allowManualPayment
                  ? 'bg-emerald-500 focus-visible:ring-emerald-500'
                  : 'bg-white/15 focus-visible:ring-amber-500'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                  allowManualPayment ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Status / feedback row */}
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              allowManualPayment
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {allowManualPayment
                ? <><ToggleRight className="w-3.5 h-3.5" /> Manual Payment: ON</>
                : <><ToggleLeft className="w-3.5 h-3.5" /> Manual Payment: OFF — BondPay Only</>}
            </div>
            {paymentSettingUpdating && (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
            )}
            {paymentSettingSuccess && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in-up">
                <Check className="w-4 h-4" />
                Setting updated! Changes are live for all users.
              </div>
            )}
            {paymentSettingError && (
              <div className="flex items-center gap-1.5 text-sm text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> {paymentSettingError}
              </div>
            )}
          </div>
        </div>

        {/* Order Management Panel */}
        <div className="bg-card p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="font-bold text-white">Order Management System</h2>
            <span className="text-xs text-white/30 ml-auto">{filteredOrders.length} orders</span>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex gap-1 bg-white/3 rounded-xl p-1 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    statusFilter === f.value
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order ID, address, payout details, username…"
                className="input-field pl-9 py-2 text-xs"
              />
            </div>
            <button onClick={fetchOrders} className="btn-secondary py-2 px-3 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* Orders table */}
          {loadingOrders ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 shimmer rounded-xl" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-white/20 space-y-2">
              <Package className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">No orders found for the selected filter.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
              {filteredOrders.map((order) => {
                const isSell = order.order_type === 'SELL'
                const isExpanded = !!expandedUserStats[order.id]

                return (
                  <div key={order.id} className="bg-white/2 border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors space-y-3">
                    <div className="flex flex-wrap items-start gap-4 justify-between">
                      {/* Left side: identity & details */}
                      <div className="space-y-2 flex-1 min-w-48">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={order.status} />

                          {/* Order Type Badge */}
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                            isSell
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {order.order_type ?? 'BUY'}
                          </span>

                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border flex items-center gap-1 ${
                            order.network === 'BEP20'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}>
                            {order.network === 'BEP20' ? <Bep20Logo className="w-3 h-3 text-amber-400" /> : <Trc20Logo className="w-3 h-3 text-red-400" />}
                            {order.network ?? 'TRC20'}
                          </span>

                          <span className="text-xs text-white/20 font-mono">{order.id.slice(0, 12)}…</span>
                          <CopyButton text={order.id} label="ID" />
                        </div>

                        <div className="text-xs space-y-1">
                          <p className="text-white/50">
                            <span className="text-white/20">User: </span>
                            <span className="text-white/70 font-medium">
                              {order.profiles?.username ?? order.user_id.slice(0, 8)}
                            </span>
                            <span className="text-white/20 ml-1">({order.profiles?.email ?? '—'})</span>
                          </p>

                          {/* Destination Payout or Wallet Address */}
                          {isSell ? (
                            <p className="text-white/50">
                              <span className="text-rose-400/70 font-semibold">User Payout (UPI/Bank): </span>
                              <span className="font-mono text-rose-300 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 select-all">
                                {order.user_payout_details || 'Not provided'}
                              </span>
                              {order.user_payout_details && <CopyButton text={order.user_payout_details} />}
                            </p>
                          ) : (
                            <p className="text-white/50 font-mono">
                              <span className="text-white/20">User Wallet: </span>
                              {order.wallet_address || '—'}
                              {order.wallet_address && <CopyButton text={order.wallet_address} />}
                            </p>
                          )}

                          {order.payment_gateway_ref && (
                            <p className="text-white/50">
                              <span className="text-white/20">{isSell ? 'User Crypto TXID: ' : 'UTR Ref: '}</span>
                              <span className="font-mono text-emerald-400 font-semibold select-all">{order.payment_gateway_ref}</span>
                              <CopyButton text={order.payment_gateway_ref} />
                            </p>
                          )}

                          <p className="text-white/25 text-xs">
                            Placed: {formatIST(order.created_at)}
                            {order.completed_at && (
                              <span className="ml-2 text-emerald-400/60">
                                • Completed: {formatIST(order.completed_at)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Center: amounts */}
                      <div className="text-right space-y-1">
                        <p className="font-bold text-white text-lg">₹{Number(order.inr_amount).toLocaleString('en-IN')}</p>
                        <p className={`font-semibold text-sm ${isSell ? 'text-rose-400' : 'text-violet-400'}`}>
                          {isSell ? `Deposit: ${Number(order.usdt_amount).toFixed(4)} USDT` : `Dispatch: ${Number(order.usdt_amount).toFixed(4)} USDT`}
                        </p>
                        <p className="text-white/30 text-xs">@ ₹{Number(order.rate_applied).toFixed(2)}/USDT</p>
                      </div>

                      {/* Right: action controls */}
                      <div className="flex flex-col gap-2 min-w-32">
                        {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                          <>
                            {order.status === 'PENDING' && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, 'IN_PROGRESS')}
                                disabled={updatingOrderId === order.id}
                                className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                              >
                                {updatingOrderId === order.id ? (
                                  <div className="w-3.5 h-3.5 border border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                                ) : <Play className="w-3.5 h-3.5" />}
                                In Progress
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                              disabled={updatingOrderId === order.id}
                              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                            >
                              {updatingOrderId === order.id ? (
                                <div className="w-3.5 h-3.5 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                              ) : <Check className="w-3.5 h-3.5" />}
                              Complete
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(order.id, 'CANCELLED')}
                              disabled={updatingOrderId === order.id}
                              className="flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                              {updatingOrderId === order.id ? (
                                <div className="w-3.5 h-3.5 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                              ) : <X className="w-3.5 h-3.5" />}
                              Cancel
                            </button>
                          </>
                        )}
                        {(order.status === 'COMPLETED' || order.status === 'CANCELLED') && (
                          <span className="text-xs text-white/20 text-center py-2">Terminal state</span>
                        )}

                        {/* Button to toggle inline user trade analytics */}
                        <button
                          type="button"
                          onClick={() => toggleUserStats(order.id)}
                          className="flex items-center justify-center gap-1 text-[11px] text-white/40 hover:text-white transition py-1"
                        >
                          <Activity className="w-3 h-3 text-cyan-400" />
                          <span>{isExpanded ? 'Hide User Stats' : 'User Stats'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Dedicated Ticket UPI Assignment Section (BUY Orders Only) */}
                    {!isSell && (
                      <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        {order.assigned_upi_id && editingUpiOrderId !== order.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-white/40 flex items-center gap-1">
                              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                              Assigned UPI:
                            </span>
                            <span className="font-mono font-bold text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded border border-violet-500/20 select-all">
                              {order.assigned_upi_id}
                            </span>
                            <CopyButton text={order.assigned_upi_id} />
                            {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                              <button
                                onClick={() => {
                                  setEditingUpiOrderId(order.id)
                                  setUpiInputs((prev) => ({ ...prev, [order.id]: order.assigned_upi_id || '' }))
                                }}
                                className="text-amber-400 hover:text-amber-300 underline text-[11px] ml-1 flex items-center gap-0.5"
                              >
                                <Edit3 className="w-3 h-3" /> Change UPI
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold text-[11px] flex items-center gap-1">
                                <Clock className="w-3 h-3 animate-pulse text-amber-400" />
                                {order.assigned_upi_id ? 'Change Assigned UPI' : 'Awaiting UPI Assignment (User Waiting)'}
                              </span>
                              <span className="text-white/40 text-[11px]">
                                Enter the UPI ID for the user to make payment:
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                placeholder="e.g. streetexchange.p2p@icici"
                                value={upiInputs[order.id] ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setUpiInputs((prev) => ({ ...prev, [order.id]: v }))
                                  setAssignError((prev) => ({ ...prev, [order.id]: '' }))
                                }}
                                className="input-field py-1.5 px-3 text-xs font-mono max-w-xs flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => setUpiInputs((prev) => ({ ...prev, [order.id]: 'streetexchange.p2p@icici' }))}
                                className="text-[10px] px-2 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition"
                                title="Insert default ICICI UPI"
                              >
                                + default icici
                              </button>
                              <button
                                onClick={() => handleAssignUpi(order.id)}
                                disabled={assigningUpiId === order.id || !upiInputs[order.id]?.trim()}
                                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1 font-semibold disabled:opacity-40"
                              >
                                {assigningUpiId === order.id ? (
                                  <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                {assigningUpiId === order.id ? 'Sending…' : 'Assign & Send UPI ID'}
                              </button>
                              {editingUpiOrderId === order.id && (
                                <button
                                  onClick={() => setEditingUpiOrderId(null)}
                                  className="text-white/40 hover:text-white text-xs px-2 py-1"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>

                            {assignError[order.id] && (
                              <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" /> {assignError[order.id]}
                              </p>
                            )}
                            {assignSuccess[order.id] && (
                              <p className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                                <CheckCircle2 className="w-3 h-3" /> {assignSuccess[order.id]}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline User Profile Trade Statistics widget (toggled by admin) */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-white/5">
                        <TradeStats userId={order.user_id} compact />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
