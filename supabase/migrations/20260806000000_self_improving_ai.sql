-- ============================================================================
-- Migration: Self-improving AI (continuous learning loop)
-- Date: 2026-08-06
--
-- WHY THIS EXISTS
--   The assistant already produces the three signals a support AI needs to get
--   better, and throws all three away:
--     1. A human takes over an escalated chat and writes the RIGHT answer
--        (chat_messages.sender_type = 'human' immediately after a 'ai' message).
--        That pair is a labelled correction and it is the most valuable training
--        data in the product.
--     2. It escalates, gets rephrased at, or gets abandoned. Those are mistakes.
--     3. Some conversations end in an order or a resolution. Those are wins.
--
--   This migration stores the harvested signals, the LESSONS distilled from
--   them, and the KNOWLEDGE GAPS the assistant discovered it cannot answer.
--
-- THE ONE RULE THAT MATTERS
--   A customer types into a chat box. That text is data, never instruction.
--   If a customer could get a sentence of their own into a lesson, they would
--   own the assistant's behaviour for every other customer of that business.
--   So the invariant enforced below at the database level is:
--
--     an AI-distilled lesson is ALWAYS born 'pending', and only a signed-in
--     business owner (auth.uid() = businesses.owner_id) can move a lesson to
--     'approved'. The service role, which is what the edge functions use and
--     which bypasses RLS, cannot approve anything.
--
--   Only 'approved' lessons are ever read into a prompt. So the worst a
--   successful injection can achieve is a suggestion sitting in the owner's
--   review queue, which the owner reads before it can affect anybody.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Shared updated_at trigger for the tables below.
--    Named with the ai_ prefix so it cannot collide with anything existing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Per-business learning settings.
--    Also carries the harvest watermark so a re-run is cheap and idempotent.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_learning_settings (
  business_id           UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled               BOOLEAN NOT NULL DEFAULT true,
  -- Hard ceiling on how much learned text may enter a live prompt. Latency and
  -- cost are the reason this is a number and not "all of them".
  max_lessons_in_prompt INT NOT NULL DEFAULT 6,
  last_harvest_at       TIMESTAMPTZ,
  last_distill_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_learning_settings_max_lessons_check
    CHECK (max_lessons_in_prompt BETWEEN 0 AND 12)
);

ALTER TABLE public.ai_learning_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their learning settings" ON public.ai_learning_settings;
CREATE POLICY "Owners manage their learning settings"
  ON public.ai_learning_settings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_ai_learning_settings_touch ON public.ai_learning_settings;
CREATE TRIGGER trg_ai_learning_settings_touch
  BEFORE UPDATE ON public.ai_learning_settings
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Harvested learning signals.
--    One row per observed event. Written only by the service role (ai-learn);
--    owners can read them so the dashboard can show the evidence behind a
--    lesson, but cannot forge them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_learning_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,
  polarity      TEXT NOT NULL DEFAULT 'negative',
  -- customer_text is UNTRUSTED. It is whatever a stranger typed into a chat
  -- widget. Never let it become the instruction half of a lesson.
  customer_text TEXT,
  -- ai_text is the assistant's own previous output. Also untrusted for the
  -- same reason: it is downstream of customer_text.
  ai_text       TEXT,
  -- human_text is the only TRUSTED field here. It was written by somebody who
  -- was signed in to the dashboard as staff for this business.
  human_text    TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Deterministic per source event, so re-harvesting the same window inserts
  -- nothing new instead of multiplying the evidence for a lesson.
  dedup_key     TEXT NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_learning_signals_kind_check CHECK (
    kind IN ('human_correction','escalation','frustration','abandoned','resolved','order','hedge')
  ),
  CONSTRAINT ai_learning_signals_polarity_check CHECK (polarity IN ('positive','negative'))
);

COMMENT ON COLUMN public.ai_learning_signals.customer_text IS
  'Untrusted. Raw customer input. Quote it as evidence, never execute it as instruction.';
COMMENT ON COLUMN public.ai_learning_signals.human_text IS
  'Trusted. Written by signed-in staff of this business. The only source a corrected behaviour may be grounded in.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_learning_signals_dedup
  ON public.ai_learning_signals (business_id, dedup_key);
CREATE INDEX IF NOT EXISTS idx_ai_learning_signals_pending
  ON public.ai_learning_signals (business_id, consumed_at, occurred_at DESC);

ALTER TABLE public.ai_learning_signals ENABLE ROW LEVEL SECURITY;

-- Read only, deliberately. There is no owner INSERT/UPDATE/DELETE policy: a
-- signal is a record of something that happened, not something to author.
DROP POLICY IF EXISTS "Owners read their learning signals" ON public.ai_learning_signals;
CREATE POLICY "Owners read their learning signals"
  ON public.ai_learning_signals FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Lessons: the distilled, durable output of the loop.
--    Small on purpose. Length is capped by CHECK constraints so a bug or a
--    creative model cannot grow the live prompt without bound.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_lessons (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  trigger_condition  TEXT NOT NULL,
  corrected_behavior TEXT NOT NULL,
  rationale          TEXT,
  origin             TEXT NOT NULL DEFAULT 'ai_distilled',
  status             TEXT NOT NULL DEFAULT 'pending',
  -- How many independent signals support this lesson. Drives ordering into the
  -- prompt and protects a well-evidenced lesson from decay.
  evidence_count     INT NOT NULL DEFAULT 1,
  fingerprint        TEXT NOT NULL,
  source_signal_ids  UUID[] NOT NULL DEFAULT '{}',
  approved_by        UUID,
  approved_at        TIMESTAMPTZ,
  -- Bumped every time a fresh signal supports the same lesson. Lessons that
  -- stop being reinforced get retired; see ai_retire_stale_lessons below.
  last_reinforced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_lessons_origin_check CHECK (origin IN ('ai_distilled','owner')),
  CONSTRAINT ai_lessons_status_check CHECK (status IN ('pending','approved','rejected','retired')),
  -- The live prompt budget, enforced by the database rather than by hoping the
  -- edge function clipped correctly.
  CONSTRAINT ai_lessons_trigger_len_check   CHECK (char_length(trigger_condition)  BETWEEN 3 AND 200),
  CONSTRAINT ai_lessons_behavior_len_check  CHECK (char_length(corrected_behavior) BETWEEN 3 AND 400),
  CONSTRAINT ai_lessons_rationale_len_check CHECK (rationale IS NULL OR char_length(rationale) <= 400),
  CONSTRAINT ai_lessons_evidence_check      CHECK (evidence_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_lessons_fingerprint
  ON public.ai_lessons (business_id, fingerprint);
-- The exact shape of the read ai-chat-response does on every turn.
CREATE INDEX IF NOT EXISTS idx_ai_lessons_serving
  ON public.ai_lessons (business_id, status, evidence_count DESC);

ALTER TABLE public.ai_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their lessons" ON public.ai_lessons;
CREATE POLICY "Owners manage their lessons"
  ON public.ai_lessons FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3a. The human-veto invariant.
--
-- This is the load-bearing security control of the whole feature, so it lives
-- in the database where neither an edge function bug nor a compromised service
-- key can route around it.
--
--   INSERT: unless the inserting session IS the business owner, the row is
--           forced to origin='ai_distilled', status='pending'. The service role
--           has a NULL auth.uid(), so every machine-written lesson is pending.
--   UPDATE: a transition INTO 'approved' requires auth.uid() to be the owner.
--           Machines may still retire, reinforce or reject.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_lessons_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_owner BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = auth.uid()
  ) INTO is_owner;

  IF TG_OP = 'INSERT' THEN
    IF NOT is_owner THEN
      NEW.origin := 'ai_distilled';
      NEW.status := 'pending';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSIF NEW.status = 'approved' THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF NOT is_owner THEN
      RAISE EXCEPTION 'Only the business owner can approve an AI lesson'
        USING ERRCODE = '42501';
    END IF;
    NEW.approved_by := auth.uid();
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;

  -- The business a lesson belongs to is never editable. Moving a lesson between
  -- tenants is the one thing that would break isolation.
  NEW.business_id := OLD.business_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_lessons_guard ON public.ai_lessons;
CREATE TRIGGER trg_ai_lessons_guard
  BEFORE INSERT OR UPDATE ON public.ai_lessons
  FOR EACH ROW EXECUTE FUNCTION public.ai_lessons_guard();

DROP TRIGGER IF EXISTS trg_ai_lessons_touch ON public.ai_lessons;
CREATE TRIGGER trg_ai_lessons_touch
  BEFORE UPDATE ON public.ai_lessons
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Knowledge gaps: what the assistant knows it does not know.
--    A gap is a question that was asked and could not be answered from the
--    business's own data. Grouped by fingerprint so "asked 14 times" is real.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_knowledge_gaps (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Untrusted customer text, stored verbatim so the owner sees what was really
  -- asked. Rendered as text, never as instruction.
  question            TEXT NOT NULL,
  example_questions   TEXT[] NOT NULL DEFAULT '{}',
  times_asked         INT NOT NULL DEFAULT 1,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT NOT NULL DEFAULT 'open',
  resolved_article_id UUID REFERENCES public.knowledge_base_articles(id) ON DELETE SET NULL,
  fingerprint         TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_gaps_status_check CHECK (status IN ('open','answered','dismissed')),
  CONSTRAINT ai_knowledge_gaps_question_len_check CHECK (char_length(question) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_knowledge_gaps_fingerprint
  ON public.ai_knowledge_gaps (business_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_gaps_open
  ON public.ai_knowledge_gaps (business_id, status, times_asked DESC);

ALTER TABLE public.ai_knowledge_gaps ENABLE ROW LEVEL SECURITY;

-- Owners may read, dismiss and mark answered. Only the service role creates
-- gaps, because a gap is an observation.
DROP POLICY IF EXISTS "Owners read their knowledge gaps" ON public.ai_knowledge_gaps;
CREATE POLICY "Owners read their knowledge gaps"
  ON public.ai_knowledge_gaps FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners resolve their knowledge gaps" ON public.ai_knowledge_gaps;
CREATE POLICY "Owners resolve their knowledge gaps"
  ON public.ai_knowledge_gaps FOR UPDATE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners delete their knowledge gaps" ON public.ai_knowledge_gaps;
CREATE POLICY "Owners delete their knowledge gaps"
  ON public.ai_knowledge_gaps FOR DELETE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_ai_knowledge_gaps_touch ON public.ai_knowledge_gaps;
CREATE TRIGGER trg_ai_knowledge_gaps_touch
  BEFORE UPDATE ON public.ai_knowledge_gaps
  FOR EACH ROW EXECUTE FUNCTION public.ai_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Run log. Cheap, and the only way to answer "why did nothing change".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_learning_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  route             TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  signals_found     INT NOT NULL DEFAULT 0,
  gaps_touched      INT NOT NULL DEFAULT 0,
  lessons_proposed  INT NOT NULL DEFAULT 0,
  lessons_reinforced INT NOT NULL DEFAULT 0,
  lessons_retired   INT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'running',
  error             TEXT,
  CONSTRAINT ai_learning_runs_status_check CHECK (status IN ('running','ok','error','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_runs_biz
  ON public.ai_learning_runs (business_id, started_at DESC);

ALTER TABLE public.ai_learning_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their learning runs" ON public.ai_learning_runs;
CREATE POLICY "Owners read their learning runs"
  ON public.ai_learning_runs FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 6. Decay. A lesson that no longer matches anything that happens is noise in
--    the prompt, and noise costs tokens on every single chat turn.
--
--    Retires approved, thinly-evidenced lessons that have not been reinforced
--    for p_days. Well-evidenced lessons (5 or more supporting signals) are kept:
--    those describe stable business behaviour, not a one-off.
--    Owner-authored lessons are never auto-retired. The owner meant those.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_retire_stale_lessons(
  p_business_id UUID,
  p_days        INT DEFAULT 90
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  retired INT;
BEGIN
  UPDATE public.ai_lessons
     SET status = 'retired'
   WHERE business_id = p_business_id
     AND status = 'approved'
     AND origin = 'ai_distilled'
     AND evidence_count < 5
     AND last_reinforced_at < now() - make_interval(days => GREATEST(p_days, 7));
  GET DIAGNOSTICS retired = ROW_COUNT;
  RETURN retired;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_retire_stale_lessons(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_retire_stale_lessons(UUID, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_retire_stale_lessons(UUID, INT) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Scorecard: the honest before/after number.
--
--    Escalation rate is the metric that actually moves when the assistant
--    learns, because an escalation is by definition "the AI could not do it".
--    Compared over the 30 days before the business's first approved lesson
--    against everything since. Returns nulls rather than a flattering guess
--    when there is not enough data yet.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_learning_scorecard(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner   BOOLEAN;
  since      TIMESTAMPTZ;
  before_tot INT;
  before_esc INT;
  after_tot  INT;
  after_esc  INT;
BEGIN
  -- SECURITY DEFINER means RLS does not apply inside this function, so the
  -- tenant check is explicit and first.
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p_business_id AND b.owner_id = auth.uid()
  ) INTO is_owner;
  IF NOT is_owner THEN
    RAISE EXCEPTION 'Not your business' USING ERRCODE = '42501';
  END IF;

  SELECT MIN(approved_at) INTO since
    FROM public.ai_lessons
   WHERE business_id = p_business_id AND approved_at IS NOT NULL;

  IF since IS NULL THEN
    RETURN jsonb_build_object(
      'learning_started_at', NULL,
      'before', NULL,
      'after', NULL,
      'approved_lessons', (SELECT count(*) FROM public.ai_lessons
                            WHERE business_id = p_business_id AND status = 'approved'),
      'pending_lessons', (SELECT count(*) FROM public.ai_lessons
                            WHERE business_id = p_business_id AND status = 'pending'),
      'open_gaps', (SELECT count(*) FROM public.ai_knowledge_gaps
                            WHERE business_id = p_business_id AND status = 'open')
    );
  END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'escalated')
    INTO before_tot, before_esc
    FROM public.chat_sessions
   WHERE business_id = p_business_id
     AND created_at >= since - INTERVAL '30 days'
     AND created_at <  since;

  SELECT count(*), count(*) FILTER (WHERE status = 'escalated')
    INTO after_tot, after_esc
    FROM public.chat_sessions
   WHERE business_id = p_business_id
     AND created_at >= since;

  RETURN jsonb_build_object(
    'learning_started_at', since,
    'before', jsonb_build_object(
      'sessions', before_tot,
      'escalated', before_esc,
      'escalation_rate', CASE WHEN before_tot > 0
        THEN round((before_esc::NUMERIC / before_tot) * 100, 1) END
    ),
    'after', jsonb_build_object(
      'sessions', after_tot,
      'escalated', after_esc,
      'escalation_rate', CASE WHEN after_tot > 0
        THEN round((after_esc::NUMERIC / after_tot) * 100, 1) END
    ),
    'approved_lessons', (SELECT count(*) FROM public.ai_lessons
                          WHERE business_id = p_business_id AND status = 'approved'),
    'pending_lessons', (SELECT count(*) FROM public.ai_lessons
                          WHERE business_id = p_business_id AND status = 'pending'),
    'open_gaps', (SELECT count(*) FROM public.ai_knowledge_gaps
                          WHERE business_id = p_business_id AND status = 'open')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_learning_scorecard(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_learning_scorecard(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.ai_learning_scorecard(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7a. Upserts that have to be atomic increments.
--
--     PostgREST cannot express "on conflict, add one to a counter", and doing
--     it as read-then-write from an edge function races with itself the moment
--     two runs overlap. Both of these live here instead.
-- ---------------------------------------------------------------------------

-- A gap that is asked again is the same gap, counted once more.
CREATE OR REPLACE FUNCTION public.ai_upsert_knowledge_gap(
  p_business_id UUID,
  p_fingerprint TEXT,
  p_question    TEXT,
  p_seen_at     TIMESTAMPTZ DEFAULT now(),
  p_increment   INT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gap_id UUID;
  inc    INT := GREATEST(1, LEAST(COALESCE(p_increment, 1), 500));
BEGIN
  INSERT INTO public.ai_knowledge_gaps
    (business_id, fingerprint, question, example_questions, times_asked, first_seen_at, last_seen_at)
  VALUES
    (p_business_id, p_fingerprint, left(p_question, 500), ARRAY[left(p_question, 500)], inc, p_seen_at, p_seen_at)
  ON CONFLICT (business_id, fingerprint) DO UPDATE
    SET times_asked  = public.ai_knowledge_gaps.times_asked + inc,
        last_seen_at = GREATEST(public.ai_knowledge_gaps.last_seen_at, EXCLUDED.last_seen_at),
        -- Keep at most five verbatim phrasings. The owner needs to recognise
        -- the question, not read every instance of it.
        example_questions = (
          SELECT ARRAY(
            SELECT DISTINCT e FROM unnest(
              public.ai_knowledge_gaps.example_questions || EXCLUDED.example_questions
            ) AS e LIMIT 5
          )
        ),
        -- An answered gap that starts being asked again is open again.
        status = CASE WHEN public.ai_knowledge_gaps.status = 'dismissed'
                      THEN 'dismissed' ELSE 'open' END
  RETURNING id INTO gap_id;
  RETURN gap_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_upsert_knowledge_gap(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_upsert_knowledge_gap(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_upsert_knowledge_gap(UUID, TEXT, TEXT, TIMESTAMPTZ, INT) TO service_role;

-- A lesson proposed again is the same lesson, with more evidence behind it.
--
-- Note what this deliberately does NOT do: it never revives a lesson the owner
-- rejected. Re-proposing something an owner has already said no to, over and
-- over, is how a review queue becomes something nobody reads.
CREATE OR REPLACE FUNCTION public.ai_upsert_lesson(
  p_business_id UUID,
  p_fingerprint TEXT,
  p_trigger     TEXT,
  p_behavior    TEXT,
  p_rationale   TEXT,
  p_signal_ids  UUID[] DEFAULT '{}'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.ai_lessons%ROWTYPE;
BEGIN
  SELECT * INTO existing FROM public.ai_lessons
   WHERE business_id = p_business_id AND fingerprint = p_fingerprint;

  IF NOT FOUND THEN
    INSERT INTO public.ai_lessons
      (business_id, fingerprint, trigger_condition, corrected_behavior, rationale, source_signal_ids)
    VALUES
      (p_business_id, p_fingerprint, left(p_trigger, 200), left(p_behavior, 400),
       left(p_rationale, 400), p_signal_ids);
    RETURN 'created';
  END IF;

  IF existing.status = 'rejected' THEN
    RETURN 'skipped_rejected';
  END IF;

  UPDATE public.ai_lessons
     SET evidence_count     = evidence_count + 1,
         last_reinforced_at = now(),
         source_signal_ids  = (
           SELECT ARRAY(SELECT DISTINCT s FROM unnest(source_signal_ids || p_signal_ids) AS s LIMIT 25)
         ),
         status = CASE WHEN status = 'retired' THEN 'pending' ELSE status END
   WHERE id = existing.id;
  RETURN 'reinforced';
END;
$$;

REVOKE ALL ON FUNCTION public.ai_upsert_lesson(UUID, TEXT, TEXT, TEXT, TEXT, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ai_upsert_lesson(UUID, TEXT, TEXT, TEXT, TEXT, UUID[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_upsert_lesson(UUID, TEXT, TEXT, TEXT, TEXT, UUID[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Backfill a settings row for every existing business, so the first run of
--    ai-learn has a watermark to work from instead of scanning all of history.
--    Watermarks start 30 days back: enough to bootstrap from the escalations
--    and human replies already in the table, bounded enough to stay cheap.
-- ---------------------------------------------------------------------------
INSERT INTO public.ai_learning_settings (business_id, last_harvest_at)
SELECT b.id, now() - INTERVAL '30 days'
  FROM public.businesses b
ON CONFLICT (business_id) DO NOTHING;

-- Keep new businesses in the loop without an application code change.
CREATE OR REPLACE FUNCTION public.ai_learning_settings_for_new_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_learning_settings (business_id, last_harvest_at)
  VALUES (NEW.id, now())
  ON CONFLICT (business_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_learning_settings_seed ON public.businesses;
CREATE TRIGGER trg_ai_learning_settings_seed
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.ai_learning_settings_for_new_business();
