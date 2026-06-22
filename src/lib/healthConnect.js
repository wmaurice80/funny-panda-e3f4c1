// src/lib/healthConnect.js
// US-HC-02 — Lecture calories + pas via Android Health Connect
// Plugin custom CalSnap (HealthConnectPlugin.kt) — remplace @devmaxime
// Null-safe sur PWA : toutes les fonctions vérifient Capacitor.isNativePlatform()

import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Plugin HC custom enregistré dans MainActivity.java.
 * Ne rien importer depuis @devmaxime — supprimé.
 */
const CalSnapHealthConnect = registerPlugin('CalSnapHealthConnect')

/**
 * Vérifie si Health Connect est disponible sur cet appareil.
 * Sur APK Android → appel synchrone getSdkStatus() dans le plugin.
 * Sur PWA → false.
 */
export async function isHealthConnectAvailable() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const res = await CalSnapHealthConnect.checkAvailability()
    return res?.available === true
  } catch (e) {
    console.warn('[healthConnect] checkAvailability:', e?.message)
    return false
  }
}

/**
 * Demande les permissions Health Connect (ouvre le dialog HC).
 * Retourne true si toutes les permissions sont accordées, false sinon.
 */
export async function requestHealthConnectPermissions() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const res = await CalSnapHealthConnect.requestPermissions()
    return res?.granted === true
  } catch (e) {
    console.warn('[healthConnect] requestPermissions:', e?.message)
    return false
  }
}

/**
 * Vérifie si les permissions HC sont déjà accordées.
 * Retourne true si tout est OK.
 */
export async function checkHealthConnectPermissions() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const res = await CalSnapHealthConnect.getGrantedPermissions()
    return res?.granted === true
  } catch (e) {
    console.warn('[healthConnect] getGrantedPermissions:', e?.message)
    return false
  }
}

/**
 * Date locale 'YYYY-MM-DD' à partir d'un objet Date (évite le décalage UTC).
 */
function localDateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Lit les données (calories + pas) pour une date 'YYYY-MM-DD'.
 * Retourne { total_kcal, active_kcal, steps } ou null si rien.
 */
export async function readDailyData(date) {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const res = await CalSnapHealthConnect.readDailyData({ date })
    const { totalKcal = 0, activeKcal = 0, steps = 0 } = res ?? {}
    if (totalKcal === 0 && activeKcal === 0 && steps === 0) return null
    return { total_kcal: totalKcal, active_kcal: activeKcal, steps }
  } catch (e) {
    console.warn('[healthConnect] readDailyData:', e?.message)
    return null
  }
}

/**
 * Agrège les données de J (aujourd'hui) et J-1 (hier).
 * Vérifie disponibilité + permissions avant de lire.
 * Retourne Array<{ date, total_kcal, active_kcal, steps }> (jours non vides uniquement).
 */
export async function readRecentDailyData() {
  if (!Capacitor.isNativePlatform()) return []

  const available = await isHealthConnectAvailable()
  if (!available) return []

  const hasPerms = await checkHealthConnectPermissions()
  if (!hasPerms) return []

  const today = new Date()
  const dates = [0, 1].map(offset => {
    const d = new Date(today)
    d.setDate(d.getDate() - offset)
    return localDateISO(d)
  })

  const results = []
  for (const date of dates) {
    const data = await readDailyData(date)
    if (data) {
      results.push({ date, ...data })
    }
  }

  return results
}
