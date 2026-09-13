import { formatIST } from '@/lib/dateUtils'

export interface DiscordOrderData {
  id: string
  user_id: string
  user_email?: string | null
  user_phone?: string | null
  phone?: string | null
  mobile_number?: string | null
  user_discord_id?: string | null
  discord_id?: string | null
  discord_handle?: string | null
  order_type?: 'BUY' | 'SELL' | string
  inr_amount: number
  usdt_amount: number
  rate_applied?: number | null
  network?: string | null
  wallet_address?: string | null
  user_payout_details?: string | null
  status?: string | null
  created_at?: string | null
  admin_mentions?: string | null
}

/**
 * Resolves the admin mentions / pings to use in the message content field.
 * Defaults to `@agentfx_2 @neymar.fx`.
 */
export function getDiscordAdminMentions(customMentions?: string | null): string {
  if (customMentions && customMentions.trim()) {
    return customMentions.trim()
  }
  if (process.env.DISCORD_ADMIN_MENTIONS && process.env.DISCORD_ADMIN_MENTIONS.trim()) {
    return process.env.DISCORD_ADMIN_MENTIONS.trim()
  }
  if (process.env.DISCORD_ADMIN_USER_IDS && process.env.DISCORD_ADMIN_USER_IDS.trim()) {
    return process.env.DISCORD_ADMIN_USER_IDS
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => (id.startsWith('<@') ? id : `<@${id}>`))
      .join(' ')
  }
  return '@agentfx_2 @neymar.fx'
}

/**
 * Builds the full Discord payload containing embed fields and admin mention tags in content.
 */
export function buildDiscordOrderPayload(orderData: DiscordOrderData | any) {
  const orderId = orderData?.id ? `#${orderData.id}` : '#UNKNOWN'
  const userIdentifier = orderData?.user_email
    ? `${orderData.user_email} (${orderData.user_id || 'N/A'})`
    : orderData?.user_id || 'N/A'

  const rawPhone =
    orderData?.phone ||
    orderData?.user_phone ||
    orderData?.mobile_number

  const phoneDisplay =
    rawPhone && String(rawPhone).trim().length > 0
      ? String(rawPhone).trim()
      : 'Not provided'

  const rawDiscord =
    orderData?.discord_id ||
    orderData?.user_discord_id ||
    orderData?.discord_handle

  let discordDisplay = 'Not provided'
  if (rawDiscord && String(rawDiscord).trim().length > 0) {
    const trimmed = String(rawDiscord).trim()
    if (/^\d{17,20}$/.test(trimmed)) {
      discordDisplay = `<@${trimmed}> (\`${trimmed}\`)`
    } else if (trimmed.startsWith('@') || trimmed.startsWith('<@')) {
      discordDisplay = trimmed
    } else {
      discordDisplay = `@${trimmed}`
    }
  }

  const type = orderData?.order_type || 'BUY'
  const inrFormatted = typeof orderData?.inr_amount === 'number'
    ? `₹${orderData.inr_amount.toLocaleString('en-IN')}`
    : `₹${orderData?.inr_amount || 0}`
  const usdtFormatted = `${orderData?.usdt_amount ?? 0} USDT`
  const rateFormatted = orderData?.rate_applied ? `@ ₹${orderData.rate_applied}/USDT` : ''
  const networkFormatted = orderData?.network ? `via ${orderData.network}` : ''

  let amountDetails = `${type} ${usdtFormatted} for ${inrFormatted}`
  if (rateFormatted) amountDetails += ` ${rateFormatted}`
  if (networkFormatted) amountDetails += ` ${networkFormatted}`

  if (orderData?.wallet_address) {
    amountDetails += `\n**Wallet:** \`${orderData.wallet_address}\``
  }
  if (orderData?.user_payout_details) {
    amountDetails += `\n**Payout:** ${orderData.user_payout_details}`
  }

  const istTime = formatIST(orderData?.created_at || new Date().toISOString())
  const adminMentions = getDiscordAdminMentions(orderData?.admin_mentions)

  const embed = {
    title: '🛒 New Order Received!',
    color: 0x3B82F6,
    fields: [
      {
        name: 'Order ID',
        value: `\`${orderId}\``,
        inline: true,
      },
      {
        name: 'User Email / ID',
        value: userIdentifier,
        inline: true,
      },
      {
        name: 'Status',
        value: '⏳ PENDING',
        inline: true,
      },
      {
        name: 'Mobile Number',
        value: phoneDisplay,
        inline: true,
      },
      {
        name: 'Discord Handle',
        value: discordDisplay,
        inline: true,
      },
      {
        name: 'Amount / Order Details',
        value: amountDetails,
        inline: false,
      },
      {
        name: 'Order Time (IST)',
        value: istTime,
        inline: false,
      },
    ],
    footer: {
      text: 'Order Audit System',
    },
    timestamp: new Date().toISOString(),
  }

  return {
    content: `🚨 **New Order Received!** ${adminMentions}`,
    embeds: [embed],
    allowed_mentions: {
      parse: ['users', 'roles', 'everyone'],
    },
  }
}

/**
 * Sends a Discord embed notification whenever a new order is created.
 */
export async function sendDiscordOrderAlert(orderData: DiscordOrderData | any): Promise<boolean> {
  // If running in browser, proxy through the Next.js API route to prevent CORS/ad-blocker issues
  // and keep webhook execution resilient.
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/discord-order-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      if (res.ok) {
        return true
      }
    } catch (err) {
      console.warn('[discordOrderNotifier] API proxy call failed, trying direct webhook...', err)
    }
  }

  const webhookUrl =
    process.env.DISCORD_ORDER_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_DISCORD_ORDER_WEBHOOK_URL

  if (!webhookUrl) {
    console.warn('[discordOrderNotifier] DISCORD_ORDER_WEBHOOK_URL is not set.')
    return false
  }

  const payload = buildDiscordOrderPayload(orderData)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error(`[discordOrderNotifier] Discord returned error ${response.status}: ${errorText}`)
      return false
    }

    return true
  } catch (error) {
    console.error('[discordOrderNotifier] Failed to send Discord webhook:', error)
    return false
  }
}
