import { NextResponse } from 'next/server'
import { buildDiscordOrderPayload } from '@/lib/discordOrderNotifier'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

export async function POST(req: Request) {
  try {
    const orderData = await req.json()

    const webhookUrl =
      process.env.DISCORD_ORDER_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_DISCORD_ORDER_WEBHOOK_URL

    if (!webhookUrl) {
      console.warn('[discord-order-alert API] DISCORD_ORDER_WEBHOOK_URL is not set.')
      return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 })
    }

    // If phone or discord_id are not provided in payload, attempt a graceful lookup from profiles
    if ((!orderData?.phone || !orderData?.discord_id) && orderData?.user_id) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_KEY

        if (supabaseUrl && supabaseKey) {
          const supabase = createClient<Database>(supabaseUrl, supabaseKey)
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', orderData.user_id)
            .maybeSingle()

          if (profile) {
            if (!orderData.phone && (profile as any).phone) {
              orderData.phone = (profile as any).phone
            }
            if (!orderData.discord_id && (profile as any).discord_id) {
              orderData.discord_id = (profile as any).discord_id
            }
            if (!orderData.user_email && (profile as any).email) {
              orderData.user_email = (profile as any).email
            }
          }
        }
      } catch (profileErr) {
        console.warn('[discord-order-alert API] Could not auto-enrich profile:', profileErr)
      }
    }

    const payload = buildDiscordOrderPayload(orderData)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error(`[discord-order-alert API] Discord returned status ${response.status}: ${errorText}`)
      return NextResponse.json({ error: 'Discord webhook error', status: response.status }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[discord-order-alert API] Failed:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

