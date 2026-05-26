import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  createGarminClient,
  fetchActivities,
  fetchDailySummary,
  fetchWeight,
} from "./garmin.ts"
import type { SyncReport } from "./types.ts"

const GARMIN_EMAIL = Deno.env.get("GARMIN_EMAIL")!
const GARMIN_PASSWORD = Deno.env.get("GARMIN_PASSWORD")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const CALSNAP_USER_ID = Deno.env.get("CALSNAP_USER_ID")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://calsnapwmp.netlify.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function generateDates(days: number): string[] {
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
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
    let days = 1
    try {
      const body = await req.json()
      if (typeof body?.days === "number" && body.days > 0) {
        days = Math.min(body.days, 30) // sécurité : max 30 jours
      }
    } catch {
      // body absent ou invalide → on garde le défaut
    }

    const dates = generateDates(days)

    let garminClient: Awaited<ReturnType<typeof createGarminClient>>
    try {
      garminClient = await createGarminClient(GARMIN_EMAIL, GARMIN_PASSWORD)
    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: (err as Error).message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

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

      // — Daily summary (TDEE) —
      const summary = await fetchDailySummary(garminClient, date)
      if (summary) {
        try {
          const { error } = await supabase
            .from("profiles")
            .update({ tdee_mesure: summary.tdeeKcal })
            .eq("id", CALSNAP_USER_ID)
          if (!error) report.tdeeOk = true
        } catch {
          // erreur silencieuse, tdeeOk reste false
        }
      }

      await sleep(1000)

      // — Activités —
      const activities = await fetchActivities(garminClient, date)
      for (const activity of activities) {
        try {
          const { error } = await supabase.from("activities").upsert(
            {
              user_id: CALSNAP_USER_ID,
              garmin_activity_id: activity.garminActivityId,
              date: activity.date,
              heure: activity.heure,
              type: activity.type,
              duree: activity.duree,
              calories_brulees: activity.caloriesBrulees,
              note: activity.note,
            },
            { onConflict: "user_id,garmin_activity_id" },
          )
          if (!error) {
            report.activitiesOk++
          } else {
            report.activitiesErr++
          }
        } catch {
          report.activitiesErr++
        }
      }

      await sleep(1000)

      // — Poids —
      const weight = await fetchWeight(garminClient, date)
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
          }
        } catch {
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
