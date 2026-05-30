// supabase/functions/proxy-chat/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // Get from env vars

// Define allowed paths for security
const ALLOWED_PATHS = [
  '/rest/v1/chat_messages',
  '/rest/v1/chat_sessions', 
  '/rest/v1/rpc/get_public_business',
  '/storage/v1/object/chat-files/',
  '/functions/v1/ai-chat-response',
  '/auth/v1/'
];

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
      } 
    });
  }

  try {
    // Check if environment variables are set
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const url = new URL(req.url);
    const pathname = url.pathname.replace('/proxy-chat', '');
    
    // Security: Validate the requested path
    const isAllowed = ALLOWED_PATHS.some(allowedPath => pathname.startsWith(allowedPath));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Path not allowed' }), {
        status: 403,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' 
        },
      });
    }

    // Get the full URL to forward to
    const targetUrl = `${SUPABASE_URL}${pathname}${url.search}`;
    
    // Prepare headers for Supabase
    const headers = new Headers({
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': req.headers.get('Content-Type') || 'application/json',
      'Prefer': req.headers.get('Prefer') || '',
    });

    // Forward the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    });

    // Get the response data
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      },
    });
  }
});