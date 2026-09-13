'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/context/AuthProvider'
import { Eye, EyeOff, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanEmail = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Don't manually push here — the useEffect watching `user` will redirect
    // once onAuthStateChange fires and AuthProvider updates. Pushing immediately
    // caused a race where the dashboard saw user=null and redirected back to /login.
    // Keep loading=true so the button stays disabled until the redirect happens.
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-hero-radial px-4">
      <div className="w-full max-w-md space-y-8 animate-scale-in">

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
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm text-white/40">Sign in to your StreetExchange account</p>
        </div>

        {/* Form card */}
        <div className="bg-card p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" id="login-form">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-white/50 mb-1.5">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-white/50 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pr-10"
                  autoComplete="current-password"
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

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              id="login-submit-btn"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="text-center space-y-3">
          <p className="text-sm text-white/40">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Create one free
            </Link>
          </p>
          <p className="text-xs text-white/20">
            Admin?{' '}
            <Link href="/admin/login" className="text-amber-500/60 hover:text-amber-400 transition-colors">
              Admin portal →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
