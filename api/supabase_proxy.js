const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

export default async function handler(req, res) {
  try {
    // 1. BUILD DESTINATION URL FROM req.url DIRECTLY
    const rawUrl = req.url; 
    // rawUrl looks like: /api/supabase_proxy?... (internal) 
    // but we need the original path from the rewrite
    // The original request path is in req.headers['x-forwarded-uri'] or we parse req.url
    
    const marker = '/api/supabase/';
    const originalUrl = req.headers['x-matched-path'] || req.url;
    
    let afterMarker = '';
    const markerIndex = req.url.indexOf(marker);
    
    if (markerIndex !== -1) {
      afterMarker = req.url.slice(markerIndex + marker.length);
    } else {
      // Fallback: get path from __path query param
      const url = new URL(req.url, 'http://localhost');
      afterMarker = url.searchParams.get('__path') || '';
      url.searchParams.delete('__path');
      const qs = url.searchParams.toString();
      const destination = `${SUPABASE_URL}/${afterMarker}${qs ? '?' + qs : ''}`;
      return await proxyRequest(req, res, destination);
    }

    const [path, ...qsParts] = afterMarker.split('?');
    const queryString = qsParts.join('?');
    const destination = `${SUPABASE_URL}/${path}${queryString ? '?' + queryString : ''}`;

    return await proxyRequest(req, res, destination);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ message: 'Proxy internal error', error: err.message });
  }
}

async function proxyRequest(req, res, destination) {
  // 2. FILTER HEADERS
  const allowedHeaders = /^(apikey|authorization|content-type|accept|prefer|range)$/i;
  const forwardHeaders = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (allowedHeaders.test(key)) {
      forwardHeaders[key] = value;
    }
  }

  // 3. BUILD FETCH OPTIONS
  const fetchOptions = {
    method: req.method,
    headers: forwardHeaders,
  };

  // Vercel pre-parses body — use req.body directly
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    fetchOptions.body = typeof req.body === 'string' 
      ? req.body 
      : JSON.stringify(req.body);
    if (!forwardHeaders['content-type']) {
      forwardHeaders['content-type'] = 'application/json';
    }
  }

  // 4. CALL SUPABASE
  const supabaseRes = await fetch(destination, fetchOptions);

  // 5. FORWARD RESPONSE HEADERS
  const allowedResponseHeaders = ['content-type', 'content-range', 'x-total-count', 'range-unit'];
  for (const header of allowedResponseHeaders) {
    const val = supabaseRes.headers.get(header);
    if (val) res.setHeader(header, val);
  }

  // 6. SEND RESPONSE
  const text = await supabaseRes.text();
  res.status(supabaseRes.status).send(text);
}
