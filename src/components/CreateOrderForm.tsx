'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateWalletAddress, Network } from '@/lib/validation'
import { Trc20Logo, Bep20Logo } from '@/components/NetworkLogos'
import { sendDiscordOrderAlert, checkOrderCreationAllowed } from '@/lib/createOrderGuard'

export function CreateOrderForm({ liveRate }: { liveRate: number }) {
  const [inrAmount, setInrAmount] = useState<number>(1000)
  const [network, setNetwork] = useState<Network>('TRC20')
  const [walletAddress, setWalletAddress] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const router = useRouter()

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // 1. Amount Limits Validation
    if (inrAmount < 1000 || inrAmount > 50000) {
      setError('Amount must be between ₹1,000 and ₹50,000')
      return
    }

    // 2. Network Address Regex Validation
    const validation = validateWalletAddress(walletAddress, network)
    if (!validation.valid) {
      if (network === 'TRC20') {
        setError('Invalid TRC-20 Address. Must start with "T" and be 34 characters long.')
      } else {
        setError('Invalid BEP-20 Address. Must start with "0x" followed by 40 hex characters.')
      }
      return
    }

    setLoading(true)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Session expired. Please log in again.')

      // Check order guard (ban & active order limit) and fetch profile
      const guard = await checkOrderCreationAllowed(supabase, user.id)
      if (!guard.allowed) {
        throw new Error(guard.error || 'You cannot place orders at this time.')
      }

      // Ensure profile exists in profiles table before placing order (satisfies orders_user_id_fkey)
      if (!guard.profile) {
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email || '',
            username: (user.user_metadata?.username as string) || user.email?.split('@')[0] || 'Trader',
            phone: (user.user_metadata?.phone as string) || null,
            discord_id: (user.user_metadata?.discord_id as string) || null,
            created_ip: (user.user_metadata?.created_ip as string) || null,
            is_banned: false,
          }, { onConflict: 'id', ignoreDuplicates: true })
        } catch {
          // Ignore non-critical profile upsert failure
        }
      }

      const usdtAmount = Number((inrAmount / liveRate).toFixed(4))

      // 3. Insert order with network and wallet address
      const { data: order, error: insertError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: user.id,
            order_type: 'BUY',
            inr_amount: inrAmount,
            usdt_amount: usdtAmount,
            rate_applied: liveRate,
            network: network,
            wallet_address: walletAddress.trim(),
            status: 'PENDING'
          }
        ])
        .select()
        .single()

      if (insertError) {
        console.error('[CreateOrderForm] Supabase insert error:', insertError)
        const detailedMsg =
          insertError.message ||
          insertError.details ||
          insertError.hint ||
          'Failed to save order to database.'
        throw new Error(detailedMsg)
      }

      sendDiscordOrderAlert({
        ...order,
        user_email: user.email || guard.profile?.email,
        phone: guard.profile?.phone || (user.user_metadata as any)?.phone,
        discord_id: guard.profile?.discord_id || (user.user_metadata as any)?.discord_id,
      }).catch((err) => {
        console.error('[Discord Webhook] Failed to send order notification:', err)
      })

      // 4. Redirect to Checkout Page
      router.push(`/order/${order.id}`)
    } catch (err: any) {
      const errMsg =
        err?.message ||
        err?.error_description ||
        err?.details ||
        err?.hint ||
        (typeof err === 'string' ? err : 'Failed to create order. Please try again.')
      console.error('Failed to create order:', errMsg, err)
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleCreateOrder} className="space-y-5 bg-slate-900 p-6 rounded-xl border border-slate-800">
      <h3 className="text-lg font-semibold text-white">Buy USDT</h3>

      {/* Network Selector Tabs */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-2">Select Network</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setNetwork('TRC20'); setWalletAddress(''); setError(null); }}
            className={`py-2.5 px-4 rounded-lg text-sm font-semibold border transition-all flex items-center justify-center gap-2 ${
              network === 'TRC20'
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Trc20Logo className="w-4 h-4" />
            <span>TRC-20 (TRON)</span>
          </button>
          <button
            type="button"
            onClick={() => { setNetwork('BEP20'); setWalletAddress(''); setError(null); }}
            className={`py-2.5 px-4 rounded-lg text-sm font-semibold border transition-all flex items-center justify-center gap-2 ${
              network === 'BEP20'
                ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-600/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Bep20Logo className="w-4 h-4" />
            <span>BEP-20 (BNB Chain)</span>
          </button>
        </div>
      </div>

      {/* INR Input */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Enter Amount (INR)</label>
        <input
          type="number"
          min={1000}
          max={50000}
          value={inrAmount}
          onChange={(e) => setInrAmount(Number(e.target.value))}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
          placeholder="₹1,000 - ₹50,000"
          required
        />
        <p className="text-xs text-slate-500 mt-1">
          You will receive approx: <span className="text-emerald-400 font-semibold">{(inrAmount / liveRate).toFixed(2)} USDT</span>
        </p>
      </div>

      {/* Wallet Address Input */}
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          {network === 'TRC20' ? 'USDT TRC-20 Address (Starts with T)' : 'USDT BEP-20 Address (Starts with 0x)'}
        </label>
        <input
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder={network === 'TRC20' ? 'T...' : '0x...'}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
          required
        />
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-all"
      >
        {loading ? 'Processing...' : `Proceed to Buy USDT (${network})`}
      </button>
    </form>
  )
}
