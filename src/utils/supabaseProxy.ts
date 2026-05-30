// src/utils/supabaseProxy.ts
import { supabase } from "@/integrations/supabase/client";
import { authDebugger } from "./authDebugger";

// Use local proxy instead of direct Supabase URL
// This routes through YOUR domain, avoiding browser blocking
const PROXY_BASE_URL = '/api/supabase';

// Get Supabase credentials - with fallback for different environments
const getEnvVar = (key: string): string => {
  // Try import.meta.env first (Vite)
  if (import.meta.env?.[key]) {
    return import.meta.env[key];
  }
  // Try process.env (some build tools)
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  // Try window (if injected at runtime)
  if (typeof window !== 'undefined' && (window as any)?.[key]) {
    return (window as any)[key];
  }
  console.error(`Environment variable ${key} is not defined!`);
  return '';
};

// The anon key is intentionally public (Supabase design); RLS policies protect data.
// No hardcoded fallback — if the env var is missing the build should fail loudly.
const SUPABASE_ANON_KEY = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Validate that a string is a proper UUID (v4) before using it in API paths
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Log configuration on load (for debugging, never log keys)
console.log('✅ Using proxy-based Supabase connection');
console.log('📡 Proxy URL:', PROXY_BASE_URL);

// Detect in-app browsers and problematic environments
export function isInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  return (
    ua.includes('FBAN') || 
    ua.includes('FBAV') || 
    ua.includes('Instagram') ||
    ua.includes('Twitter') ||
    ua.includes('LinkedInApp') ||
    ua.includes('Snapchat')
  );
}

// Always use proxy - no need to check localStorage anymore
export function shouldUseDirectClient() {
  return false; // Always use proxy for maximum compatibility
}

// Direct Supabase REST API call through proxy with proper authentication
export async function directSupabaseRequest(method: string, path: string, body?: any) {
  // Use local proxy instead of direct Supabase URL
  const url = `${PROXY_BASE_URL}${path}`;
  
  // Ensure we have credentials
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY is missing!');
    return { data: null, error: { message: 'Configuration error: Missing API key' } };
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const options: RequestInit = {
    method: method,
    headers: headers,
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  // Debug logging (never log key values)
  console.log(`🔵 API Request (via proxy): ${method} ${path}`);
  authDebugger.logRequest(method, url, {}, body);

  try {
    const response = await fetch(url, options);
    
    // Try to parse response
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = { message: 'Failed to parse response' };
    }
    
    // Debug logging
    console.log(`${response.ok ? '✅' : '❌'} Response ${response.status}:`, result);
    authDebugger.logResponse(response.status, result);
    
    if (response.status >= 400) {
      console.error(`❌ Supabase API Error: ${response.status}`, result);
      return { data: null, error: result };
    }
    return { data: result, error: null };
  } catch (error) {
    console.error('❌ Proxied request failed:', error);
    authDebugger.logResponse(0, null, error);
    return { data: null, error };
  }
}

// Enhanced fetch with proper Supabase response format and authentication
export async function proxyFetch(method: string, path: string, body?: any) {
  // Just use directSupabaseRequest since we're always using proxy now
  return directSupabaseRequest(method, path, body);
}

// Smart decision maker - always use proxy
export const getSupabaseClient = () => {
  return supabase;
};

// Use this for API calls - always uses proxy
export async function safeSupabaseRequest(method: string, path: string, body?: any) {
  // Always use proxy for maximum compatibility
  return { useClient: false, request: () => directSupabaseRequest(method, path, body) };
}
