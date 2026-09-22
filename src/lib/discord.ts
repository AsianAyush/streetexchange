// src/lib/discord.ts

export interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}

export interface DiscordEmbedParams {
  title: string
  color: number
  fields: DiscordEmbedField[]
  description?: string
  footerText?: string
}

export async function sendDiscordWebhook(embed: {
  title: string
  color: number
  fields: { name: string; value: string; inline?: boolean }[]
  description?: string
  footerText?: string
}): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_ORDER_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('DISCORD_WEBHOOK_URL is missing from environment variables.')
    return false
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'StreetExchange Alert',
        embeds: [{ ...embed, timestamp: new Date().toISOString() }],
      }),
    })
    if (!res.ok) console.error('Discord API returned error:', await res.text())
    return res.ok
  } catch (err) {
    console.error('Discord Webhook Fetch Error:', err)
    return false
  }
}
