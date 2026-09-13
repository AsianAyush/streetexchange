'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/lib/database.types'

type Profile = Tables<'profiles'>

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Start loading=true; only flip to false once we have a definitive auth state.
  const [loading, setLoading] = useState(true)

  // Use a ref so the supabase client is stable and does NOT re-trigger
  // the useEffect dependency array on every render.
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  // Track whether onAuthStateChange has fired at least once so we never
  // prematurely clear loading from initializeAuth while a SIGNED_IN event
  // is still in-flight (the classic race condition that logs users out).
  const listenerFiredRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    async function loadProfile(userId: string) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (!error && data && isMounted) {
          setProfile(data)
        }
      } catch (err) {
        console.error('Error fetching profile:', err)
      }
    }

    // IMPORTANT: Set up the auth state listener FIRST, then initialize.
    // This prevents a race condition where auth events fire during initializeAuth
    // and get missed because the subscription wasn't set up yet.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return

        listenerFiredRef.current = true

        // TOKEN_REFRESHED means the session was renewed — keep user logged in.
        // SIGNED_IN means fresh login or session restored.
        // INITIAL_SESSION is fired by Supabase on startup with the persisted session.
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
          setLoading(false)
          if (currentSession?.user) {
            loadProfile(currentSession.user.id)
          } else {
            setProfile(null)
          }
          return
        }

        // SIGNED_OUT — user explicitly signed out or session truly expired.
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        // Any other event (PASSWORD_RECOVERY, USER_UPDATED, etc.) — update state.
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setLoading(false)
        if (currentSession?.user) {
          loadProfile(currentSession.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    // Fallback: if onAuthStateChange never fires within a short window
    // (e.g. network issue), unblock the UI so users aren't stuck on a spinner.
    async function initializeAuth() {
      try {
        // Small delay to let INITIAL_SESSION fire first — it's synchronous
        // in most Supabase versions when there's a persisted session.
        await new Promise((r) => setTimeout(r, 100))
        if (!isMounted || listenerFiredRef.current) return

        // Listener hasn't fired yet — fall back to getSession().
        const { data: { session: initialSession } } = await supabase.auth.getSession()
        if (!isMounted || listenerFiredRef.current) return

        if (initialSession?.user) {
          setSession(initialSession)
          setUser(initialSession.user)
          loadProfile(initialSession.user.id)
        } else {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      } catch (err) {
        console.error('Auth initialization error:', err)
        if (isMounted && !listenerFiredRef.current) setLoading(false)
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps — supabase client is stable via useRef

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin: profile?.role === 'ADMIN',
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
