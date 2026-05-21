// src/lib/googleFit.js

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET
const REDIRECT_URI = `${window.location.origin}/auth/google/callback`
const SCOPES =
  'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read'

const LS_ACCESS_TOKEN = 'gfit_access_token'
const LS_REFRESH_TOKEN = 'gfit_refresh_token'
const LS_EXPIRES_AT = 'gfit_expires_at'
const SS_CODE_VERIFIER = 'gfit_code_verifier'

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Génère un code_verifier aléatoire (64 chars base64url) et son code_challenge
 * (SHA-256 base64url du verifier).
 * @returns {{ codeVerifier: string, codeChallenge: string }}
 */
export async function generatePKCE() {
  // code_verifier : 48 octets aléatoires → 64 chars base64url
  const array = new Uint8Array(48)
  crypto.getRandomValues(array)
  const codeVerifier = base64urlEncode(array)

  // code_challenge : SHA-256 du verifier en bytes
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = base64urlEncode(new Uint8Array(digest))

  return { codeVerifier, codeChallenge }
}

/**
 * Construit l'URL d'autorisation Google OAuth 2.0.
 * @param {string} codeChallenge
 * @returns {string}
 */
export function buildAuthURL(codeChallenge) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Lance le flux OAuth PKCE : génère les codes, stocke le verifier en
 * localStorage et redirige l'utilisateur vers Google.
 */
export async function initiateGoogleAuth() {
  const { codeVerifier, codeChallenge } = await generatePKCE()
  localStorage.setItem(SS_CODE_VERIFIER, codeVerifier)
  window.location.href = buildAuthURL(codeChallenge)
}

/**
 * Échange le code d'autorisation contre les tokens et les stocke.
 * @param {string} code - Code reçu en query param depuis Google
 */
export async function handleCallback(code) {
  const codeVerifier = localStorage.getItem(SS_CODE_VERIFIER)
  if (!codeVerifier) {
    throw new Error('code_verifier manquant en session — flux PKCE corrompu.')
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Échange de token échoué (${res.status}) : ${err.error_description || err.error || 'erreur inconnue'}`
    )
  }

  const data = await res.json()
  storeTokens(data)
  localStorage.removeItem(SS_CODE_VERIFIER)
}

/**
 * Vérifie si un access_token valide (non expiré) est disponible.
 * @returns {boolean}
 */
export function isConnected() {
  const token = localStorage.getItem(LS_ACCESS_TOKEN)
  const expiresAt = parseInt(localStorage.getItem(LS_EXPIRES_AT) || '0', 10)
  return !!(token && Date.now() < expiresAt)
}

/**
 * Vérifie si un refresh_token existe, même si l'access_token est expiré.
 * Utilisé pour maintenir l'affichage de la GoogleFitCard sans re-demander
 * une connexion complète.
 * @returns {boolean}
 */
export function hasRefreshToken() {
  return !!localStorage.getItem('gfit_refresh_token')
}

/**
 * Retourne un access_token valide. Si expiré, tente un refresh.
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  const expiresAt = parseInt(localStorage.getItem(LS_EXPIRES_AT) || '0', 10)
  const token = localStorage.getItem(LS_ACCESS_TOKEN)

  if (token && Date.now() < expiresAt) {
    return token
  }

  // Tentative de refresh
  const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN)
  if (!refreshToken) {
    throw new Error('Non connecté à Google Fit. Veuillez vous reconnecter.')
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    disconnect()
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Refresh token échoué (${res.status}) : ${err.error_description || err.error || 'erreur inconnue'}`
    )
  }

  const data = await res.json()
  storeTokens(data)
  return localStorage.getItem(LS_ACCESS_TOKEN)
}

/**
 * Supprime tous les tokens Google Fit du localStorage.
 */
export function disconnect() {
  localStorage.removeItem(LS_ACCESS_TOKEN)
  localStorage.removeItem(LS_REFRESH_TOKEN)
  localStorage.removeItem(LS_EXPIRES_AT)
}

// ---------------------------------------------------------------------------
// Google Fit API
// ---------------------------------------------------------------------------

/**
 * Récupère les calories actives pour une date donnée.
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @returns {Promise<{ totalKcal: number, sessions: Array<{ name: string, startTime: string, endTime: string, kcal: number }> }>}
 */
export async function fetchActiveCalodesForDate(dateISO) {
  const accessToken = await getAccessToken()

  const startMs = dateToStartOfDayMs(dateISO)
  const endMs = startMs + 24 * 60 * 60 * 1000 // +1 jour

  const body = {
    aggregateBy: [
      { dataTypeName: 'com.google.calories.expended' },
    ],
    bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  }

  const res = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Fitness API calories échouée (${res.status}) : ${err.error?.message || 'erreur inconnue'}`
    )
  }

  const data = await res.json()
  const buckets = data.bucket || []

  let totalKcal = 0
  // bucketByTime : 1 bucket = toute la journée
  for (const bucket of buckets) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        totalKcal += point.value?.[0]?.fpVal ?? 0
      }
    }
  }

  const totalRounded = Math.round(totalKcal)
  // On retourne 1 session synthétique représentant la journée
  const sessions = totalRounded > 0
    ? [{ name: 'Google Fit (journée)', startTime: new Date(startMs).toISOString(), endTime: new Date(endMs).toISOString(), kcal: totalRounded }]
    : []

  return { totalKcal: totalRounded, sessions }
}

/**
 * Récupère la dernière pesée depuis Google Fit.
 * @returns {Promise<{ poids: number, date: string }|null>}
 */
export async function fetchLatestWeight() {
  const history = await fetchWeightHistory(30)
  if (!history.length) return null
  // fetchWeightHistory retourne du plus récent au plus ancien
  return history[0]
}

/**
 * Récupère l'historique de poids sur N jours.
 * @param {number} days
 * @returns {Promise<Array<{ poids: number, date: string }>>}
 */
export async function fetchWeightHistory(days = 30) {
  const accessToken = await getAccessToken()

  const endMs = Date.now()
  const startMs = endMs - days * 24 * 60 * 60 * 1000

  const body = {
    aggregateBy: [
      {
        dataTypeName: 'com.google.weight',
        dataSourceId:
          'derived:com.google.weight:com.google.android.gms:merge_weight',
      },
    ],
    bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
    startTimeMillis: startMs,
    endTimeMillis: endMs,
  }

  const res = await fetch(
    'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Fitness API poids échouée (${res.status}) : ${err.error?.message || 'erreur inconnue'}`
    )
  }

  const data = await res.json()
  const buckets = data.bucket || []
  const results = []

  for (const bucket of buckets) {
    for (const dataset of bucket.dataset || []) {
      for (const point of dataset.point || []) {
        const poids = point.value?.[0]?.fpVal
        if (poids != null) {
          const date = new Date(
            parseInt(point.startTimeNanos, 10) / 1_000_000
          )
            .toISOString()
            .split('T')[0]
          results.push({ poids: Math.round(poids * 10) / 10, date })
        }
      }
    }
  }

  // Tri du plus récent au plus ancien
  results.sort((a, b) => (a.date > b.date ? -1 : 1))
  return results
}

// ---------------------------------------------------------------------------
// Debug — liste les data sources disponibles + données calories
// ---------------------------------------------------------------------------

export async function fetchDebugInfo(dateISO) {
  const accessToken = await getAccessToken()
  const startMs = dateToStartOfDayMs(dateISO)
  const endMs = startMs + 24 * 60 * 60 * 1000

  // Essayer plusieurs data types pour les calories
  const dataTypes = [
    'com.google.calories.expended',
    'com.google.calories.bmr',
    'com.google.active_minutes',
    'com.google.step_count.delta',
  ]

  const results = {}
  for (const dt of dataTypes) {
    try {
      const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: dt }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
          startTimeMillis: startMs,
          endTimeMillis: endMs,
        }),
      })
      if (!res.ok) { results[dt] = `HTTP ${res.status}`; continue }
      const data = await res.json()
      let total = 0
      for (const bucket of data.bucket || []) {
        for (const dataset of bucket.dataset || []) {
          for (const point of dataset.point || []) {
            total += point.value?.[0]?.fpVal ?? point.value?.[0]?.intVal ?? 0
          }
        }
      }
      results[dt] = Math.round(total)
    } catch (e) {
      results[dt] = `Erreur: ${e.message}`
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Nouvelles fonctions Google Fit
// ---------------------------------------------------------------------------

/**
 * Récupère le TDEE réel (BMR + calories actives) pour une date donnée.
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @returns {Promise<{ tdee: number, bmr: number, active: number }|null>}
 */
export async function fetchDailyTDEE(dateISO) {
  try {
    const accessToken = await getAccessToken()
    const startMs = dateToStartOfDayMs(dateISO)
    const endMs = startMs + 24 * 60 * 60 * 1000

    // Requêtes séparées pour éviter les ambiguïtés de parsing
    const queryOne = async (dataTypeName) => {
      const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName }],
          bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
          startTimeMillis: startMs,
          endTimeMillis: endMs,
        }),
      })
      if (!res.ok) return 0
      const data = await res.json()
      let total = 0
      for (const bucket of data.bucket || [])
        for (const dataset of bucket.dataset || [])
          for (const point of dataset.point || [])
            total += point.value?.[0]?.fpVal ?? 0
      return Math.round(total)
    }

    const [active, bmr] = await Promise.all([
      queryOne('com.google.calories.expended'),
      queryOne('com.google.calories.bmr'),
    ])

    if (active === 0 && bmr === 0) return null

    const bmrRounded = bmr
    const activeRounded = active
    // Si BMR Google Fit = 0, le Dashboard utilisera le BMR du profil comme base
    return {
      tdee: bmrRounded + activeRounded,
      bmr: bmrRounded,
      active: activeRounded,
    }
  } catch (err) {
    console.warn('[googleFit] fetchDailyTDEE :', err)
    return null
  }
}

/**
 * Récupère le nombre de pas pour une date donnée.
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @returns {Promise<{ steps: number }>}
 */
export async function fetchSteps(dateISO) {
  try {
    const accessToken = await getAccessToken()
    const startMs = dateToStartOfDayMs(dateISO)
    const endMs = startMs + 24 * 60 * 60 * 1000

    const body = {
      aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
      bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
      startTimeMillis: startMs,
      endTimeMillis: endMs,
    }

    const res = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Fitness API pas échouée (${res.status}) : ${err.error?.message || 'erreur inconnue'}`
      )
    }

    const data = await res.json()
    const buckets = data.bucket || []
    let steps = 0

    for (const bucket of buckets) {
      for (const dataset of bucket.dataset || []) {
        for (const point of dataset.point || []) {
          steps += point.value?.[0]?.intVal ?? 0
        }
      }
    }

    return { steps }
  } catch (err) {
    console.warn('[googleFit] fetchSteps :', err)
    return { steps: 0 }
  }
}

/**
 * Récupère les données de fréquence cardiaque pour une date donnée.
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @returns {Promise<{ avg: number, min: number, max: number }|null>}
 */
export async function fetchHeartRate(dateISO) {
  try {
    const accessToken = await getAccessToken()
    const startMs = dateToStartOfDayMs(dateISO)
    const endMs = startMs + 24 * 60 * 60 * 1000

    const body = {
      aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
      bucketByTime: { durationMillis: 24 * 60 * 60 * 1000 },
      startTimeMillis: startMs,
      endTimeMillis: endMs,
    }

    const res = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Fitness API fréquence cardiaque échouée (${res.status}) : ${err.error?.message || 'erreur inconnue'}`
      )
    }

    const data = await res.json()
    const buckets = data.bucket || []
    const points = []

    for (const bucket of buckets) {
      for (const dataset of bucket.dataset || []) {
        for (const point of dataset.point || []) {
          points.push(point)
        }
      }
    }

    if (!points.length) return null

    // Chaque point agrégé : value[0]=min, value[1]=max, value[2]=avg
    let totalMin = 0
    let totalMax = 0
    let totalAvg = 0

    for (const point of points) {
      totalMin += point.value?.[0]?.fpVal ?? 0
      totalMax += point.value?.[1]?.fpVal ?? 0
      totalAvg += point.value?.[2]?.fpVal ?? 0
    }

    const count = points.length
    return {
      min: Math.round(totalMin / count),
      max: Math.round(totalMax / count),
      avg: Math.round(totalAvg / count),
    }
  } catch (err) {
    console.warn('[googleFit] fetchHeartRate :', err)
    return null
  }
}

/** Mapping des IDs d'activité Google Fit vers des noms lisibles */
const ACTIVITY_NAMES = {
  7: 'Vélo',
  8: 'Course à pied',
  9: 'Course sur tapis',
  56: 'Sport',
  72: 'Marche',
  97: 'Musculation',
  108: 'Yoga',
  115: 'Natation',
  119: 'HIIT',
}

/**
 * Récupère les activités physiques pour une date donnée.
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @returns {Promise<Array<{ name: string, dureeMin: number, calories: number }>>}
 */
export async function fetchActivitiesForDate(dateISO) {
  try {
    const accessToken = await getAccessToken()
    const startMs = dateToStartOfDayMs(dateISO)
    const endMs = startMs + 24 * 60 * 60 * 1000

    // bucketByActivityType non disponible sur ce compte — on utilise bucketByTime (30 min)
    // pour détecter les créneaux avec activité significative (>5 kcal/30min)
    const SLOT = 30 * 60 * 1000
    const body = {
      aggregateBy: [{ dataTypeName: 'com.google.calories.expended' }],
      bucketByTime: { durationMillis: SLOT },
      startTimeMillis: startMs,
      endTimeMillis: endMs,
    }

    const res = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Fitness API activités échouée (${res.status}) : ${err.error?.message || 'erreur inconnue'}`
      )
    }

    const data = await res.json()
    const buckets = data.bucket || []
    const activities = []

    // Regroupe les créneaux consécutifs avec calories > 5 kcal/30min (= activité détectée)
    let currentSession = null
    for (const bucket of buckets) {
      let kcal = 0
      for (const dataset of bucket.dataset || []) {
        for (const point of dataset.point || []) {
          kcal += point.value?.[0]?.fpVal ?? 0
        }
      }
      if (kcal > 5) {
        if (currentSession) {
          currentSession.calories += kcal
          currentSession.dureeMin += 30
        } else {
          currentSession = { name: 'Activité (Google Fit)', dureeMin: 30, calories: kcal }
        }
      } else if (currentSession) {
        activities.push({ ...currentSession, calories: Math.round(currentSession.calories) })
        currentSession = null
      }
    }
    if (currentSession) activities.push({ ...currentSession, calories: Math.round(currentSession.calories) })

    return activities
  } catch (err) {
    console.warn('[googleFit] fetchActivitiesForDate :', err)
    return []
  }
}

/**
 * Récupère toutes les données de la journée en parallèle.
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @returns {Promise<{ tdee: object|null, steps: object|null, heartRate: object|null, activities: Array }>}
 */
export async function fetchAllDayData(dateISO) {
  const [tdee, steps, heartRate, activities] = await Promise.allSettled([
    fetchDailyTDEE(dateISO),
    fetchSteps(dateISO),
    fetchHeartRate(dateISO),
    fetchActivitiesForDate(dateISO),
  ])
  return {
    tdee: tdee.status === 'fulfilled' ? tdee.value : null,
    steps: steps.status === 'fulfilled' ? steps.value : null,
    heartRate: heartRate.status === 'fulfilled' ? heartRate.value : null,
    activities: activities.status === 'fulfilled' ? activities.value : [],
  }
}

// ---------------------------------------------------------------------------
// Utilitaires privés
// ---------------------------------------------------------------------------

function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function storeTokens({ access_token, refresh_token, expires_in }) {
  if (access_token) {
    localStorage.setItem(LS_ACCESS_TOKEN, access_token)
  }
  if (refresh_token) {
    localStorage.setItem(LS_REFRESH_TOKEN, refresh_token)
  }
  if (expires_in) {
    const expiresAt = Date.now() + (expires_in - 60) * 1000 // -60s marge
    localStorage.setItem(LS_EXPIRES_AT, String(expiresAt))
  }
}

function dateToStartOfDayMs(dateISO) {
  // Interprétation locale du YYYY-MM-DD → minuit heure locale
  const [year, month, day] = dateISO.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
}

/** Mapping minimal des IDs d'activité Google Fit vers des noms lisibles */
function activityIdToName(id) {
  const map = {
    1: 'Badminton',
    9: 'Vélo',
    10: 'Vélo (stationnaire)',
    13: 'Course à pied',
    16: 'Football',
    17: 'Frisbee',
    20: 'Golf',
    23: 'Handball',
    24: 'Randonnée',
    26: 'Hockey sur glace',
    28: 'Saut à la corde',
    29: 'Kayak',
    31: 'Arts martiaux',
    32: 'Méditation',
    33: 'Musculation',
    35: 'Autre',
    36: 'Parkour',
    37: 'Ping-pong',
    38: 'Polo',
    39: 'Racquetball',
    41: 'Escalade',
    43: 'Rugby',
    44: 'Jogging',
    45: 'Roller',
    46: 'Aviron',
    47: 'Aviron (machine)',
    48: 'Voile',
    50: 'Skateboard',
    51: 'Ski',
    52: 'Ski de fond',
    53: 'Snowboard',
    54: 'Squash',
    55: 'Escalier',
    56: 'Natation (piscine)',
    57: 'Natation (eau libre)',
    58: 'Tennis de table',
    59: 'Équitation',
    60: 'Tennis',
    61: 'Tir à la corde',
    62: 'Volleyball',
    63: 'Volleyball (plage)',
    64: 'Marche',
    65: 'Water-polo',
    66: 'Haltérophilie',
    67: 'Yoga',
    68: 'Zumba',
    69: 'Plongée',
    70: 'Ergomètre',
    71: 'Fitness',
    72: 'P90X',
    73: 'Elliptique',
    74: 'Pilates',
    75: 'Yoga Bikram',
    76: 'Cross-training',
    77: 'Intervalle',
    78: 'Marche (tapis)',
    79: 'Course (tapis)',
    80: 'Natation',
    82: 'HIIT',
    83: 'Calisthenics',
    84: 'Circuit training',
    85: 'Entraînement fonctionnel',
    86: 'Boxe',
  }
  return map[id] || `Activité (${id})`
}
