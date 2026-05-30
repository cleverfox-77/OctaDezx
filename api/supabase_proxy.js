const SUPABASE_URL = 'https://dnjhvfmlmvhabrlpcmao.supabase.co';

export default async function handler(req, res) {
  // 1. GET PATH & CLEAN QUERY STRING
  const { __path, ...restQuery } = req.query;
  const path = __path || '';

  const queryString = new URLSearchParams(restQuery).toString();
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
    fetchOptions.body = JSON.stringify(req.body);
    forwardHeaders['content-type'] = forwardHeaders['content-type'] || 'application/json';
  }

  // 4. PROXY REQUEST TO SUPABASE
  const supabaseResponse = await fetch(destination, fetchOptions);

  // 5. FORWARD SUPABASE RESPONSE HEADERS BACK
  const allowedResponseHeaders = ['content-type', 'content-range', 'x-total-count', 'range-unit'];
  for (const header of allowedResponseHeaders) {
    const value = supabaseResponse.headers.get(header);
    if (value) res.setHeader(header, value);
  }

  // 6. RETURN RESPONSE
  const data = await supabaseResponse.text();
  res.status(supabaseResponse.status).send(data);
}
