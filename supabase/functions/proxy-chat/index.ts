// RETIRED — 2026-06-10 security hardening.
// ----------------------------------------------------------------------------
// This function used to forward arbitrary requests to Supabase with the
// SERVICE ROLE key. Its path allowlist (`/rest/v1/chat_sessions`,
// `/auth/v1/...`, ...) effectively handed service-role access — including the
// GoTrue ADMIN API — to anyone holding the public anon key. Nothing in the
// product uses it anymore (the frontend goes through the credential-forwarding
// Vercel proxy at /api/supabase), so it now returns 410 Gone.
// Do NOT restore the old passthrough behaviour.

Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "proxy-chat has been retired for security reasons." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
