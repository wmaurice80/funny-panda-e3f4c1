import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  fetchActivities,
  fetchDailySummary,
  fetchWeight,
  fetchRawWeight,
  fetchRawActivities,
  fetchRawDailySummary,
  loadTokens,
} from "./garmin.ts"
import type { SyncReport } from "./types.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const CALSNAP_USER_ID = Deno.env.get("CALSNAP_USER_ID")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://calsnapwmp.netlify.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

// offset=0 → aujourd'hui inclus, offset=1 → hier inclus (pour cron post-minuit)
function generateDates(days: number, offset = 0): string[] {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i - offset)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    try {
      loadTokens() // valide que GARMIN_TOKENS est configuré
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: (err as Error).message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    let days = 1
    let offset = 0
    let debug = false
    try {
      const body = await req.json()
      if (typeof body?.days === "number" && body.days > 0) {
        days = Math.min(body.days, 30)
      }
      if (typeof body?.offset === "number" && body.offset >= 0) {
        offset = Math.min(body.offset, 30)
      }
      if (body?.debug === true) debug = true
    } catch {
      // body absent ou invalide → on garde le défaut
    }

    // Mode debug : retourne les réponses brutes Garmin pour diagnostic
    if (debug) {
      const today = new Date().toISOString().slice(0, 10)
      const [rawDailySummary, rawWeight, rawActivities] = await Promise.all([
        fetchRawDailySummary(today).catch((e: Error) => ({ error: e.message })),
        fetchRawWeight(today).catch((e: Error) => ({ error: e.message })),
        fetchRawActivities(today).catch((e: Error) => ({ error: e.message })),
      ])
      return new Response(
        JSON.stringify({ success: true, debug: true, rawDailySummary, rawWeight, rawActivities }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const dates = generateDates(days, offset)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const reports: SyncReport[] = []

    for (const date of dates) {
      const report: SyncReport = {
        date,
        tdeeOk: false,
        activitiesOk: 0,
        activitiesErr: 0,
        weightOk: false,
      }

      // — Daily summary (TDEE → garmin_daily) —
      try {
        const summary = await fetchDailySummary(date)
        if (summary) {
          const { error } = await supabase.from("garmin_daily").upsert(
            {
              user_id: CALSNAP_USER_ID,
              date: summary.date,
              total_kcal: summary.tdeeKcal,
              active_kcal: summary.activeKcal,
              bmr_kcal: summary.bmrKcal,
              steps: summary.steps ?? 0,
              device_last_sync: summary.deviceLastSync ?? null,
              synced_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date" }
          )
          if (!error) report.tdeeOk = true
        }
      } catch {
        // skip silencieux — pas de données Garmin ce jour
      }

      await sleep(1000)

      // — Activités —
      const activities = await fetchActivities(date)
      for (const activity of activities) {
        try {
          const payload = {
            user_id: CALSNAP_USER_ID,
            garmin_activity_id: activity.garminActivityId,
            date: activity.date,
            heure: activity.heure,
            type: activity.type,
            duree: activity.duree,
            calories_brulees: activity.caloriesBrulees,
            note: activity.note,
          }
          // UPSERT seulement si on a un garmin_activity_id — sinon INSERT simple
          const op = activity.garminActivityId != null
            ? supabase.from("activities").upsert(payload, { onConflict: "user_id,garmin_activity_id" })
            : supabase.from("activities").insert(payload)
          const { error } = await op
          if (!error) {
            report.activitiesOk++
          } else {
            console.error("[activities upsert]", error.message, error.code)
            report.activitiesErr++
          }
        } catch (e) {
          console.error("[activities catch]", (e as Error).message)
          report.activitiesErr++
        }
      }

      await sleep(1000)

      // — Poids —
      const weight = await fetchWeight(date)
      if (weight) {
        try {
          const { error } = await supabase.from("weights").upsert(
            {
              user_id: CALSNAP_USER_ID,
              date: weight.date,
              poids: weight.poidsKg,
            },
            { onConflict: "user_id,date" },
          )
          if (!error) {
            report.weightOk = true
            if (weight.masseGrassePct != null) {
              await supabase
                .from("profiles")
                .update({ masse_grasse: weight.masseGrassePct })
                .eq("id", CALSNAP_USER_ID)
            }
          } else {
            console.error("[weights upsert]", error.message, error.code)
          }
        } catch (e) {
          console.error("[weights catch]", (e as Error).message)
          // weightOk reste false
        }
      }

      reports.push(report)
    }

    const summary = {
      datesTraitees: reports.length,
      tdeeOk: reports.filter((r) => r.tdeeOk).length,
      activitesOk: reports.reduce((acc, r) => acc + r.activitiesOk, 0),
      activitesErr: reports.reduce((acc, r) => acc + r.activitiesErr, 0),
      poidsOk: reports.filter((r) => r.weightOk).length,
    }

    return new Response(
      JSON.stringify({ success: true, reports, summary }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
