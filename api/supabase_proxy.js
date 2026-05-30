export default async function handler(req, res) {
  const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

  try {
    // Extract everything after /api/supabase_proxy
    const url = new URL(req.url, 'https://placeholder.com');
    const fullPath = url.pathname.replace(/^\/api\/supabase_proxy/, '');
    const destination = `${SUPABASE_URL}${fullPath}${url.search}`;

    console.log('Proxying to:', destination);

    const headers = {};
    for (const key of ['apikey', 'authorization', 'content-type', 'accept', 'prefer', 'range']) {
      if (req.headers[key]) headers[key] = req.headers[key];
    }

    const options = { method: req.method, headers };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = req.body ? JSON.stringify(req.body) : undefined;
      headers['content-type'] = headers['content-type'] || 'application/json';
    }

    const upstream = await fetch(destination, options);
    const text = await upstream.text();

    const ct = upstream.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    const cr = upstream.headers.get('content-range');
    if (cr) res.setHeader('content-range', cr);

    res.status(upstream.status).send(text);

  } catch (err) {
    console.error('PROXY ERROR:', err);
    res.status(500).json({ message: 'Failed to parse response', error: err.message });
  }
}
