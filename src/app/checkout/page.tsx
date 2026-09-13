'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { sendDiscordOrderAlert } from '@/lib/discordOrderNotifier'

interface OrderData {
  inrAmount: number
  walletAddress: string
  network: 'TRC20' | 'BEP20'
  rate: number
  usdt: number
}

/**
 * /checkout — Legacy session-storage checkout entry point.
 *
 * If there is a pending `sx_order` in sessionStorage (from the old calculator
 * flow), this page creates the DB order then redirects to /order/[id].
 * Otherwise it redirects straight to /dashboard.
 *
 * The actual order checkout/payment UI lives at /order/[id].
 */
export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }

    const stored = sessionStorage.getItem('sx_order')
    if (!stored) {
      router.replace('/dashboard')
      return
    }

    async function initOrder() {
      try {
        const data: OrderData = JSON.parse(stored!)
        sessionStorage.removeItem('sx_order')

        const { data: newOrder, error } = await supabase
          .from('orders')
          .insert({
            user_id: user!.id,
            order_type: 'BUY',
            inr_amount: data.inrAmount,
            usdt_amount: data.usdt,
            rate_applied: data.rate,
            network: data.network ?? 'TRC20',
            wallet_address: data.walletAddress,
            status: 'PENDING',
          })
          .select()
          .single()

        if (error || !newOrder) {
          console.error('[CheckoutPage] Failed to create order:', error)
          router.replace('/dashboard')
          return
        }

        // Notify Discord asynchronously
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user!.id)
          .maybeSingle()

        sendDiscordOrderAlert({
          ...newOrder,
          user_email: user?.email || (userProfile as any)?.email,
          phone: (userProfile as any)?.phone || (user?.user_metadata as any)?.phone,
          discord_id: (userProfile as any)?.discord_id || (user?.user_metadata as any)?.discord_id,
        }).catch((err) => {
          console.error('[Discord Webhook] Failed to send order notification:', err)
        })

        router.replace(`/order/${newOrder.id}`)
      } catch (err) {
        console.error('[CheckoutPage] initOrder exception:', err)
        router.replace('/dashboard')
      }
    }

    initOrder()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  // Show a minimal loading spinner while processing
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-white/40">Creating your order…</p>
      </div>
    </div>
  )
}
