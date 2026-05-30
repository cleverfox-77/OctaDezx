// Catch-all proxy: Vercel routes every /api/supabase/* request here.
// The path segments after /api/supabase/ arrive in req.query.path (an array).
const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

export default async function handler(req, res) {
  try {
    // 1. Rebuild the target path from the catch-all segments
    const { path = [] } = req.query;
    const segments = Array.isArray(path) ? path : [path];
    const targetPath = segments.join('/');

    // 2. Preserve the exact original query string (Supabase filters, select, order, etc.)
    const qIndex = req.url.indexOf('?');
    const search = qIndex >= 0 ? req.url.slice(qIndex) : '';

    const destination = `${SUPABASE_URL}/${targetPath}${search}`;
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

    // 5. Proxy the request
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
