// src/lib/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { pullProfile, pullAllMeals, pullAllActivities, pullAllWeights } from './supabaseDb'
import { saveProfile, addMeal, addActivity, addWeight, clearAllLocalData } from '../db'
import { syncGarminDaily } from './syncManager'

const LAST_USER_KEY = 'calsnap_last_user_id'

async function syncFromSupabase() {
  try {
    // Profil
    const remoteProfile = await pullProfile()
    if (remoteProfile) await saveProfile(remoteProfile)

    // Repas
    const remoteMeals = await pullAllMeals()
    for (const meal of remoteMeals) {
      await addMeal(meal).catch(() => {})
    }

    // Activités
    const remoteActivities = await pullAllActivities()
    for (const activity of remoteActivities) {
      await addActivity(activity).catch(() => {})
    }

    // Pesées
    const remoteWeights = await pullAllWeights()
    for (const weight of remoteWeights) {
      await addWeight(weight).catch(() => {})
    }

    // Garmin daily (TDEE réel par jour)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      await syncGarminDaily(session.user.id).catch(() => {})
    }
  } catch (e) {
    console.warn('[syncFromSupabase]', e.message)
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    // Vérification de la session existante au montage
    // Si session active → sync Supabase pour récupérer données des autres appareils
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        setSyncing(true)
        syncFromSupabase().finally(() => setSyncing(false))
      }
    })

    // Écoute des changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (event === 'SIGNED_IN') {
        const newUserId = session?.user?.id
        const lastUserId = localStorage.getItem(LAST_USER_KEY)
        if (lastUserId && lastUserId !== newUserId) {
          await clearAllLocalData()
        }
        localStorage.setItem(LAST_USER_KEY, newUserId)
        setSyncing(true)
        syncFromSupabase().finally(() => setSyncing(false))
      }
      if (event === 'SIGNED_OUT') {
        await clearAllLocalData()
        localStorage.removeItem(LAST_USER_KEY)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, loading, syncing, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider')
  return ctx
}
