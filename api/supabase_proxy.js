const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

export default async function handler(req, res) {
  // 1. EXTRACT PATH FROM URL (not from query params)
  // req.url = /api/supabase/rest/v1/businesses?id=eq.123
  const rawUrl = req.url;
  const pathStart = rawUrl.indexOf('/api/supabase/');
  const afterProxy = rawUrl.slice(pathStart + '/api/supabase/'.length);

  // Split path and query string
  const [path, ...qsParts] = afterProxy.split('?');
  const queryString = qsParts.join('?');

  const destination = `${SUPABASE_URL}/${path}${queryString ? '?' + queryString : ''}`;

  // 2. FORWARD ONLY NECESSARY HEADERS
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

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const body = await getRawBody(req);
    if (body) {
      fetchOptions.body = body;
      forwardHeaders['content-type'] = forwardHeaders['content-type'] || 'application/json';
    }
  }

  // 4. PROXY TO SUPABASE
  const supabaseResponse = await fetch(destination, fetchOptions);

  // 5. FORWARD RESPONSE HEADERS
  const allowedResponseHeaders = ['content-type', 'content-range', 'x-total-count', 'range-unit'];
  for (const header of allowedResponseHeaders) {
    const value = supabaseResponse.headers.get(header);
    if (value) res.setHeader(header, value);
  }

  // 6. RETURN RESPONSE
  const data = await supabaseResponse.text();
  res.status(supabaseResponse.status).send(data);
}

// Helper to read raw request body
function getRawBody(req) {
  return new Promis
