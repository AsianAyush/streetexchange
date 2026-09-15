'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Eye, EyeOff, LogIn, AlertCircle, Lock } from 'lucide-react'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Validate credentials against .env.local password via API route
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const apiResult = await res.json()

      if (!res.ok) {
        setError(apiResult.error || 'Invalid admin credentials.')
        setLoading(false)
        return
      }

      const targetEmail = apiResult.email || email.trim().toLowerCase()

      // 2. Authenticate session in Supabase with verified credentials
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password,
      })

      if (authError || !data.user) {
        setError(authError?.message || 'Authentication failed.')
        setLoading(false)
        return
      }

      // 3. Verify ADMIN role or is_admin flag
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', data.user.id)
        .single()

      const roleStr = (profile?.role || '').toString().toUpperCase()
      const isAdmin = roleStr === 'ADMIN' || profile?.is_admin === true

      if (!profile || !isAdmin) {
        await supabase.auth.signOut()
        setError('Access denied. This portal is restricted to administrators only.')
        setLoading(false)
        return
      }

      router.push('/admin/dashboard')
    } catch (err) {
      console.error(err)
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 animate-scale-in">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mx-auto">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
            <p className="text-sm text-white/30 mt-1">
              <span className="text-amber-500/70">StreetExchange</span> — Restricted Access
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
            <Lock className="w-3 h-3" />
            RBAC Enforced — Admin Role Required
          </div>
        </div>

        {/* Form */}
        <div className="bg-[rgba(255,255,255,0.03)] border border-amber-500/10 rounded-2xl p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" id="admin-login-form">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-medium text-white/40 mb-1.5">
                Admin Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@streetexchange.com"
                className="input-field"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-xs font-medium text-white/40 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
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
              id="admin-login-btn"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Verifying…' : 'Access Admin Panel'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/15">
          Unauthorized access attempts are logged and reported.
        </p>
      </div>
    </div>
  )
}
