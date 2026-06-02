import type { DailySummary, GarminActivity, WeightRecord } from "./types.ts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GarthTokens {
  access_token: string
  refresh_token: string
  expires_at: number // timestamp Unix en secondes
  token_type: string
  di_client_id?: string
  display_name?: string
  scope?: string
}

// ─── Activity type mapping ────────────────────────────────────────────────────

const ACTIVITY_TYPE_MAP: Record<string, string> = {
  running: "course",
  trail_running: "course",
  cycling: "velo",
  indoor_cycling: "velo",
  road_biking: "velo",
  swimming: "natation",
  lap_swimming: "natation",
  open_water_swimming: "natation",
  walking: "marche",
  hiking: "marche",
  strength_training: "musculation",
  fitness_equipment: "musculation",
  hiit: "hiit",
  cardio_training: "hiit",
  yoga: "yoga",
  pilates: "yoga",
}

function mapActivityType(typeKey: string): string {
  return ACTIVITY_TYPE_MAP[typeKey] ?? "autre"
}

// ─── Token management ─────────────────────────────────────────────────────────

export function loadTokens(): GarthTokens {
  const raw = Deno.env.get("GARMIN_TOKENS")
  if (!raw) {
    throw new Error("GARMIN_TOKENS non configuré")
  }
  try {
    const tokens = JSON.parse(raw) as GarthTokens
    if (!tokens.access_token || !tokens.refresh_token || !tokens.expires_at) {
      throw new Error("Format invalide")
    }
    return tokens
  } catch {
    throw new Error("GARMIN_TOKENS non configuré")
  }
}

function isTokenExpired(tokens: GarthTokens): boolean {
  return Date.now() / 1000 > tokens.expires_at - 60
}

async function refreshAccessToken(tokens: GarthTokens): Promise<GarthTokens> {
  const clientId = tokens.di_client_id || "GARMIN_CONNECT_MOBILE_ANDROID_DI"
  const basicAuth = btoa(`${clientId}:`)

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: clientId,
  })

  const res = await fetch(
    "https://diauth.garmin.com/di-oauth2-service/oauth/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "GCM-iOS-5.7.2.1",
      },
      body: body.toString(),
    },
  )

  if (!res.ok) {
    throw new Error("Refresh token expiré — relancer garmin_auth.py")
  }

  const data = await res.json() as Record<string, unknown>
  const newAccessToken = data.access_token as string | undefined
  const expiresIn = data.expires_in as number | undefined

  if (!newAccessToken) {
    throw new Error("Refresh token expiré — relancer garmin_auth.py")
  }

  return {
    ...tokens,
    access_token: newAccessToken,
    expires_at: expiresIn
      ? Math.floor(Date.now() / 1000) + expiresIn
      : Math.floor(Date.now() / 1000) + 3600,
  }
}

async function getValidToken(): Promise<string> {
  let tokens = loadTokens()
  if (isTokenExpired(tokens)) {
    tokens = await refreshAccessToken(tokens)
  }
  return tokens.access_token
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1]
    const padded = payload + "=".repeat((4 - payload.length % 4) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return {}
  }
}

async function getDisplayName(): Promise<string> {
  const tokens = loadTokens()
  // display_name stocké lors de l'auth (garmin_auth.py)
  if (tokens.display_name) return tokens.display_name
  throw new Error("display_name absent de GARMIN_TOKENS — relancer garmin_auth.py")
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function garminFetch(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`https://connectapi.garmin.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "GCM-iOS-5.7.2.1",
      NK: "NT",
    },
  })

  if (res.status === 401) {
    throw new Error("Token invalide ou expiré")
  }
  if (!res.ok) {
    throw new Error(`Garmin API ${res.status}`)
  }

  return res.json()
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

export async function fetchRawWeight(date: string): Promise<unknown> {
  const accessToken = await getValidToken()
  return garminFetch(
    `/weight-service/weight/dateRange?startDate=${date}&endDate=${date}`,
    accessToken,
  )
}

export async function fetchRawActivities(date: string): Promise<unknown> {
  const accessToken = await getValidToken()
  return garminFetch(
    `/activitylist-service/activities/search/activities?startDate=${date}&endDate=${date}&limit=5`,
    accessToken,
  )
}

export async function fetchRawDailySummary(date: string): Promise<unknown> {
  const accessToken = await getValidToken()
  const displayName = await getDisplayName()
  return garminFetch(
    `/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`,
    accessToken,
  )
}

// ─── Public API functions ─────────────────────────────────────────────────────

export async function fetchDailySummary(date: string): Promise<DailySummary | null> {
  try {
    const accessToken = await getValidToken()
    const displayName = await getDisplayName()

    const stats = await garminFetch(
      `/usersummary-service/usersummary/daily/${displayName}?calendarDate=${date}`,
      accessToken,
    ) as Record<string, unknown>

    const totalKcal = stats?.totalKilocalories as number | undefined
    if (!totalKcal || totalKcal === 0) return null

    return {
      date,
      tdeeKcal: Number(totalKcal),
      activeKcal: Number(stats?.activeKilocalories ?? 0),
      bmrKcal: Number(stats?.bmrKilocalories ?? 0),
      steps: Number(stats?.totalSteps ?? stats?.steps ?? 0),  // Garmin retourne totalSteps
      restingHr:
        stats?.restingHeartRate != null ? Number(stats.restingHeartRate) : null,
      deviceLastSync: (stats?.lastSyncTimestampGMT as string | undefined) ?? null,
    }
  } catch (err) {
    throw new Error(`fetchDailySummary: ${(err as Error).message}`)
  }
}

export async function fetchActivities(date: string): Promise<GarminActivity[]> {
  try {
    const accessToken = await getValidToken()

    const data = await garminFetch(
      `/activitylist-service/activities/search/activities?startDate=${date}&endDate=${date}&limit=20`,
      accessToken,
    )

    const activities = Array.isArray(data) ? data : []

    return activities
      .filter((a: Record<string, unknown>) => {
        const startTime = a?.startTimeLocal as string | undefined
        return startTime?.slice(0, 10) === date
      })
      .map((a: Record<string, unknown>) => {
        const startTimeLocal = (a?.startTimeLocal as string) ?? ""
        const typeKey =
          (a?.activityType as Record<string, string> | undefined)?.typeKey ?? ""

        return {
          garminActivityId: a?.activityId != null ? Number(a.activityId) : null,
          date: startTimeLocal.slice(0, 10),
          heure: startTimeLocal.slice(11, 16),
          type: mapActivityType(typeKey),
          duree: Math.max(Math.floor(Number(a?.duration ?? 0) / 60), 1),
          caloriesBrulees: Math.round(Number(a?.calories ?? 0)),
          note: "Importé Garmin — " + ((a?.activityName as string) ?? ""),
        }
      })
  } catch (err) {
    console.error("[fetchActivities]", (err as Error).message)
    return []
  }
}

export async function fetchWeight(date: string): Promise<WeightRecord | null> {
  try {
    const accessToken = await getValidToken()

    const data = await garminFetch(
      `/weight-service/weight/dateRange?startDate=${date}&endDate=${date}`,
      accessToken,
    ) as Record<string, unknown>

    // Garmin retourne dateWeightList (principal) ou dailyWeightSummaries (ancien)
    const list = (
      (data?.dateWeightList as Record<string, unknown>[] | undefined) ??
      (data?.dailyWeightSummaries as Record<string, unknown>[] | undefined)
    )
    const firstEntry = list?.[0]
    const weightGrams =
      (firstEntry?.weight as number | undefined) ??
      (data?.weight as number | undefined)

    if (!weightGrams || weightGrams === 0) return null

    const poidsKg = Math.round((Number(weightGrams) / 1000) * 10) / 10
    const bodyFat =
      (firstEntry?.bodyFat as number | undefined) ??
      (data?.bodyFat as number | undefined)

    return {
      date,
      poidsKg,
      masseGrassePct: bodyFat != null ? Number(bodyFat) : null,
    }
  } catch (err) {
    console.error("[fetchWeight]", (err as Error).message)
    return null
  }
}
