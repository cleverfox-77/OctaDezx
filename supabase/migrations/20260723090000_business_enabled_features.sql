-- ============================================================================
-- Migration: Per-business dashboard feature selection
-- Date: 2026-07-23
-- Description:
--   Owners pick which optional dashboard sections they want during onboarding
--   (and can change them later). We store the chosen section ids here.
--   NULL  = legacy business, show every section its type would normally show.
--   text[] = show only these optional sections, plus the always-on core ones.
-- ============================================================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS enabled_features text[];

COMMENT ON COLUMN public.businesses.enabled_features IS
  'Optional dashboard section ids the owner enabled. NULL = show all (legacy). Core sections (overview, train, chats, analytics, api-keys, claude-mcp, tutorial) always show regardless.';
