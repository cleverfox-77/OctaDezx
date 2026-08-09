-- ============================================================================
-- Migration: Voice RPCs (metering, hours, call lifecycle, outbound claim)
-- Date: 2026-08-03
--
-- All SECURITY DEFINER with a pinned search_path and granted to service_role
-- only, matching check_and_record_usage / check_daily_limit.
--
-- The media server runs outside Supabase (Fly.io) and holds a service key. It
-- writes ONLY through these functions rather than raw table access, so a leaked
-- key has a bounded blast radius and the metering rules live in one place.
--
-- Voice allowance is measured in SECONDS, unlike the existing event-based
-- meters. Plan gate decided with the user: Pro and above only.
--
-- Requires: 20260803000000_voice_foundation.sql
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Per-plan voice allowance. One place, unlike the daily/monthly limits which
-- are duplicated across check_daily_limit and check_and_record_usage.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voice_plan_limits(p_plan TEXT)
RETURNS TABLE (monthly_seconds INT, per_call_seconds INT, max_concurrent INT)
LANGUAGE sql IMMUTABLE AS $$
  -- Columns are listed explicitly. SELECT * over the VALUES list would also
  -- return the plan name, giving this branch four columns against the fallback
  -- branch's three, which is a UNION error rather than a silent one.
  SELECT t.month_secs, t.call_secs, t.concurrent
    FROM (VALUES
      ('pro',        300 * 60,  10 * 60,  3),
      ('advanced',  1200 * 60,  20 * 60, 10),
      ('enterprise',5000 * 60,  20 * 60, 25)
    ) AS t(plan, month_secs, call_secs, concurrent)
   WHERE t.plan = p_plan
  UNION ALL
  -- free, trial, starter, appsumo_ltd and anything unknown get no voice.
  -- COALESCE matters: a NULL plan against NOT IN yields NULL, which would
  -- return no rows at all instead of a zero allowance, and a caller reading
  -- monthly_seconds off an empty record sees NULL rather than 0.
  SELECT 0, 0, 0 WHERE COALESCE(p_plan, '') NOT IN ('pro','advanced','enterprise');
$$;

-- ---------------------------------------------------------------------------
-- Is the business open right now, in ITS OWN timezone?
-- Exceptions (holidays) win over the weekly grid. Done in SQL so the media
-- server and the dashboard can never disagree about the answer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_business_open(p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tz     TEXT;
  v_local  TIMESTAMP;
  v_date   DATE;
  v_time   TIME;
  v_dow    SMALLINT;
  v_exc    RECORD;
  v_any    BOOLEAN;
BEGIN
  SELECT COALESCE(timezone, 'UTC') INTO v_tz FROM voice_settings WHERE business_id = p_business_id;
  IF v_tz IS NULL THEN v_tz := 'UTC'; END IF;

  v_local := NOW() AT TIME ZONE v_tz;
  v_date  := v_local::date;
  v_time  := v_local::time;
  v_dow   := EXTRACT(DOW FROM v_local)::smallint;

  SELECT * INTO v_exc FROM voice_hours_exceptions
   WHERE business_id = p_business_id AND on_date = v_date;
  IF FOUND THEN
    IF v_exc.is_closed THEN RETURN false; END IF;
    RETURN v_time BETWEEN COALESCE(v_exc.opens_at, '00:00') AND COALESCE(v_exc.closes_at, '23:59:59');
  END IF;

  SELECT EXISTS (SELECT 1 FROM voice_business_hours WHERE business_id = p_business_id) INTO v_any;
  -- No hours configured at all means always available, which is the least
  -- surprising default for a business that just switched voice on.
  IF NOT v_any THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1 FROM voice_business_hours
     WHERE business_id = p_business_id AND day_of_week = v_dow
       AND v_time BETWEEN opens_at AND closes_at
  );
END $$;

-- ---------------------------------------------------------------------------
-- Can this business take a call right now?
-- Called BEFORE answering. A denial routes to voicemail, never a rejection:
-- losing the customer is worse than exceeding a soft limit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_voice_allowance(
  p_business_id UUID,
  p_estimated_seconds INT DEFAULT 60
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan   TEXT;
  v_status TEXT;
  v_lim    RECORD;
  v_used   INT;
  v_active INT;
  v_month  DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  SELECT p.plan_type, p.subscription_status INTO v_plan, v_status
    FROM businesses b JOIN profiles p ON p.user_id = b.owner_id
   WHERE b.id = p_business_id;

  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'No subscription found', 'plan', NULL);
  END IF;
  IF v_status NOT IN ('active','trial','past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Subscription is not active', 'plan', v_plan);
  END IF;

  SELECT * INTO v_lim FROM voice_plan_limits(v_plan);
  IF v_lim.monthly_seconds <= 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Voice calling is available on Pro and above',
      'plan', v_plan, 'seconds_limit', 0);
  END IF;

  SELECT COALESCE(seconds_used, 0) INTO v_used
    FROM voice_usage_monthly WHERE business_id = p_business_id AND usage_month = v_month;
  v_used := COALESCE(v_used, 0);

  IF v_used >= v_lim.monthly_seconds THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Monthly voice minutes used up',
      'plan', v_plan, 'seconds_used', v_used, 'seconds_limit', v_lim.monthly_seconds, 'remaining_seconds', 0);
  END IF;

  SELECT COUNT(*) INTO v_active FROM voice_calls
   WHERE business_id = p_business_id AND status = 'in_progress';
  IF v_active >= v_lim.max_concurrent THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Too many calls in progress',
      'plan', v_plan, 'active_calls', v_active, 'max_concurrent', v_lim.max_concurrent);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 'plan', v_plan,
    'seconds_used', v_used,
    'seconds_limit', v_lim.monthly_seconds,
    'remaining_seconds', v_lim.monthly_seconds - v_used,
    'per_call_seconds', v_lim.per_call_seconds,
    'max_concurrent', v_lim.max_concurrent);
END $$;

-- ---------------------------------------------------------------------------
-- Accrue usage. Called as a heartbeat every 30s during a call plus a final
-- delta at hangup, so a dropped connection still bills what was consumed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_voice_usage(
  p_business_id UUID,
  p_call_id UUID,
  p_seconds INT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan  TEXT;
  v_lim   RECORD;
  v_used  INT;
  v_month DATE := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF p_seconds IS NULL OR p_seconds <= 0 THEN p_seconds := 0; END IF;

  INSERT INTO voice_usage_daily (business_id, usage_date, seconds_used, calls_count)
  VALUES (p_business_id, CURRENT_DATE, p_seconds, 0)
  ON CONFLICT (business_id, usage_date)
  DO UPDATE SET seconds_used = voice_usage_daily.seconds_used + EXCLUDED.seconds_used;

  INSERT INTO voice_usage_monthly (business_id, usage_month, seconds_used, calls_count)
  VALUES (p_business_id, v_month, p_seconds, 0)
  ON CONFLICT (business_id, usage_month)
  DO UPDATE SET seconds_used = voice_usage_monthly.seconds_used + EXCLUDED.seconds_used
  RETURNING seconds_used INTO v_used;

  IF p_call_id IS NOT NULL THEN
    UPDATE voice_calls SET billable_seconds = billable_seconds + p_seconds WHERE id = p_call_id;
  END IF;

  SELECT p.plan_type INTO v_plan
    FROM businesses b JOIN profiles p ON p.user_id = b.owner_id WHERE b.id = p_business_id;
  SELECT * INTO v_lim FROM voice_plan_limits(COALESCE(v_plan, 'free'));

  RETURN jsonb_build_object(
    'seconds_used', v_used,
    'seconds_limit', v_lim.monthly_seconds,
    'remaining_seconds', GREATEST(v_lim.monthly_seconds - v_used, 0),
    -- The media server uses these to wind the conversation down gracefully
    -- rather than cutting the caller off mid-sentence.
    'soft_warning', (v_lim.monthly_seconds - v_used) <= 60,
    'hard_cutoff',  (v_lim.monthly_seconds - v_used) <= 0);
END $$;

-- ---------------------------------------------------------------------------
-- Call lifecycle. The media server's entire write surface.
-- ---------------------------------------------------------------------------

-- Creates (or reuses) the conversation and the call row. Returns both ids.
CREATE OR REPLACE FUNCTION public.voice_call_start(
  p_business_id UUID,
  p_direction TEXT,
  p_from_e164 TEXT,
  p_to_e164 TEXT,
  p_call_sid TEXT,
  p_stream_sid TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_peer    TEXT := CASE WHEN p_direction = 'inbound' THEN p_from_e164 ELSE p_to_e164 END;
  v_ext     TEXT;
  v_session UUID;
  v_call    UUID;
BEGIN
  v_ext := 'voice:' || COALESCE(v_peer, 'unknown');

  -- Idempotent on the carrier's call id: Twilio retries webhooks.
  SELECT id, session_id INTO v_call, v_session FROM voice_calls WHERE twilio_call_sid = p_call_sid;
  IF FOUND THEN
    RETURN jsonb_build_object('call_id', v_call, 'session_id', v_session, 'reused', true);
  END IF;

  SELECT id INTO v_session FROM chat_sessions
   WHERE business_id = p_business_id AND external_user_id = v_ext AND status = 'active'
   ORDER BY created_at DESC LIMIT 1;

  IF v_session IS NULL THEN
    INSERT INTO chat_sessions (business_id, external_user_id, source, status)
    VALUES (p_business_id, v_ext,
            CASE WHEN p_direction = 'outbound' THEN 'voice_outbound' ELSE 'voice' END,
            'active')
    RETURNING id INTO v_session;
  END IF;

  INSERT INTO voice_calls (business_id, session_id, direction, twilio_call_sid, twilio_stream_sid,
                           from_e164, to_e164, status, answered_at)
  VALUES (p_business_id, v_session, p_direction, p_call_sid, p_stream_sid,
          p_from_e164, p_to_e164, 'in_progress', NOW())
  RETURNING id INTO v_call;

  INSERT INTO voice_usage_daily (business_id, usage_date, seconds_used, calls_count)
  VALUES (p_business_id, CURRENT_DATE, 0, 1)
  ON CONFLICT (business_id, usage_date) DO UPDATE SET calls_count = voice_usage_daily.calls_count + 1;

  INSERT INTO chat_messages (session_id, content, sender_type, metadata)
  VALUES (v_session,
          CASE WHEN p_direction = 'inbound' THEN 'Inbound call started.' ELSE 'Outbound call started.' END,
          'system', jsonb_build_object('kind','call_started','call_id',v_call,'peer',v_peer));

  RETURN jsonb_build_object('call_id', v_call, 'session_id', v_session, 'reused', false);
END $$;

-- One finalized conversational turn. Only text the caller actually heard.
CREATE OR REPLACE FUNCTION public.voice_append_turn(
  p_session_id UUID,
  p_sender TEXT,       -- 'customer' | 'ai' | 'system'
  p_content TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF p_sender NOT IN ('customer','ai','system') THEN
    RAISE EXCEPTION 'voice_append_turn: bad sender %', p_sender;
  END IF;
  IF p_content IS NULL OR btrim(p_content) = '' THEN RETURN NULL; END IF;

  INSERT INTO chat_messages (session_id, content, sender_type, metadata)
  VALUES (p_session_id, p_content, p_sender, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.voice_call_end(
  p_call_id UUID,
  p_status TEXT DEFAULT 'completed',
  p_disposition TEXT DEFAULT 'ai_handled',
  p_duration_seconds INT DEFAULT NULL,
  p_hangup_cause TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session UUID; v_dur INT;
BEGIN
  UPDATE voice_calls
     SET status = p_status,
         disposition = COALESCE(p_disposition, disposition),
         ended_at = NOW(),
         duration_seconds = COALESCE(p_duration_seconds,
                                     GREATEST(EXTRACT(EPOCH FROM (NOW() - started_at))::int, 0)),
         hangup_cause = COALESCE(p_hangup_cause, hangup_cause)
   WHERE id = p_call_id
   RETURNING session_id, duration_seconds INTO v_session, v_dur;

  IF v_session IS NOT NULL THEN
    INSERT INTO chat_messages (session_id, content, sender_type, metadata)
    VALUES (v_session,
            format('Call ended (%s min %s sec).', v_dur / 60, v_dur % 60),
            'system',
            jsonb_build_object('kind','call_ended','call_id',p_call_id,'disposition',p_disposition));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Outbound queue claim. SKIP LOCKED so overlapping ticks cannot double-dial.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_voice_jobs(p_limit INT, p_worker TEXT)
RETURNS SETOF public.voice_outbound_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Reaper: a worker that died mid-dial must not strand its jobs.
  UPDATE voice_outbound_jobs
     SET status = 'pending', locked_at = NULL, locked_by = NULL
   WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes';

  RETURN QUERY
  UPDATE voice_outbound_jobs
     SET status = 'processing', locked_at = NOW(), locked_by = p_worker, attempts = attempts + 1
   WHERE id IN (
     SELECT id FROM voice_outbound_jobs
      WHERE status = 'pending'
        AND next_attempt_at <= NOW()
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.complete_voice_job(
  p_job_id UUID,
  p_ok BOOLEAN,
  p_call_id UUID DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_skip BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_attempts INT; v_max INT;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max FROM voice_outbound_jobs WHERE id = p_job_id;

  IF p_skip THEN
    UPDATE voice_outbound_jobs SET status='skipped', last_error=p_error, locked_at=NULL, locked_by=NULL
     WHERE id = p_job_id;
  ELSIF p_ok THEN
    UPDATE voice_outbound_jobs SET status='done', call_id=p_call_id, last_error=NULL,
           locked_at=NULL, locked_by=NULL
     WHERE id = p_job_id;
  ELSIF v_attempts >= v_max THEN
    UPDATE voice_outbound_jobs SET status='failed', last_error=p_error, locked_at=NULL, locked_by=NULL
     WHERE id = p_job_id;
  ELSE
    -- 5m, 15m, 45m. Deliberately coarse so retries do not cross a call-window edge.
    UPDATE voice_outbound_jobs
       SET status='pending', last_error=p_error, locked_at=NULL, locked_by=NULL,
           next_attempt_at = NOW() + (INTERVAL '5 minutes' * POWER(3, v_attempts))
     WHERE id = p_job_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- GDPR erasure: drop a caller's audio and scrub their transcripts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voice_erase_caller(p_business_id UUID, p_e164 TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_calls INT; v_sessions INT;
BEGIN
  UPDATE voice_calls SET recording_path = NULL, metadata = metadata || '{"erased":true}'::jsonb
   WHERE business_id = p_business_id AND (from_e164 = p_e164 OR to_e164 = p_e164);
  GET DIAGNOSTICS v_calls = ROW_COUNT;

  UPDATE chat_sessions SET status = 'resolved'
   WHERE business_id = p_business_id AND external_user_id = 'voice:' || p_e164;
  GET DIAGNOSTICS v_sessions = ROW_COUNT;

  UPDATE voice_voicemails SET recording_path = '', transcript = '[erased]'
   WHERE business_id = p_business_id AND from_e164 = p_e164;

  -- Storage objects are removed by the caller using the returned paths.
  RETURN jsonb_build_object('calls_scrubbed', v_calls, 'sessions_closed', v_sessions);
END $$;

-- ---------------------------------------------------------------------------
-- Grants: service role only. None of this is reachable from the browser.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_voice_allowance(UUID, INT)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_voice_usage(UUID, UUID, INT)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_call_start(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_append_turn(UUID, TEXT, TEXT, JSONB)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_call_end(UUID, TEXT, TEXT, INT, TEXT)              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_voice_jobs(INT, TEXT)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_voice_job(UUID, BOOLEAN, UUID, TEXT, BOOLEAN)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_erase_caller(UUID, TEXT)                           FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_voice_allowance(UUID, INT)                       TO service_role;
GRANT EXECUTE ON FUNCTION public.record_voice_usage(UUID, UUID, INT)                    TO service_role;
GRANT EXECUTE ON FUNCTION public.voice_call_start(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)   TO service_role;
GRANT EXECUTE ON FUNCTION public.voice_append_turn(UUID, TEXT, TEXT, JSONB)             TO service_role;
GRANT EXECUTE ON FUNCTION public.voice_call_end(UUID, TEXT, TEXT, INT, TEXT)            TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_voice_jobs(INT, TEXT)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_voice_job(UUID, BOOLEAN, UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.voice_erase_caller(UUID, TEXT)                          TO service_role;

-- is_business_open is safe to read from the dashboard so the UI can show status.
GRANT EXECUTE ON FUNCTION public.is_business_open(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.voice_plan_limits(TEXT) TO service_role, authenticated;
