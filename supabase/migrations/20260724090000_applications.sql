-- ============================================================================
-- Migration: Public applications (careers + affiliate program)
-- Date: 2026-07-24
-- Description:
--   One table backing both the /careers job application form and the
--   /affiliates partner application form. Both forms are public, so anon
--   INSERT is allowed but constrained by a strict WITH CHECK (shape, lengths,
--   email format, status pinned to 'new'). Only platform admins can read or
--   triage. Every statement is guarded so the file is safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.applications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT NOT NULL CHECK (kind IN ('career', 'affiliate')),
  role       TEXT,          -- career: role slug (client-acquisition | growth-marketer)
  full_name  TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  country    TEXT,
  link       TEXT,          -- portfolio, LinkedIn, or audience link
  audience   TEXT,          -- affiliate: where they will promote OctaDezx
  experience TEXT,          -- years of experience bucket
  message    TEXT,
  source     TEXT,          -- referrer / utm, for attribution
  status     TEXT NOT NULL DEFAULT 'new'
             CHECK (status IN ('new', 'reviewing', 'shortlisted', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_kind_created
  ON public.applications (kind, created_at DESC);

-- One application per email per programme, so a refreshed form or a spam loop
-- cannot flood the table. The UI turns the 23505 into a friendly message.
CREATE UNIQUE INDEX IF NOT EXISTS uq_applications_kind_email
  ON public.applications (kind, lower(email));

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Anyone (logged in or not) may submit, within tight bounds.
DROP POLICY IF EXISTS "anyone can apply" ON public.applications;
CREATE POLICY "anyone can apply"
  ON public.applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    kind IN ('career', 'affiliate')
    AND status = 'new'
    AND length(full_name) BETWEEN 2 AND 120
    AND length(email) <= 200
    AND email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    AND COALESCE(length(role), 0)       <= 80
    AND COALESCE(length(phone), 0)      <= 40
    AND COALESCE(length(country), 0)    <= 80
    AND COALESCE(length(link), 0)       <= 300
    AND COALESCE(length(audience), 0)   <= 400
    AND COALESCE(length(experience), 0) <= 80
    AND COALESCE(length(message), 0)    <= 3000
    AND COALESCE(length(source), 0)     <= 200
  );

-- Nobody but a platform admin can read applications back.
DROP POLICY IF EXISTS "admins read applications" ON public.applications;
CREATE POLICY "admins read applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admins update applications" ON public.applications;
CREATE POLICY "admins update applications"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

COMMENT ON TABLE public.applications IS
  'Public career and affiliate-program applications submitted from the marketing site.';
