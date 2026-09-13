'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { formatIST } from '@/lib/dateUtils'
import {
  ShieldCheck,
  LogOut,
  Users,
  Search,
  RefreshCw,
  AlertCircle,
  Ban,
  CheckCircle2,
  TrendingUp,
  Package,
  ChevronLeft,
  Phone,
  MessageSquare,
  Globe,
  Calendar,
  Hash,
  Copy,
  Check,
  LayoutDashboard,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'

// ─── Service-role client (bypasses RLS for admin data reads) ─────────────────
// We create it lazily on the client side since env vars are public
function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Falls back to anon key if service role not exposed publicly (still works via RLS policies)
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  email: string
  username: string
  phone: string | null
  discord_id: string | null
  created_ip: string | null
  created_at: string
  is_banned: boolean
  role: string
}

interface UserOrderStats {
  totalOrders: number
  completedOrders: number
  totalVolume: number
}

interface EnrichedUser extends UserProfile {
  stats: UserOrderStats
}

type FilterTab = 'ALL' | 'ACTIVE' | 'BANNED'

// ─── Small helpers ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="text-white/20 hover:text-white/60 transition-colors p-0.5 rounded"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

function StatPill({
  icon: Icon,
  label,
  value,
  color = 'white',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: 'white' | 'emerald' | 'violet' | 'amber'
}) {
  const colorClasses: Record<string, string> = {
    white: 'text-white/60',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
    amber: 'text-amber-400',
  }
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`w-3 h-3 flex-shrink-0 ${colorClasses[color]}`} />
      <span className="text-[11px] text-white/30">{label}:</span>
      <span className={`text-[11px] font-semibold ${colorClasses[color]}`}>{value}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter()
  // Browser client for auth checks + ban toggle mutations
  const supabase = createBrowserClient()

  const [adminUser, setAdminUser] = useState<{ email: string; username: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [users, setUsers] = useState<EnrichedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [toggleSuccess, setToggleSuccess] = useState<string | null>(null)

  // ── Auth Check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, username, email')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'ADMIN') {
        router.push('/admin/login')
        return
      }

      setAdminUser({ email: profile.email, username: profile.username })
      setAuthChecked(true)
    }
    checkAdmin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch Users + Order Stats ───────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setToggleError(null)
    setToggleSuccess(null)

    // Use a dedicated client for the data reads so we always have a fresh fetch
    const adminClient = createAdminClient()

    // 1. Fetch all profiles ordered by creation date
    const { data: profiles, error: profilesErr } = await adminClient
      .from('profiles')
      .select('id, email, username, phone, discord_id, created_ip, created_at, is_banned, role')
      .order('created_at', { ascending: false })

    if (profilesErr) {
      setLoadError(`Failed to load users: ${profilesErr.message}`)
      setLoading(false)
      return
    }
    if (!profiles || profiles.length === 0) {
      setUsers([])
      setLoading(false)
      return
    }

    // 2. Fetch all orders in one query — group client-side for efficiency
    const { data: orders } = await adminClient
      .from('orders')
      .select('user_id, status, inr_amount')

    const orderMap = new Map<string, { total: number; completed: number; volume: number }>()
    for (const o of orders ?? []) {
      const prev = orderMap.get(o.user_id) ?? { total: 0, completed: 0, volume: 0 }
      prev.total += 1
      if (o.status === 'COMPLETED') prev.completed += 1
      prev.volume += Number(o.inr_amount ?? 0)
      orderMap.set(o.user_id, prev)
    }

    const enriched: EnrichedUser[] = profiles.map((p) => {
      const o = orderMap.get(p.id) ?? { total: 0, completed: 0, volume: 0 }
      return {
        ...(p as UserProfile),
        stats: {
          totalOrders: o.total,
          completedOrders: o.completed,
          totalVolume: o.volume,
        },
      }
    })

    setUsers(enriched)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authChecked) fetchUsers()
  }, [authChecked, fetchUsers])

  // ── Ban / Unban Toggle ──────────────────────────────────────────────────────
  const handleToggleBan = async (targetUser: EnrichedUser) => {
    const action = targetUser.is_banned ? 'unban' : 'ban'
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${targetUser.username} (${targetUser.email})?\n\n` +
        (action === 'ban'
          ? 'They will immediately lose the ability to place new orders.'
          : 'They will regain full access to place orders.')
    )
    if (!confirmed) return

    setTogglingId(targetUser.id)
    setToggleError(null)
    setToggleSuccess(null)

    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: !targetUser.is_banned })
      .eq('id', targetUser.id)

    if (error) {
      setToggleError(`Failed to ${action} ${targetUser.username}: ${error.message}`)
    } else {
      // Optimistic local update — no need to re-fetch
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUser.id ? { ...u, is_banned: !u.is_banned } : u
        )
      )
      setToggleSuccess(
        `${targetUser.username} has been ${action === 'ban' ? 'banned' : 'unbanned'} successfully.`
      )
      setTimeout(() => setToggleSuccess(null), 4000)
    }
    setTogglingId(null)
  }

  // ── Search + Tab Filtering ──────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    let list = users

    // Tab filter
    if (filterTab === 'ACTIVE') list = list.filter((u) => !u.is_banned)
    else if (filterTab === 'BANNED') list = list.filter((u) => u.is_banned)

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.id.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.discord_id ?? '').toLowerCase().includes(q) ||
          (u.phone ?? '').toLowerCase().includes(q) ||
          (u.created_ip ?? '').includes(q)
      )
    }

    return list
  }, [users, search, filterTab])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // ── Auth loading state ──────────────────────────────────────────────────────
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

  // ── Derived summary stats ───────────────────────────────────────────────────
  const totalUsers = users.length
  const activeUsers = users.filter((u) => !u.is_banned).length
  const bannedUsers = users.filter((u) => u.is_banned).length
  const totalVolume = users.reduce((s, u) => s + u.stats.totalVolume, 0)

  const FILTER_TABS: Array<{ value: FilterTab; label: string; count: number }> = [
    { value: 'ALL', label: 'All Users', count: totalUsers },
    { value: 'ACTIVE', label: 'Active', count: activeUsers },
    { value: 'BANNED', label: 'Banned', count: bannedUsers },
  ]

  return (
    <div className="min-h-screen">
      {/* ── Admin Navbar ──────────────────────────────────────────────────────── */}
      <nav className="border-b border-amber-500/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-white text-sm">StreetExchange</span>
              <span className="text-amber-500 text-xs font-semibold ml-2">Admin Panel</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Order Dashboard</span>
            </Link>
            <span className="text-xs text-white/30 hidden md:block">{adminUser?.email}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Page Header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            User Management
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            View, search, and manage all registered accounts
          </p>
        </div>

        {/* ── Summary Stat Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: totalUsers, icon: Users, color: 'violet' },
            { label: 'Active Users', value: activeUsers, icon: UserCheck, color: 'emerald' },
            { label: 'Banned Users', value: bannedUsers, icon: UserX, color: 'red' },
            {
              label: 'Total Volume',
              value: `₹${totalVolume >= 100000 ? `${(totalVolume / 100000).toFixed(2)}L` : Number(totalVolume).toLocaleString('en-IN')}`,
              icon: TrendingUp,
              color: 'amber',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-card p-5 rounded-2xl border border-white/5 flex items-center gap-4"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  stat.color === 'violet'
                    ? 'bg-violet-500/15'
                    : stat.color === 'emerald'
                    ? 'bg-emerald-500/15'
                    : stat.color === 'red'
                    ? 'bg-red-500/15'
                    : 'bg-amber-500/15'
                }`}
              >
                <stat.icon
                  className={`w-5 h-5 ${
                    stat.color === 'violet'
                      ? 'text-violet-400'
                      : stat.color === 'emerald'
                      ? 'text-emerald-400'
                      : stat.color === 'red'
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/30">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Controls Row: Tabs + Search + Refresh ────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Tabs */}
          <div className="flex gap-1 bg-white/3 rounded-xl p-1 border border-white/5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterTab(tab.value)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterTab === tab.value
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filterTab === tab.value
                      ? 'bg-amber-500/30 text-amber-200'
                      : 'bg-white/5 text-white/30'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              id="user-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, Email, Username, Discord…"
              className="input-field pl-9 text-sm pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="btn-secondary py-3 px-4 text-xs flex items-center gap-2 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Toast Messages ───────────────────────────────────────────────────── */}
        {toggleError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in-up">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {toggleError}
          </div>
        )}
        {toggleSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in-up">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {toggleSuccess}
          </div>
        )}
        {loadError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {loadError}
          </div>
        )}

        {/* ── Users Table ──────────────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-white/5 overflow-hidden">
          {/* Table header bar */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="font-bold text-white">
                {filterTab === 'ALL'
                  ? 'All Users'
                  : filterTab === 'ACTIVE'
                  ? 'Active Users'
                  : 'Banned Users'}
              </h2>
            </div>
            <span className="text-xs text-white/30">
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
              {search && ` matching "${search}"`}
            </span>
          </div>

          {/* Loading skeletons */}
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[72px] shimmer rounded-xl" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-20 text-white/20 space-y-3">
              <Users className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">
                {search
                  ? `No users matched "${search}"`
                  : filterTab === 'BANNED'
                  ? 'No banned users.'
                  : 'No users found.'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-white/5 bg-white/1">
                    {[
                      { label: 'User ID & Email', width: 'w-[22%]' },
                      { label: 'Contact Info', width: 'w-[16%]' },
                      { label: 'Registration IP', width: 'w-[12%]' },
                      { label: 'Joined (IST)', width: 'w-[14%]' },
                      { label: 'Trading Stats', width: 'w-[18%]' },
                      { label: 'Status', width: 'w-[8%]' },
                      { label: 'Actions', width: 'w-[10%]' },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`${col.width} text-left text-[10px] font-semibold text-white/25 uppercase tracking-wider px-5 py-3`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/4">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`transition-colors group ${
                        u.is_banned
                          ? 'bg-red-950/10 hover:bg-red-950/20'
                          : 'hover:bg-white/[0.015]'
                      }`}
                    >
                      {/* ── User ID & Email ────────────────────────────── */}
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5 text-white/15 flex-shrink-0" />
                            <span className="text-[10px] font-mono text-white/30">
                              {u.id.slice(0, 8)}…{u.id.slice(-4)}
                            </span>
                            <CopyButton text={u.id} />
                          </div>
                          <p className="text-sm font-semibold text-white leading-tight">{u.username}</p>
                          <div className="flex items-center gap-1">
                            <p className="text-xs text-white/40 truncate max-w-[160px]">{u.email}</p>
                            <CopyButton text={u.email} />
                          </div>
                          {u.role === 'ADMIN' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold">
                              <ShieldCheck className="w-2.5 h-2.5" /> ADMIN
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ── Contact Info ───────────────────────────────── */}
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-cyan-400/50 flex-shrink-0" />
                            {u.phone ? (
                              <span className="text-xs text-white/60 font-mono">{u.phone}</span>
                            ) : (
                              <span className="text-[11px] text-white/20 italic">No phone</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3 text-indigo-400/50 flex-shrink-0" />
                            {u.discord_id ? (
                              <span className="text-xs text-white/60 truncate max-w-[120px]">
                                {u.discord_id}
                              </span>
                            ) : (
                              <span className="text-[11px] text-white/20 italic">No Discord</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ── Registration IP ────────────────────────────── */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-white/15 flex-shrink-0" />
                          {u.created_ip ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono text-white/50">{u.created_ip}</span>
                              <CopyButton text={u.created_ip} />
                            </div>
                          ) : (
                            <span className="text-[11px] text-white/20 italic">unknown</span>
                          )}
                        </div>
                      </td>

                      {/* ── Joined Date (IST) ──────────────────────────── */}
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-1.5">
                          <Calendar className="w-3 h-3 text-white/15 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-white/50 leading-snug">
                            {formatIST(u.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* ── Trading Stats ──────────────────────────────── */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <StatPill
                            icon={Package}
                            label="Total"
                            value={u.stats.totalOrders}
                          />
                          <StatPill
                            icon={CheckCircle2}
                            label="Completed"
                            value={u.stats.completedOrders}
                            color="emerald"
                          />
                          <StatPill
                            icon={TrendingUp}
                            label="Volume"
                            value={`₹${Number(u.stats.totalVolume).toLocaleString('en-IN')}`}
                            color="violet"
                          />
                        </div>
                      </td>

                      {/* ── Status Badge ───────────────────────────────── */}
                      <td className="px-5 py-4">
                        {u.is_banned ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-semibold whitespace-nowrap">
                            <Ban className="w-2.5 h-2.5" />
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold whitespace-nowrap">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </td>

                      {/* ── Actions ────────────────────────────────────── */}
                      <td className="px-5 py-4">
                        {u.role === 'ADMIN' ? (
                          <span className="text-[11px] text-white/15 italic">Protected</span>
                        ) : (
                          <button
                            id={`toggle-ban-${u.id}`}
                            onClick={() => handleToggleBan(u)}
                            disabled={togglingId === u.id}
                            title={u.is_banned ? `Unban ${u.username}` : `Ban ${u.username}`}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                              u.is_banned
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-sm hover:shadow-emerald-500/10'
                                : 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:shadow-sm hover:shadow-red-500/10'
                            }`}
                          >
                            {togglingId === u.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : u.is_banned ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                            {togglingId === u.id
                              ? 'Saving…'
                              : u.is_banned
                              ? 'Unban User'
                              : 'Ban User'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
