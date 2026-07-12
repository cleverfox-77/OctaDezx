// Shared helpers for the OctaDezx MCP OAuth 2.1 authorization server.
// ----------------------------------------------------------------------------
// octadezx.com (these Vercel functions) is the auth server; the Supabase `mcp`
// edge function is the resource server. We keep these functions dependency-free
// (plain fetch against Supabase REST + Auth, like api/supabase_proxy.js) so they
// stay tiny and cold-start fast.
//
// Tokens/codes are stored ONLY as SHA-256 hashes (see the 20260622 migration).
// The service role key is read from the SUPABASE_SERVICE_ROLE_KEY env var and
// must be set in the Vercel project before deploy.
//
// NOTE: this file is a shared lib, prefixed with "_" so Vercel does not route
// it. The default export is a harmless 404 in case it ever is routed.
import crypto from "node:crypto";

export const SUPABASE_URL = "https://dnjhvfmlmvhabrlpcmao.supabase.co";

// Public anon key (already shipped in the frontend bundle) — used only to call
// the Auth API when verifying a user's own JWT. Not a secret.
export const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuamh2Zm1sbXZoYWJybHBjbWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMDE1MjQsImV4cCI6MjA3MjY3NzUyNH0.np24-bIV9yTrJ6_HbBePDvGN01ctc7j86u4qqZUOyK4";

export const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Canonical auth-server + resource identifiers. octadezx.com fronts both.
export const ISSUER = "https://octadezx.com";
export const MCP_RESOURCE = "https://octadezx.com/mcp";
export const SCOPE = "octadezx";

// Lifetimes.
export const CODE_TTL_SEC = 5 * 60; // authorization code
export const ACCESS_TTL_SEC = 60 * 60; // access token (1h)
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // refresh token (30d)

// ── crypto / encoding ────────────────────────────────────────────────────────
export const sha256hex = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const sha256b64url = (s) => crypto.createHash("sha256").update(s).digest("base64url");
export const randomToken = (prefix, bytes = 32) =>
  prefix + crypto.randomBytes(bytes).toString("base64url");

// ── HTTP helpers ─────────────────────────────────────────────────────────────
export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, mcp-protocol-version");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// Handle a CORS preflight. Returns true if the request was a preflight (caller
// should stop). Always applies CORS headers.
export function handledPreflight(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function sendJson(res, status, obj) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(obj));
}

// OAuth error response (RFC 6749 §5.2 shape).
export function oauthError(res, status, error, description) {
  sendJson(res, status, { error, error_description: description });
}

// Parse a request body whether Vercel handed us an object (json / urlencoded
// auto-parse), a raw string, or nothing.
export function readBody(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  const raw = Buffer.isBuffer(b) ? b.toString("utf8") : typeof b === "string" ? b : "";
  if (!raw) return {};
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

// ── Supabase REST (service role — bypasses RLS) ──────────────────────────────
function svcHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function restSelect(table, query = "") {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: svcHeaders() });
  if (!r.ok) throw new Error(`select ${table} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function restInsert(table, row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: svcHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`insert ${table} failed: ${r.status} ${await r.text()}`);
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function restPatch(table, query, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: svcHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch ${table} failed: ${r.status} ${await r.text()}`);
  return r.json();
}

// Verify a user's own Supabase access token → user object ({id,email,...}) or null.
export async function verifyUser(accessToken) {
  if (!accessToken) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// ── redirect_uri allowlist ───────────────────────────────────────────────────
// Only Claude's hosts (https) and loopback (http, for Desktop/CLI) may be
// registered as redirect targets.
export function isAllowedRedirect(uri) {
  let u;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol === "https:") {
    return (
      host === "claude.ai" ||
      host.endsWith(".claude.ai") ||
      host === "claude.com" ||
      host.endsWith(".claude.com") ||
      host === "anthropic.com" ||
      host.endsWith(".anthropic.com")
    );
  }
  if (u.protocol === "http:") {
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  }
  return false;
}

// Defensive default export — see file header.
export default function handler(_req, res) {
  res.status(404).json({ error: "not_found" });
}
