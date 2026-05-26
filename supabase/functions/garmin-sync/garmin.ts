import GarminConnect from "npm:garmin-connect"
import type { DailySummary, GarminActivity, WeightRecord } from "./types.ts"

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

export async function createGarminClient(email: string, password: string) {
  try {
    const client = new GarminConnect({ username: email, password })
    await client.login(email, password)
    return client
  } catch (_err) {
    throw new Error("Authentification Garmin échouée")
  }
}

export async function fetchDailySummary(
  client: ReturnType<typeof GarminConnect>,
  date: string,
): Promise<DailySummary | null> {
  try {
    let stats: Record<string, unknown>
    try {
      stats = await client.getDailyStats(date)
    } catch {
      stats = await client.getStats(date)
    }

    const totalKcal = stats?.totalKilocalories as number | undefined
    if (!totalKcal || totalKcal === 0) return null

    return {
      date,
      tdeeKcal: Number(totalKcal),
      activeKcal: Number(stats?.activeKilocalories ?? 0),
      bmrKcal: Number(stats?.bmrKilocalories ?? 0),
      steps: Number(stats?.steps ?? 0),
      restingHr:
        stats?.restingHeartRate != null
          ? Number(stats.restingHeartRate)
          : null,
    }
  } catch {
    return null
  }
}

export async function fetchActivities(
  client: ReturnType<typeof GarminConnect>,
  date: string,
): Promise<GarminActivity[]> {
  try {
    const activities = await client.getActivities(0, 10)

    if (!Array.isArray(activities)) return []

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
          garminActivityId: Number(a?.activityId ?? 0),
          date: startTimeLocal.slice(0, 10),
          heure: startTimeLocal.slice(11, 16),
          type: mapActivityType(typeKey),
          duree: Math.max(Math.floor(Number(a?.duration ?? 0) / 60), 1),
          caloriesBrulees: Math.round(Number(a?.calories ?? 0)),
          note: "Importé Garmin — " + ((a?.activityName as string) ?? ""),
        }
      })
  } catch {
    return []
  }
}

export async function fetchWeight(
  client: ReturnType<typeof GarminConnect>,
  date: string,
): Promise<WeightRecord | null> {
  try {
    let composition: Record<string, unknown>
    try {
      composition = await client.getBodyComposition(date, date)
    } catch {
      composition = await client.getBodyCompositionForDate(date)
    }

    const weightGrams =
      (composition?.weight as number | undefined) ??
      (composition?.dailyWeightSummaries as Record<string, unknown>[] | undefined)?.[0]
        ?.weight as number | undefined

    if (!weightGrams || weightGrams === 0) return null

    const poidsKg = Math.round((Number(weightGrams) / 1000) * 10) / 10
    const bodyFat = composition?.bodyFat as number | undefined

    return {
      date,
      poidsKg,
      masseGrassePct: bodyFat != null ? Number(bodyFat) : null,
    }
  } catch {
    return null
  }
}
