'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthProvider'
import {
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  ExternalLink,
} from 'lucide-react'

export default function RegisterPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [phone, setPhone] = useState('')
  const [discordId, setDiscordId] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const passwordMatch = password && confirmPw && password === confirmPw
  const passwordLong = password.length >= 8

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!passwordMatch) {
      setError('Passwords do not match.')
      return
    }
    if (!passwordLong) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!phone.trim()) {
      setError('Phone number is required.')
      return
    }
    if (!discordId.trim()) {
      setError('Discord username / ID is required.')
      return
    }

    setLoading(true)

    // ── IP Rate Limiting ──────────────────────────────────────────
    let userIp = ''
    try {
      const ipRes = await fetch('https://api.ipify.org?format=json')
      const ipData = await ipRes.json()
      userIp = ipData.ip as string
    } catch {
      // If IP fetch fails, we proceed without blocking (fail open)
      userIp = ''
    }

    if (userIp) {
      const { count, error: countError } = await supabase
        .from('ip_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('ip', userIp)

      if (!countError && count !== null && count >= 3) {
        setError('Maximum account limit reached for this IP address (Max 3 accounts).')
        setLoading(false)
        return
      }
    }
    // ─────────────────────────────────────────────────────────────

    const cleanEmail = email.trim().toLowerCase()
    const cleanUsername = username.trim()

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          username: cleanUsername,
          phone: phone.trim(),
          discord_id: discordId.trim(),
          created_ip: userIp || null,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const newUserId = signUpData.user?.id
    if (newUserId) {
      // Insert IP registration record
      if (userIp) {
        await supabase.from('ip_registrations').insert({
          ip: userIp,
          user_id: newUserId,
        })
      }

      // Update profiles with additional fields
      await supabase.from('profiles').upsert({
        id: newUserId,
        email: cleanEmail,
        username: cleanUsername,
        phone: phone.trim(),
        discord_id: discordId.trim(),
        created_ip: userIp || null,
        is_banned: false,
      })
    }

    // Show the success screen briefly, then redirect.
    // We call router.replace directly here instead of relying on the
    // AuthProvider useEffect, because when Supabase email confirmation is
    // enabled, signUp returns session=null and SIGNED_IN never fires —
    // so the useEffect approach silently stalls.
    setSuccess(true)
    setLoading(false)
    // Short delay so the success animation is visible, then navigate.
    setTimeout(() => {
      router.replace('/dashboard')
    }, 1500)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hero-radial px-4">
        <div className="text-center space-y-5 animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Account Created!</h2>
          <p className="text-white/50 text-sm max-w-sm">
            Welcome to StreetExchange! Taking you to your dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero-radial px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-scale-in">

        {/* Logo */}
        <div className="text-center space-y-3">
          <Link href="/" className="inline-block group">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl shadow-violet-500/25 border border-white/10 bg-black/40 group-hover:scale-105 group-hover:shadow-violet-500/40 transition-all mx-auto flex items-center justify-center">
              <Image
                src="/logos/streetexchangelogo.png"
                alt="StreetExchange Logo"
                width={64}
                height={64}
                className="w-full h-full object-cover"
                priority
              />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-sm text-white/40">Start trading INR to USDT in minutes</p>
        </div>

        {/* Discord Community Banner */}
        <a
          href="https://discord.gg/XhGGT7XGXq"
          target="_blank"
          rel="noopener noreferrer"
          id="discord-community-banner"
          className="group flex items-center gap-4 p-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/8 hover:bg-indigo-500/15 hover:border-indigo-500/50 transition-all duration-200"
          style={{ textDecoration: 'none' }}
        >
          {/* Discord icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-indigo-200 group-hover:text-indigo-100 transition-colors">
              Join our Discord Community
            </p>
            <p className="text-xs text-indigo-400/70 truncate">
              Get support, updates & connect with traders → discord.gg/XhGGT7XGXq
            </p>
          </div>
          <ExternalLink className="w-4 h-4 text-indigo-400/60 group-hover:text-indigo-300 flex-shrink-0 transition-colors" />
        </a>

        {/* Form card */}
        <div className="bg-card p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5" id="register-form">
            {/* Username */}
            <div>
              <label htmlFor="reg-username" className="block text-xs font-medium text-white/50 mb-1.5">
                Username
              </label>
              <input
                id="reg-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tradername123"
                className="input-field"
                autoComplete="username"
                minLength={3}
                maxLength={30}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-white/50 mb-1.5">
                Email address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="reg-phone" className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-cyan-400" />
                Phone Number
              </label>
              <input
                id="reg-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="input-field"
                autoComplete="tel"
                pattern="^\+?[\d\s\-\(\)]{7,20}$"
                title="Enter a valid phone number (7–20 digits, can include +, spaces, dashes, parentheses)"
              />
              <p className="text-[11px] text-white/25 mt-1">International format supported (e.g. +1 555 000 1234)</p>
            </div>

            {/* Discord Username / ID */}
            <div>
              <label htmlFor="reg-discord" className="block text-xs font-medium text-white/50 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                Discord Username / ID
              </label>
              <input
                id="reg-discord"
                type="text"
                required
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="username#0000 or username"
                className="input-field"
                minLength={2}
                maxLength={50}
              />
              <p className="text-[11px] text-white/25 mt-1">Used for support — join our Discord above to get help</p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-white/50 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className={`input-field pr-10 ${password && passwordLong ? 'success' : ''}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reg-confirm-password" className="block text-xs font-medium text-white/50 mb-1.5">
                Confirm Password
              </label>
              <input
                id="reg-confirm-password"
                type={showPw ? 'text' : 'password'}
                required
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat your password"
                className={`input-field ${confirmPw && !passwordMatch ? 'error' : confirmPw && passwordMatch ? 'success' : ''}`}
                autoComplete="new-password"
              />
              {confirmPw && !passwordMatch && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Passwords don&apos;t match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              id="register-submit-btn"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <p className="text-sm text-white/40">
            Already have an account?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
