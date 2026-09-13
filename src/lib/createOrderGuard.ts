import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

export interface UserProfileData {
  id: string
  email?: string | null
  username?: string | null
  phone?: string | null
  discord_id?: string | null
  is_banned?: boolean | null
  [key: string]: any
}

export interface OrderGuardResult {
  allowed: boolean
  error?: string
  profile?: UserProfileData | null
}

export {
  sendDiscordOrderAlert,
  buildDiscordOrderPayload,
  getDiscordAdminMentions,
} from './discordOrderNotifier'
export type { DiscordOrderData } from './discordOrderNotifier'

/**
 * Checks whether a user is allowed to create a new order.
 *
 * Rules enforced:
 *  1. Ban check   — if profiles.is_banned is true, block creation.
 *  2. Active order limit — if the user has ≥ 3 orders whose status is not
 *     'COMPLETED' or 'CANCELLED', block creation.
 *
 * Also fetches and returns the user's profile metadata (including `phone` and `discord_id`)
 * so it can be seamlessly attached to Discord order notifications.
 *
 * Returns { allowed: true, profile } when the user may proceed, or
 * { allowed: false, error: "<reason>", profile } when blocked.
 */
export async function checkOrderCreationAllowed(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<OrderGuardResult> {
  let userProfile: UserProfileData | null = null

  // ── 1. Ban Check & Profile Fetch ───────────────────────────────────────────
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      // Fail open on ban check if we can't fetch the profile (DB constraint will catch it)
      console.warn('[createOrderGuard] Could not fetch profile:', profileError.message)
    } else if (profile) {
      userProfile = profile as any
      if ((profile as any)?.is_banned === true) {
        return {
          allowed: false,
          error: 'Your account has been banned. You cannot place orders.',
          profile: userProfile,
        }
      }
    }
  } catch (err) {
    console.warn('[createOrderGuard] Error during profile lookup:', err)
  }

  // ── 2. Active Order Rate Limit ────────────────────────────────────────────
  try {
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['PENDING', 'IN_PROGRESS'])

    if (countError) {
      console.warn('[createOrderGuard] Could not count active orders:', countError.message)
    } else if (count !== null && count >= 3) {
      return {
        allowed: false,
        error:
          'Order limit reached: You can have a maximum of 3 active orders at a time. Please wait until your active orders are completed or cancelled.',
        profile: userProfile,
      }
    }
  } catch (err) {
    console.warn('[createOrderGuard] Error counting active orders:', err)
  }

  return {
    allowed: true,
    profile: userProfile,
  }
}

/**
 * Helper function to fetch a user's full profile including phone and discord_id.
 */
export async function fetchUserProfile(
  supabase: SupabaseClient<Database> | any,
  userId: string
): Promise<UserProfileData | null> {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.warn('[createOrderGuard] fetchUserProfile error:', error.message)
      return null
    }
    return (profile as any) || null
  } catch (err) {
    console.warn('[createOrderGuard] fetchUserProfile exception:', err)
    return null
  }
}
