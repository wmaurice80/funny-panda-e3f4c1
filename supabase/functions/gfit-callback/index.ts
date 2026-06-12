// gfit-callback — OAuth Google Fit relay pour APK Capacitor
// Reçoit le code Google, redirige vers le custom scheme de l'app (server-side 302)
// verify_jwt: false — appelé par Google, pas par l'app

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(
      `com.wmaurice.calsnap://auth/google/callback?error=${encodeURIComponent(error)}`,
      302
    );
  }

  if (!code) {
    return new Response('Missing code parameter', { status: 400 });
  }

  return Response.redirect(
    `com.wmaurice.calsnap://auth/google/callback?code=${encodeURIComponent(code)}`,
    302
  );
});
