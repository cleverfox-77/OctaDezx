-- ============================================================================
-- Migration: Facebook / Instagram comment auto-reply
-- Date: 2026-07-20
-- Description:
--   Owner opt-in flags for replying to Page/IG comments, plus a small dedupe
--   table so a redelivered comment webhook never triggers a second reply.
-- ============================================================================

-- 1. Opt-in + reply mode on the integration row
ALTER TABLE public.platform_integrations
  ADD COLUMN IF NOT EXISTS comment_autoreply_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comment_reply_mode TEXT NOT NULL DEFAULT 'public';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'platform_integrations_comment_reply_mode_check'
  ) THEN
    ALTER TABLE public.platform_integrations
      ADD CONSTRAINT platform_integrations_comment_reply_mode_check
      CHECK (comment_reply_mode IN ('public', 'private', 'both'));
  END IF;
END $$;

-- 2. Dedupe: remember comments we've already answered (Meta can redeliver webhooks)
CREATE TABLE IF NOT EXISTS public.processed_comments (
  comment_id  TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processed_comments_biz
  ON public.processed_comments (business_id, created_at);

ALTER TABLE public.processed_comments ENABLE ROW LEVEL SECURITY;

-- Service role only (the platform-webhook edge function uses the service key)
DROP POLICY IF EXISTS "Service role full access on processed_comments" ON public.processed_comments;
CREATE POLICY "Service role full access on processed_comments"
  ON public.processed_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);
