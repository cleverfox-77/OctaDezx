// Single-file proxy. vercel.json rewrites /api/supabase/* here, passing the
// Supabase path as the `__path` query param and preserving all other params.
const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

export default async function handler(req, res) {
  try {
    // 1. Pull the Supabase path out of the rewrite-injected __path param
    const { __path, ...restQuery } = req.query;
    const targetPath = Array.isArray(__path) ? __path.join('/') : (__path || '');

    // 2. Rebuild the original query string (preserve duplicate keys, e.g. multiple filters)
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(restQuery)) {
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
