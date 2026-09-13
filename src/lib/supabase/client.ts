import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'

// Module-level singleton — one instance for the entire browser session.
// This prevents new Supabase clients being created on every React render,
// which was causing auth state loss and "signed out" flickering.
let browserClient: SupabaseClient<Database> | null = null

export function createClient(): SupabaseClient<Database> {
  // On the server, always return a short-lived, non-persisted client
  if (typeof window === 'undefined') {
    return createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )
  }

  // On the browser, reuse the same singleton instance
  if (!browserClient) {
    browserClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'streetexchange-auth-token',
        },
      }
    )
  }

  return browserClient
}
