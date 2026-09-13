'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthProvider'
import { Tables } from '@/lib/database.types'
import {
  formatINR,
  calcUSDTFromINR,
  calcINRFromUSDT,
  validateINRAmount,
  validateUSDTAmount,
  validateTRC20Address,
  validateWalletAddress,
  Network,
  MIN_INR_AMOUNT,
  MAX_INR_AMOUNT,
} from '@/lib/validation'
import { Trc20Logo, Bep20Logo } from '@/components/NetworkLogos'
import {
  LogIn,
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  Zap,
  Lock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  Globe,
  CheckCircle2,
  Users,
  RefreshCw,
  AlertCircle,
  CreditCard,
  Wallet,
} from 'lucide-react'

type Rates = Tables<'rates'>

// Ticker data
const TICKER_ITEMS = [
  { pair: 'USDT/INR', value: '89.50', change: '+0.12%', up: true },
  { pair: 'BTC/USDT', value: '67,842', change: '+2.3%', up: true },
  { pair: 'ETH/USDT', value: '3,420', change: '-0.8%', up: false },
  { pair: 'TRX/USDT', value: '0.1432', change: '+1.5%', up: true },
  { pair: 'BNB/USDT', value: '612.40', change: '+0.6%', up: true },
]

function LiveTicker({ rate }: { rate: number }) {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS] // duplicate for infinite scroll
  return (
    <div className="bg-[#0d0d15] border-b border-white/5 overflow-hidden py-2">
      <div className="flex gap-12 animate-ticker whitespace-nowrap" style={{ width: 'max-content' }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-xs">
            <span className="text-white/30 font-mono">{item.pair}</span>
            <span className="text-white/70 font-semibold font-mono">
              {item.pair === 'USDT/INR' ? rate.toFixed(2) : item.value}
            </span>
            <span className={`flex items-center gap-0.5 ${item.up ? 'text-emerald-400' : 'text-red-400'}`}>
              {item.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickCalculator({ rates }: { rates: Rates | null }) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'BUY' | 'SELL'>('BUY')
  const [inr, setInr] = useState('')
  const [sellUsdt, setSellUsdt] = useState('')
  const [network, setNetwork] = useState<Network>('TRC20')
  const [address, setAddress] = useState('')
  const [payoutDetails, setPayoutDetails] = useState('')
  const [inrError, setInrError] = useState('')
  const [sellUsdtError, setSellUsdtError] = useState('')
  const [addrError, setAddrError] = useState('')
  const [payoutError, setPayoutError] = useState('')

  const activeBuyRate = rates?.usdt_buy_inr ?? 91.5
  const activeSellRate = rates?.usdt_sell_inr ?? 89.5

  const inrNum = parseFloat(inr) || 0
  const buyUsdt = calcUSDTFromINR(inrNum, activeBuyRate)

  const sellUsdtNum = parseFloat(sellUsdt) || 0
  const sellInr = calcINRFromUSDT(sellUsdtNum, activeSellRate)

  const handleInrChange = (val: string) => {
    setInr(val)
    if (val) {
      const res = validateINRAmount(parseFloat(val))
      setInrError(res.error || '')
    } else {
      setInrError('')
    }
  }

  const handleSellUsdtChange = (val: string) => {
    setSellUsdt(val)
    if (val) {
      const res = validateUSDTAmount(val, activeSellRate)
      setSellUsdtError(res.error || '')
    } else {
      setSellUsdtError('')
    }
  }

  const handleNetworkChange = (net: Network) => {
    setNetwork(net)
    setAddress('')
    setAddrError('')
  }

  const handleAddrChange = (val: string) => {
    setAddress(val)
    if (val) {
      const res = validateWalletAddress(val, network)
      setAddrError(res.error || '')
    } else {
      setAddrError('')
    }
  }

  const handlePayoutChange = (val: string) => {
    setPayoutDetails(val)
    if (!val.trim()) {
      setPayoutError('Payout details are required.')
    } else if (val.trim().length < 4) {
      setPayoutError('Enter valid UPI ID or bank details (min 4 chars).')
    } else {
      setPayoutError('')
    }
  }

  const isAddressValid = validateWalletAddress(address, network).valid
  const isPayoutValid = payoutDetails.trim().length >= 4 && !payoutError

  const canProceedBuy =
    !inrError && inrNum >= MIN_INR_AMOUNT && inrNum <= MAX_INR_AMOUNT && isAddressValid && address.length > 0

  const canProceedSell =
    !sellUsdtError &&
    sellUsdtNum > 0 &&
    sellInr >= MIN_INR_AMOUNT &&
    sellInr <= MAX_INR_AMOUNT &&
    isPayoutValid &&
    payoutDetails.trim().length > 0

  return (
    <div className="bg-card p-6 space-y-4 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white/70">Quick Trade Calculator</h3>
        {rates && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="live-dot" />
            Live: ₹{tab === 'BUY' ? activeBuyRate : activeSellRate}/USDT
          </div>
        )}
      </div>

      {/* Tab Switcher: Buy USDT vs Sell USDT */}
      <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10">
        <button
          type="button"
          onClick={() => setTab('BUY')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === 'BUY'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          Buy USDT
        </button>
        <button
          type="button"
          onClick={() => setTab('SELL')}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
            tab === 'SELL'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
              : 'text-white/40 hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          Sell USDT
        </button>
      </div>

      {tab === 'BUY' ? (
        <>
          {/* INR input for BUY */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">You Pay (INR)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-semibold">₹</span>
              <input
                type="number"
                value={inr}
                onChange={(e) => handleInrChange(e.target.value)}
                placeholder="1,000 – 50,000"
                className={`input-field pl-8 ${inrError ? 'error' : inrNum >= 1000 && !inrError ? 'success' : ''}`}
                id="home-inr-amount"
              />
            </div>
            {inrError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {inrError}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              {[1000, 5000, 10000, 25000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleInrChange(String(amt))}
                  className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  ₹{(amt / 1000).toFixed(0)}K
                </button>
              ))}
            </div>
          </div>

          {/* Network Selector Tabs */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-2">Select Network</label>
            <div className="grid grid-cols-2 gap-2">
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

          {/* USDT output */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-white/30 mb-1">You Receive (USDT {network === 'TRC20' ? 'TRC-20' : 'BEP-20'})</p>
            <p className="text-2xl font-bold gradient-text">
              {inrNum >= 1000 ? buyUsdt.toFixed(4) : '0.0000'}
              <span className="text-sm font-normal text-white/30 ml-2">USDT</span>
            </p>
            <p className="text-xs text-white/30 mt-1">
              Rate: ₹{activeBuyRate} per USDT
            </p>
          </div>

          {/* Wallet Address */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">
              {network === 'TRC20' ? 'TRC-20 Wallet Address' : 'BEP-20 Wallet Address'}
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => handleAddrChange(e.target.value)}
              placeholder={network === 'TRC20' ? 'T... (34 characters)' : '0x... (42 characters)'}
              className={`input-field font-mono text-xs ${addrError ? 'error' : isAddressValid && address ? 'success' : ''}`}
              id="home-wallet-address"
              maxLength={network === 'TRC20' ? 34 : 42}
            />
            {addrError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {addrError}
              </p>
            )}
            {isAddressValid && address && !addrError && (
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid {network === 'TRC20' ? 'TRC-20' : 'BEP-20'} address
              </p>
            )}
          </div>

          <Link
            href={canProceedBuy ? `/dashboard?type=BUY&inr=${inr}&addr=${address}&net=${network}` : user ? '/dashboard' : '/register'}
            className={`btn-primary w-full ${!canProceedBuy && !user ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {canProceedBuy ? 'Proceed to Checkout' : user ? 'Go to Dashboard' : 'Start Trading'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </>
      ) : (
        <>
          {/* USDT input for SELL */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">
              You Sell (USDT)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs font-semibold">USDT</span>
              <input
                type="number"
                min={1}
                step="any"
                value={sellUsdt}
                onChange={(e) => handleSellUsdtChange(e.target.value)}
                placeholder="Enter USDT to sell (e.g. 100)"
                className={`input-field pl-14 ${sellUsdtError ? 'error' : sellUsdtNum > 0 && !sellUsdtError ? 'success' : ''}`}
                id="home-sell-usdt-amount"
              />
            </div>
            {sellUsdtError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {sellUsdtError}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              {[20, 50, 100, 250, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleSellUsdtChange(String(amt))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {amt} USDT
                </button>
              ))}
            </div>
          </div>

          {/* Deposit Network Selector */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-2">Deposit Network</label>
            <div className="grid grid-cols-2 gap-2">
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

          {/* INR payout output for SELL */}
          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
            <p className="text-xs text-white/30 mb-1">You Receive (INR Payout)</p>
            <p className="text-2xl font-bold text-rose-400">
              ₹{sellUsdtNum > 0 ? sellInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              <span className="text-sm font-normal text-white/30 ml-2">INR</span>
            </p>
            <p className="text-xs text-white/30 mt-1">
              Rate: ₹{activeSellRate} per USDT
            </p>
          </div>

          {/* Payout Details */}
          <div>
            <label className="block text-xs font-medium text-white/40 mb-1.5">
              Payout UPI ID / Bank Account Details
            </label>
            <input
              type="text"
              value={payoutDetails}
              onChange={(e) => handlePayoutChange(e.target.value)}
              placeholder="e.g. yourname@okhdfcbank or Bank A/C No + IFSC"
              className={`input-field font-mono text-xs ${payoutError ? 'error' : isPayoutValid ? 'success' : ''}`}
              id="home-payout-details"
            />
            {payoutError && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {payoutError}
              </p>
            )}
            {isPayoutValid && (
              <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Payout account ready
              </p>
            )}
          </div>

          <Link
            href={
              canProceedSell
                ? `/dashboard?type=SELL&usdt=${sellUsdt}&payout=${encodeURIComponent(payoutDetails)}&net=${network}`
                : user
                ? '/dashboard?type=SELL'
                : '/register'
            }
            className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-rose-500/25 ${
              !canProceedSell && !user ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {canProceedSell ? 'Proceed to Sell USDT' : user ? 'Go to Dashboard' : 'Start Trading'}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </>
      )}
    </div>
  )
}

const FEATURES = [
  {
    icon: Shield,
    title: 'Escrow-Protected',
    description: 'Every transaction is held in escrow until your TRC-20 delivery is confirmed. Zero counterparty risk.',
    color: 'emerald',
  },
  {
    icon: Zap,
    title: 'Live Rates',
    description: 'Real-time USDT/INR exchange rates. No stale quotes ever.',
    color: 'amber',
  },
  {
    icon: Lock,
    title: 'TRC-20 Verified',
    description: 'Strict Base58 address validation ensures every USDT lands in the exact wallet you specify.',
    color: 'violet',
  },
  {
    icon: Clock,
    title: 'Fast Settlement',
    description: '15-minute payment window with instant USDT dispatch upon UTR verification.',
    color: 'cyan',
  },
  {
    icon: Globe,
    title: 'India-Focused',
    description: 'Designed for Indian traders: UPI, IMPS, and NEFT payment options with ₹1K–₹50K limits.',
    color: 'blue',
  },
  {
    icon: RefreshCw,
    title: 'P2P Model',
    description: 'No centralized order book. Direct peer-to-peer trading with admin-verified settlements.',
    color: 'pink',
  },
]

const COLOR_MAP: Record<string, string> = {
  emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20',
  amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/20',
  violet: 'from-violet-500/20 to-violet-500/5 border-violet-500/20',
  cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
  blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
  pink: 'from-pink-500/20 to-pink-500/5 border-pink-500/20',
}

const ICON_COLOR: Record<string, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  violet: 'text-violet-400',
  cyan: 'text-cyan-400',
  blue: 'text-blue-400',
  pink: 'text-pink-400',
}

const STATS = [
  { label: 'Active Traders', value: '2,400+', icon: Users },
  { label: 'Total Volume', value: '₹4.2 Cr', icon: TrendingUp },
  { label: 'Avg Settlement', value: '< 10 min', icon: Clock },
  { label: 'Uptime', value: '99.98%', icon: CheckCircle2 },
]

export default function HomePage() {
  const { user } = useAuth()
  const [rates, setRates] = useState<Rates | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Fetch initial rates
    supabase
      .from('rates')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setRates(data)
      })

    // Subscribe to realtime
    const channel = supabase
      .channel('home-rates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rates' },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            setRates(payload.new as Rates)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen">
      {/* Live ticker */}
      <LiveTicker rate={rates?.usdt_buy_inr ?? 89.5} />

      {/* Hero */}
      <section className="bg-hero-radial relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-cyan-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div className="space-y-8 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold">
                <span className="live-dot" />
                Live P2P Exchange
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
                  Buy USDT with{' '}
                  <span className="gradient-text">INR</span>
                  <br />
                  Instantly.
                </h1>
                <p className="text-lg text-white/50 leading-relaxed max-w-lg">
                  India&apos;s most trusted P2P exchange.
                  <br /><br />
                  Convert ₹ to USDT (TRC-20 &amp; BEP-20) at live rates with escrow-backed security. No middleman, no delays.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {user ? (
                  <Link href="/dashboard" className="btn-primary">
                    Go to Dashboard
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link href="/register" className="btn-primary">
                    Start Trading Free
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                )}
                <Link href="/about" className="btn-secondary">
                  How It Works
                </Link>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-white/30 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: calculator */}
            <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
              <QuickCalculator rates={rates} />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">How StreetExchange Works</h2>
            <p className="text-white/40 mt-3 max-w-xl mx-auto">
              A simple, secure 4-step P2P process to get USDT into your wallet within minutes.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Create Order', desc: 'Enter INR amount (₹1K–₹50K) and your TRC-20 wallet address.' },
              { step: '02', title: 'Pay via UPI', desc: 'Transfer INR to our UPI ID with your unique reference. 15-min window.' },
              { step: '03', title: 'Submit UTR', desc: 'Enter your 12-digit UTR/IMPS reference to confirm the payment.' },
              { step: '04', title: 'Receive USDT', desc: 'Admin verifies & dispatches USDT (TRC-20) directly to your wallet.' },
            ].map((item) => (
              <div key={item.step} className="relative bg-card p-6 card-hover group">
                <div className="text-4xl font-black text-white/5 absolute top-4 right-4 group-hover:text-white/10 transition-colors">
                  {item.step}
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center mb-4 text-sm font-bold text-white">
                  {item.step}
                </div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white">Built for Indian Crypto Traders</h2>
            <p className="text-white/40 mt-3 max-w-xl mx-auto">
              Enterprise-grade security and real-time infrastructure at P2P simplicity.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`bg-gradient-to-br ${COLOR_MAP[feature.color]} border rounded-2xl p-6 card-hover`}
              >
                <feature.icon className={`w-8 h-8 ${ICON_COLOR[feature.color]} mb-4`} />
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-bold">
            Ready to trade?{' '}
            <span className="gradient-text">Start in 60 seconds.</span>
          </h2>
          <p className="text-white/40 text-lg">
            No KYC delays. Create your account, verify your TRC-20 wallet, and place your first order instantly.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            {user ? (
              <Link href="/dashboard" className="btn-primary text-base px-8 py-4">
                Go to Dashboard
                <ChevronRight className="w-5 h-5" />
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn-primary text-base px-8 py-4">
                  Create Free Account
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <Link href="/login" className="btn-secondary text-base px-8 py-4">
                  <LogIn className="w-5 h-5" />
                  Sign In
                </Link>
              </>
            )}
          </div>
          <p className="text-xs text-white/20">
            By registering, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-white/50 transition-colors">
              Terms of Service
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
