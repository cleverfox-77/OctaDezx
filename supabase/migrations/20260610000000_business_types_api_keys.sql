-- ============================================================================
-- Migration: Business types + API keys + widget bootstrap RPC (ADDITIVE)
-- Date: 2026-06-10
-- ----------------------------------------------------------------------------
-- Part 1 of 2. This migration only ADDS capabilities so the currently-deployed
-- frontend keeps working. The companion migration
-- 20260610000001_security_hardening.sql drops the dangerous blanket policies
-- and must be applied AFTER the new frontend (which sends real user JWTs and
-- uses get_public_business) is live.
-- ============================================================================

-- ─── 1) BUSINESS TYPES ──────────────────────────────────────────────────────
-- OctaDezx now serves any kind of business, not just e-commerce. The type
-- drives the onboarding wizard and the AI's terminology/behaviour.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'ecommerce',
  ADD COLUMN IF NOT EXISTS type_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.businesses.business_type IS
  'ecommerce | retail | agency | saas | restaurant | healthcare | education | finance | realestate | travel | enterprise | other';
COMMENT ON COLUMN public.businesses.type_config IS
  'Type-specific onboarding answers (services offered, booking process, opening hours, ...). Fed to the AI prompt.';

-- ─── 2) API KEYS ────────────────────────────────────────────────────────────
-- Businesses can mint keys to call the public api-v1 edge function from their
-- own website/backend. Only a SHA-256 hash is stored; the plaintext key is
-- shown exactly once at creation time.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name         text NOT NULL DEFAULT 'Default key',
  key_prefix   text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_business_idx ON public.api_keys (business_id);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Owners can list their keys' metadata (the hash is useless without the
-- original high-entropy secret). All writes go through the RPCs below or the
-- service role (api-v1 updating last_used_at).
DROP POLICY IF EXISTS "Owners view their api keys" ON public.api_keys;
CREATE POLICY "Owners view their api keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages api keys" ON public.api_keys;
CREATE POLICY "Service role manages api keys"
  ON public.api_keys FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Mint a new key for a business the caller owns. Returns the plaintext key
-- ONCE; only the hash is persisted.
CREATE OR REPLACE FUNCTION public.create_api_key(p_business_id uuid, p_name text DEFAULT 'Default key')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_prefix text;
  v_hash   text;
  v_id     uuid;
  v_active int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to create keys for this business';
  END IF;

  SELECT count(*) INTO v_active
  FROM public.api_keys
  WHERE business_id = p_business_id AND revoked_at IS NULL;
  IF v_active >= 10 THEN
    RAISE EXCEPTION 'API key limit reached (10 active keys per business)';
  END IF;

  v_secret := 'odx_' || translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_prefix := substring(v_secret FROM 1 FOR 12);
  v_hash   := encode(digest(v_secret, 'sha256'), 'hex');

  INSERT INTO public.api_keys (business_id, name, key_prefix, key_hash)
  VALUES (p_business_id, coalesce(nullif(trim(p_name), ''), 'Default key'), v_prefix, v_hash)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'id', v_id,
    'key', v_secret,
    'key_prefix', v_prefix,
    'name', coalesce(nullif(trim(p_name), ''), 'Default key')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_api_key(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_api_key(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.api_keys k
  SET revoked_at = now()
  WHERE k.id = p_key_id
    AND k.revoked_at IS NULL
    AND k.business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_api_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_api_key(uuid) TO authenticated;

-- ─── 3) WIDGET BOOTSTRAP RPC ────────────────────────────────────────────────
-- The customer chat widget used to SELECT the businesses table directly, which
-- required a blanket public-read policy (leaking ai_instructions/policies of
-- every business). This RPC returns only the fields the widget needs,
-- including the courier check that used to be a separate client query.
DROP FUNCTION IF EXISTS public.get_public_business(uuid);
CREATE FUNCTION public.get_public_business(business_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  business_type text,
  invoice_enabled boolean,
  invoice_auto_generate boolean,
  has_courier boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.name,
    b.description,
    b.business_type,
    coalesce(b.invoice_enabled, false),
    coalesce(b.invoice_auto_generate, false),
    EXISTS (
      SELECT 1 FROM public.platform_integrations pi
      WHERE pi.business_id = b.id
        AND pi.status = 'connected'
        AND pi.platform IN (
          'easypost','shippo','aftership','shiprocket',
          'pathao','steadfast','redx','paperfly','ecourier','sundarban',
          'delhivery','bluedart','dtdc','ekart','xpressbees',
          'tcs','leopards','mnp','ninjavan','jtexpress','lalamove','lbc','kerry','poslaju',
          'sfexpress','cainiao','zto','yto','yamato','cjlogistics',
          'dhl','fedex','ups','usps','tnt',
          'gls','postnl','dpd','hermes','royalmail','colissimo',
          'bpost','deutschepost','correos','posteitaliane',
          'canadapost','correios','estafeta','ontrac','dhlecommerce',
          'auspost','startrack','aramex_au','nzpost',
          'aramex','naqel','smsa','dpd_africa','postnet',
          'cdek','russianpost'
        )
    ) AS has_courier
  FROM public.businesses b
  WHERE b.id = business_id
    AND coalesce(b.is_active, true);
$$;

REVOKE ALL ON FUNCTION public.get_public_business(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_business(uuid) TO anon, authenticated;

-- ─── 4) CUSTOMER SHIPMENT TRACKING ──────────────────────────────────────────
-- The widget's "track my order" reads shipments with the customer's anonymous
-- JWT, but only an owner policy existed — customer tracking silently returned
-- nothing. Scope: a customer may read shipments belonging to orders from THEIR
-- chat sessions only.
DROP POLICY IF EXISTS "Customers can view shipments for their sessions" ON public.shipments;
CREATE POLICY "Customers can view shipments for their sessions"
  ON public.shipments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.chat_sessions s ON s.id = o.session_id
      WHERE o.id = shipments.order_id
        AND s.user_id = auth.uid()
    )
  );
