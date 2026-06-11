// ai-proxy — Edge Function Supabase
// Proxy sécurisé pour les appels IA (Anthropic + Gemini).
// Les clés API sont dans les secrets Supabase, jamais dans le bundle client.
// Utilise Deno.serve natif (pas d'import deno.land/std) et npm: specifiers.

import { createClient } from "npm:@supabase/supabase-js@2"

// Client Supabase instancié une seule fois (hors handler)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
)

const ALLOWED_ORIGINS = [
  "https://calsnapwmp.netlify.app",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_MODEL   = "claude-haiku-4-5-20251001"
const GEMINI_MODEL      = "gemini-2.0-flash"
const GEMINI_API_URL    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? ""
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://calsnapwmp.netlify.app"
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  // ── Validation JWT ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace("Bearer ", "").trim()

  if (!token) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders })
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let provider: string
  let body: Record<string, unknown>
  try {
    const parsed = await req.json()
    provider = parsed.provider
    body = parsed.body
    if (!provider || !body) throw new Error("Champs 'provider' et 'body' requis.")
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  // ── Routing ────────────────────────────────────────────────────────────────
  try {
    if (provider === "claude") {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY non configurée.")

      // Whitelist explicite — modèle fixé côté serveur, non surchargeable
      const payload: Record<string, unknown> = {
        model:      ANTHROPIC_MODEL,
        messages:   body.messages,
        max_tokens: (body.max_tokens as number) ?? 1024,
      }
      if (body.system) payload.system = body.system

      const upstream = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const upstreamBody = await upstream.text()
      return new Response(upstreamBody, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (provider === "gemini") {
      const geminiKey = Deno.env.get("GEMINI_API_KEY")
      if (!geminiKey) throw new Error("GEMINI_API_KEY non configurée.")

      // body est déjà au format Gemini (traduit côté client dans claudeApi.js)
      const upstream = await fetch(`${GEMINI_API_URL}?key=${geminiKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })

      const upstreamBody = await upstream.text()
      return new Response(upstreamBody, {
        status: upstream.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({ error: `Provider inconnu : ${provider}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
