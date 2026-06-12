// gfit-callback — OAuth Google Fit : échange de token server-side
// verify_jwt: false — appelé par Google OAuth, pas par l'app
//
// Flux :
//   Google → POST /token (server-side) → tokens → redirect custom scheme → APK

const REDIRECT_URI = 'https://lhcouyccseuyczcmatoa.supabase.co/functions/v1/gfit-callback'

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  // Erreur Google (accès refusé etc.)
  if (error) {
    return Response.redirect(
      `com.wmaurice.calsnap://auth/google/callback?error=${encodeURIComponent(error)}`,
      302
    )
  }

  if (!code) {
    return new Response('Missing code parameter', { status: 400 })
  }

  const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
  const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''

  // Échange du code contre les tokens (server-side, client_secret sécurisé)
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code,
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}))
    const errorMsg = err.error_description || err.error || 'token_exchange_failed'
    console.error('[gfit-callback] Token exchange failed:', errorMsg, err)
    return Response.redirect(
      `com.wmaurice.calsnap://auth/google/callback?error=${encodeURIComponent(errorMsg)}`,
      302
    )
  }

  const tokens = await tokenRes.json()

  // Passe les tokens à l'app via le custom scheme
  const params = new URLSearchParams({
    access_token:  tokens.access_token  ?? '',
    refresh_token: tokens.refresh_token ?? '',
    expires_in:    String(tokens.expires_in ?? 3600),
  })

  return Response.redirect(
    `com.wmaurice.calsnap://auth/google/callback?${params.toString()}`,
    302
  )
})
