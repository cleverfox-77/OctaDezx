// Single-file proxy. vercel.json rewrites /api/supabase/:path* here.
// Vercel injects the matched segments as req.query.path; all other params
// are the caller's original Supabase query (select, filters, limit, ...).
const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

// Routing/internal keys that must NOT be forwarded to Supabase as filters
const INTERNAL_KEYS = new Set(['path', '__path', '__debug']);

export default async function handler(req, res) {
  try {
    // 1. Target path comes from Vercel's named capture (req.query.path)
    const rawPath = req.query.path ?? req.query.__path ?? '';
    const targetPath = Array.isArray(rawPath) ? rawPath.join('/') : rawPath;

    // 2. Rebuild the original query string, dropping internal keys
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (INTERNAL_KEYS.has(key)) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.append(key, value);
    }
    const qs = params.toString();

    const destination = `${SUPABASE_URL}/${targetPath}${qs ? '?' + qs : ''}`;
    console.log('Proxying to:', destination);

    // 3. Forward only the headers Supabase needs
    const headers = {};
    for (const key of ['apikey', 'authorization', 'content-type', 'accept', 'prefer', 'range']) {
      if (req.headers[key]) headers[key] = req.headers[key];
    }

    // 4. Build fetch options
    const options = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = req.body ? JSON.stringify(req.body) : undefined;
      headers['content-type'] = headers['content-type'] || 'application/json';
    }

    // 5. Proxy to Supabase
    const upstream = await fetch(destination, options);
    const text = await upstream.text();

    // 6. Forward relevant response headers back
    for (const header of ['content-type', 'content-range', 'x-total-count', 'range-unit']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    res.status(upstream.status).send(text);
  } catch (err) {
    console.error('PROXY ERROR:', err);
    res.status(500).json({ message: 'Proxy failed', error: err.message });
  }
}
