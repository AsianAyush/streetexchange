'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'
import { formatIST } from '@/lib/dateUtils'
import {
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Clock,
  Coins,
  ShieldCheck,
} from 'lucide-react'

type Order = Tables<'orders'>

interface TradeStatsProps {
  userId?: string
  className?: string
  compact?: boolean
}

export function TradeStats({ userId, className = '', compact = false }: TradeStatsProps) {
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeUserId, setActiveUserId] = useState<string | null>(userId || null)

  useEffect(() => {
    if (userId) {
      setActiveUserId(userId)
      return
    }

    // If userId wasn't provided, resolve current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setActiveUserId(user.id)
      else setLoading(false)
    })
  }, [userId, supabase])

  useEffect(() => {
    const uid = activeUserId
    if (!uid) return

    let isMounted = true

    async function fetchStats(targetUserId: string) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })

      if (isMounted) {
        if (!error && data) {
          setOrders(data)
        }
        setLoading(false)
      }
    }

    fetchStats(uid)

    // Realtime channel for order updates
    const channel = supabase
      .channel(`trade-stats-${uid}-${compact ? 'compact' : 'full'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          if (!isMounted) return
          if (payload.eventType === 'INSERT') {
            setOrders((prev) => [payload.new as Order, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((o) => (o.id === (payload.new as Order).id ? (payload.new as Order) : o))
            )
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((o) => o.id !== (payload.old as Order).id))
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [activeUserId, supabase, compact])

  if (loading) {
    return (
      <div className={`bg-card p-4 rounded-2xl border border-white/5 animate-pulse ${className}`}>
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Compute metrics
  const totalOrders = orders.length
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED')
  const completedCount = completedOrders.length
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length

  const totalInrVolume = completedOrders.reduce((sum, o) => sum + Number(o.inr_amount || 0), 0)
  const totalUsdtVolume = completedOrders.reduce((sum, o) => sum + Number(o.usdt_amount || 0), 0)

  // Find most recent completion time
  const latestCompletedOrder = completedOrders
    .filter((o) => o.completed_at || o.updated_at)
    .sort((a, b) => {
      const dateA = new Date(a.completed_at || a.updated_at).getTime()
      const dateB = new Date(b.completed_at || b.updated_at).getTime()
      return dateB - dateA
    })[0]

  const lastCompletedDate = latestCompletedOrder
    ? formatIST(latestCompletedOrder.completed_at || latestCompletedOrder.updated_at)
    : 'No completed trades yet'

  const completionRate = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0

  if (compact) {
    return (
      <div className={`bg-white/3 border border-white/5 rounded-xl p-3 text-xs space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-white/50 flex items-center gap-1 font-semibold">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            User Trade Summary
          </span>
          <span className="text-emerald-400 font-semibold">{completionRate}% Success Rate</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-black/20 p-2 rounded-lg border border-white/5">
            <span className="text-white/40 block text-[10px]">Total Orders</span>
            <span className="font-bold text-white text-sm">{totalOrders}</span>
          </div>
          <div className="bg-black/20 p-2 rounded-lg border border-white/5">
            <span className="text-white/40 block text-[10px]">Completed / Cancelled</span>
            <span className="font-bold text-emerald-400 text-sm">{completedCount}</span>
            <span className="text-white/30 text-xs"> / </span>
            <span className="font-bold text-red-400 text-sm">{cancelledCount}</span>
          </div>
          <div className="bg-black/20 p-2 rounded-lg border border-white/5">
            <span className="text-white/40 block text-[10px]">Volume Traded (INR)</span>
            <span className="font-bold text-violet-300 text-sm">
              ₹{totalInrVolume.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-black/20 p-2 rounded-lg border border-white/5">
            <span className="text-white/40 block text-[10px]">Volume Traded (USDT)</span>
            <span className="font-bold text-emerald-400 text-sm">
              {totalUsdtVolume.toFixed(2)} USDT
            </span>
          </div>
        </div>
        <div className="text-[11px] text-white/40 flex items-center gap-1 pt-1 border-t border-white/5">
          <Clock className="w-3 h-3 text-white/30" />
          <span>Last Completion: <strong className="text-white/60">{lastCompletedDate}</strong></span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-card p-5 rounded-2xl border border-white/5 space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Trade Statistics & Analytics</h3>
            <p className="text-xs text-white/40">Verified lifetime trade activity and volume</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            {completionRate}% Completion Rate
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Orders */}
        <div className="bg-white/3 border border-white/5 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-white/40 text-xs mb-1">
            <span>Total Orders</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-white">{totalOrders}</p>
          <p className="text-[11px] text-white/30 mt-0.5">Orders placed</p>
        </div>

        {/* Completed Orders */}
        <div className="bg-white/3 border border-white/5 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-white/40 text-xs mb-1">
            <span>Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-400">{completedCount}</p>
          <p className="text-[11px] text-white/30 mt-0.5">Successfully settled</p>
        </div>

        {/* Cancelled Orders */}
        <div className="bg-white/3 border border-white/5 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-white/40 text-xs mb-1">
            <span>Cancelled</span>
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          </div>
          <p className="text-2xl font-extrabold text-red-400">{cancelledCount}</p>
          <p className="text-[11px] text-white/30 mt-0.5">Cancelled / Voided</p>
        </div>

        {/* Total INR Volume */}
        <div className="bg-white/3 border border-white/5 p-3.5 rounded-xl">
          <div className="flex items-center justify-between text-white/40 text-xs mb-1">
            <span>INR Volume</span>
            <Coins className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-violet-300 truncate">
            ₹{totalInrVolume.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">Completed INR value</p>
        </div>

        {/* Total USDT Volume */}
        <div className="bg-white/3 border border-white/5 p-3.5 rounded-xl col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-white/40 text-xs mb-1">
            <span>USDT Volume</span>
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 truncate">
            {totalUsdtVolume.toFixed(2)}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">USDT transferred</p>
        </div>
      </div>

      {/* Footer Details */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/5 text-xs text-white/40">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-violet-400" />
          <span>
            Last Completed Trade:{' '}
            <strong className="text-white/70 font-semibold">{lastCompletedDate}</strong>
          </span>
        </div>
        <span className="text-[11px] text-white/20">Updated live via Realtime</span>
      </div>
    </div>
  )
}
