// Static headers — kept for functions that don't need origin-aware CORS.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Origin-aware CORS. Set the ALLOWED_ORIGINS secret to a comma-separated list
// (e.g. "https://octadezx.com,https://www.octadezx.com") to restrict which
// sites may call the function from a browser. If unset (or "*"), any origin is
// echoed back — note that CORS only constrains browser JS, not server/curl
// callers, so rate-limiting remains the real abuse control.
export function getCorsHeaders(req: Request): Record<string, string> {
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';

  let allowOrigin = '*';
  if (!(allowed.length === 1 && allowed[0] === '*')) {
    allowOrigin = allowed.includes(origin) ? origin : allowed[0] ?? '';
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
