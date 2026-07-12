-- ============================================================================
-- Migration: MCP OAuth 2.1 token store (ADDITIVE)
-- Date: 2026-06-22
-- ----------------------------------------------------------------------------
-- Lets businesses connect the OctaDezx MCP to Claude with the one-click
-- "Add custom connector" flow (OAuth 2.1: dynamic client registration + PKCE),
-- instead of pasting an odx_ API key into a header. The legacy api_keys path
-- keeps working for Claude Desktop / non-OAuth clients.
--
-- octadezx.com (Vercel functions) is the authorization server; the Supabase
-- `mcp` edge function is the resource server. These tables back the flow:
--   • oauth_clients            — dynamically-registered MCP clients (Claude)
--   • oauth_authorization_codes — short-lived codes minted at consent
--   • oauth_access_tokens      — bearer tokens the MCP server validates
--   • oauth_refresh_tokens     — long-lived rotation tokens
--
-- Secret material (codes, access/refresh tokens) is stored ONLY as a SHA-256
-- hash, exactly like public.api_keys (see 20260610000000_business_types_api_keys).
-- All writes/reads happen through the service role (Vercel + edge functions);
-- RLS denies everyone else.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─── 1) REGISTERED CLIENTS (RFC 7591 Dynamic Client Registration) ────────────
-- Claude registers itself on first connect and gets a client_id back. Public
-- clients (PKCE) have no secret; client_secret is kept for completeness.
CREATE TABLE IF NOT EXISTS public.oauth_clients (
  client_id     text PRIMARY KEY,
  client_secret text,
  client_name   text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 2) AUTHORIZATION CODES ──────────────────────────────────────────────────
-- Minted when the owner clicks "Authorize" on the consent page; exchanged once
-- at the token endpoint for an access token. Single-use + short TTL.
CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  code_hash             text PRIMARY KEY,
  client_id             text NOT NULL,
  business_id           uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL,
  redirect_uri          text NOT NULL,
  code_challenge        text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope                 text,
  resource              text,
  expires_at            timestamptz NOT NULL,
  used_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_codes_expiry_idx ON public.oauth_authorization_codes (expires_at);

-- ─── 3) ACCESS TOKENS ────────────────────────────────────────────────────────
-- The bearer the MCP edge function validates → business_id. Hash only.
CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
  token_hash   text PRIMARY KEY,
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  client_id    text NOT NULL,
  scope        text,
  resource     text,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_access_tokens_business_idx ON public.oauth_access_tokens (business_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_expiry_idx ON public.oauth_access_tokens (expires_at);

-- ─── 4) REFRESH TOKENS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oauth_refresh_tokens (
  token_hash  text PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  client_id   text NOT NULL,
  scope       text,
  resource    text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_refresh_tokens_business_idx ON public.oauth_refresh_tokens (business_id);

-- ─── 5) RLS — service role only ──────────────────────────────────────────────
-- Every table is touched exclusively by the service role (Vercel OAuth
-- endpoints + the mcp edge function). No anon/authenticated access; the
-- consent page never reads these directly (it calls /api/oauth/approve which
-- runs with the service role after verifying the user's Supabase JWT).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'oauth_clients',
    'oauth_authorization_codes',
    'oauth_access_tokens',
    'oauth_refresh_tokens'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Service role manages %1$s" ON public.%1$I;', t);
    EXECUTE format(
      'CREATE POLICY "Service role manages %1$s" ON public.%1$I FOR ALL '
      || 'USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'');',
      t
    );
  END LOOP;
END $$;

-- Owners may view their live MCP connections (so a future dashboard can list /
-- revoke them). Only non-secret metadata is exposed; the hash is useless alone.
DROP POLICY IF EXISTS "Owners view their mcp tokens" ON public.oauth_access_tokens;
CREATE POLICY "Owners view their mcp tokens"
  ON public.oauth_access_tokens FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));
