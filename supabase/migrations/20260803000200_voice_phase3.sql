-- ============================================================================
-- Migration: Voice phases 3 to 6 (voicemail, outbound queue, retention, cron)
-- Date: 2026-08-03
--
-- Everything here is called by edge functions holding the service role key.
-- Same rule as 20260803000100: the write logic lives in SECURITY DEFINER
-- functions, not in the caller, so a leaked key cannot rewrite history.
--
-- Requires: 20260803000000_voice_foundation.sql, 20260803000100_voice_functions.sql
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Voicemail
--
-- A voicemail can arrive with NO prior voice_calls row: after-hours and
-- over-limit callers go straight to <Record> without ever reaching the media
-- server. voice_call_start is idempotent on the carrier call id, so calling it
-- here either creates the missing row or returns the existing one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voice_voicemail_record(
  p_business_id UUID,
  p_call_sid    TEXT,
  p_from_e164   TEXT,
  p_to_e164     TEXT,
  p_recording_path TEXT,
  p_duration    INT DEFAULT NULL,
  p_reason      TEXT DEFAULT 'after_hours',
  p_transcript  TEXT DEFAULT NULL,
  p_confidence  NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start   JSONB;
  v_call    UUID;
  v_session UUID;
  v_vm      UUID;
  v_mins    TEXT;
BEGIN
  v_start   := voice_call_start(p_business_id, 'inbound', p_from_e164, p_to_e164, p_call_sid, NULL);
  v_call    := (v_start ->> 'call_id')::uuid;
  v_session := (v_start ->> 'session_id')::uuid;

  -- The caller never spoke to the AI, so the call itself is finished.
  UPDATE voice_calls
     SET status = 'completed',
         disposition = 'voicemail',
         ended_at = COALESCE(ended_at, NOW()),
         recording_path = p_recording_path,
         recording_duration_seconds = p_duration,
         duration_seconds = GREATEST(COALESCE(p_duration, 0), duration_seconds)
   WHERE id = v_call;

  -- One voicemail per recording. Re-delivered webhooks must not duplicate it.
  SELECT id INTO v_vm FROM voice_voicemails
   WHERE call_id = v_call AND recording_path = p_recording_path;

  IF v_vm IS NULL THEN
    INSERT INTO voice_voicemails (
      business_id, call_id, session_id, from_e164, recording_path,
      duration_seconds, transcript, transcript_status, transcript_confidence, reason)
    VALUES (
      p_business_id, v_call, v_session, p_from_e164, p_recording_path,
      p_duration, p_transcript,
      CASE WHEN p_transcript IS NULL OR btrim(p_transcript) = '' THEN 'pending' ELSE 'done' END,
      p_confidence, p_reason)
    RETURNING id INTO v_vm;

    v_mins := format('%s:%s', COALESCE(p_duration, 0) / 60, lpad((COALESCE(p_duration, 0) % 60)::text, 2, '0'));

    -- The transcript is a normal customer turn, so it shows up in the existing
    -- chat history, analytics and MCP tools with no special-casing anywhere.
    IF p_transcript IS NOT NULL AND btrim(p_transcript) <> '' THEN
      INSERT INTO chat_messages (session_id, content, sender_type, metadata)
      VALUES (v_session, p_transcript, 'customer',
              jsonb_build_object('kind','voicemail','voicemail_id',v_vm,
                                 'recording_path',p_recording_path,'duration',p_duration));
    END IF;

    INSERT INTO chat_messages (session_id, content, sender_type, metadata)
    VALUES (v_session, format('Voicemail received (%s).', v_mins), 'system',
            jsonb_build_object('kind','voicemail_received','voicemail_id',v_vm,'call_id',v_call));

    -- A voicemail is by definition something the AI could not resolve, so it
    -- lands in the same Escalated queue the owner already watches.
    UPDATE chat_sessions
       SET status = 'escalated',
           escalation_reason = COALESCE(escalation_reason, 'Voicemail: ' || p_reason)
     WHERE id = v_session AND status <> 'escalated';
  END IF;

  RETURN jsonb_build_object('voicemail_id', v_vm, 'call_id', v_call, 'session_id', v_session);
END $$;

-- Late transcription (the audio is stored first, transcribed second, so a slow
-- or failed ASR never costs us the recording).
CREATE OR REPLACE FUNCTION public.voice_voicemail_transcript(
  p_voicemail_id UUID,
  p_transcript   TEXT,
  p_confidence   NUMERIC DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session UUID; v_ok BOOLEAN := p_transcript IS NOT NULL AND btrim(p_transcript) <> '';
BEGIN
  UPDATE voice_voicemails
     SET transcript = CASE WHEN v_ok THEN p_transcript ELSE transcript END,
         transcript_confidence = p_confidence,
         transcript_status = CASE WHEN v_ok THEN 'done' ELSE 'failed' END
   WHERE id = p_voicemail_id AND transcript_status <> 'done'
   RETURNING session_id INTO v_session;

  IF v_ok AND v_session IS NOT NULL THEN
    INSERT INTO chat_messages (session_id, content, sender_type, metadata)
    VALUES (v_session, p_transcript, 'customer',
            jsonb_build_object('kind','voicemail','voicemail_id',p_voicemail_id));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Carrier status and AMD verdicts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voice_call_result(
  p_call_sid    TEXT,
  p_status      TEXT DEFAULT NULL,
  p_answered_by TEXT DEFAULT NULL,
  p_duration    INT  DEFAULT NULL,
  p_hangup_cause TEXT DEFAULT NULL,
  p_disposition TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_biz UUID; v_billed INT; v_prev INT;
BEGIN
  SELECT id, business_id, billable_seconds INTO v_id, v_biz, v_prev
    FROM voice_calls WHERE twilio_call_sid = p_call_sid;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  UPDATE voice_calls
     SET status      = COALESCE(p_status, status),
         answered_by = COALESCE(p_answered_by, answered_by),
         disposition = COALESCE(p_disposition, disposition),
         hangup_cause = COALESCE(p_hangup_cause, hangup_cause),
         duration_seconds = GREATEST(COALESCE(p_duration, 0), duration_seconds),
         ended_at = CASE WHEN p_status IN ('completed','failed','busy','no_answer','canceled')
                         THEN COALESCE(ended_at, NOW()) ELSE ended_at END
   WHERE id = v_id;

  -- The carrier is the billing source of truth. If its duration exceeds what
  -- the media server metered (a dropped socket, a leg we never streamed), book
  -- the difference so an outage cannot be used to get free minutes.
  IF p_duration IS NOT NULL AND p_duration > COALESCE(v_prev, 0) THEN
    v_billed := p_duration - COALESCE(v_prev, 0);
    PERFORM record_voice_usage(v_biz, v_id, v_billed);
  END IF;

  RETURN jsonb_build_object('found', true, 'call_id', v_id, 'business_id', v_biz);
END $$;

-- ---------------------------------------------------------------------------
-- 3. Outbound: enqueue, do-not-call, reminders
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_voice_job(
  p_business_id UUID,
  p_to_e164     TEXT,
  p_purpose     TEXT DEFAULT 'manual',
  p_payload     JSONB DEFAULT '{}'::jsonb,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  p_idempotency_key TEXT DEFAULT NULL,
  p_callee_timezone TEXT DEFAULT NULL,
  p_consent_source TEXT DEFAULT NULL,
  p_created_by  UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_key TEXT; v_enabled BOOLEAN;
BEGIN
  IF p_to_e164 IS NULL OR p_to_e164 !~ '^\+[1-9][0-9]{6,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'to_e164 must be E.164, e.g. +8801700000000');
  END IF;

  SELECT outbound_enabled INTO v_enabled FROM voice_settings WHERE business_id = p_business_id;
  IF COALESCE(v_enabled, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Outbound calling is switched off for this business');
  END IF;

  IF EXISTS (SELECT 1 FROM voice_dnc WHERE business_id = p_business_id AND e164 = p_to_e164) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Number is on the do-not-call list');
  END IF;

  v_key := COALESCE(p_idempotency_key, p_purpose || ':' || p_to_e164 || ':' || to_char(p_scheduled_for, 'YYYYMMDDHH24MI'));

  INSERT INTO voice_outbound_jobs (business_id, to_e164, callee_timezone, purpose, payload,
                                   scheduled_for, idempotency_key, consent_source, created_by)
  VALUES (p_business_id, p_to_e164, p_callee_timezone, p_purpose, COALESCE(p_payload, '{}'::jsonb),
          p_scheduled_for, v_key, p_consent_source, p_created_by)
  ON CONFLICT (business_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'idempotency_key', v_key);
  END IF;
  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'job_id', v_id, 'idempotency_key', v_key);
END $$;

-- Opting out has to take effect immediately, including for calls already queued.
CREATE OR REPLACE FUNCTION public.voice_dnc_add(
  p_business_id UUID, p_e164 TEXT, p_reason TEXT DEFAULT 'caller opted out'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cancelled INT;
BEGIN
  INSERT INTO voice_dnc (business_id, e164, reason) VALUES (p_business_id, p_e164, p_reason)
  ON CONFLICT (business_id, e164) DO UPDATE SET reason = EXCLUDED.reason;

  UPDATE voice_outbound_jobs SET status = 'cancelled', last_error = 'do-not-call'
   WHERE business_id = p_business_id AND to_e164 = p_e164 AND status IN ('pending','processing');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'cancelled_jobs', v_cancelled);
END $$;

/**
 * Appointment reminders, 24 hours out.
 *
 * Only 'confirmed' appointments, and only contacts already stored in E.164.
 * customer_contact is free text that may hold an email or a locally formatted
 * number; guessing a country code for a TCPA-regulated call is not a guess
 * worth making, so anything that is not already +<digits> is skipped.
 */
CREATE OR REPLACE FUNCTION public.voice_enqueue_appointment_reminders()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_made INT := 0; v_seen INT := 0; v_res JSONB;
BEGIN
  FOR r IN
    SELECT a.id, a.business_id, a.customer_name, a.service, a.starts_at,
           regexp_replace(a.customer_contact, '[^0-9+]', '', 'g') AS phone,
           vs.timezone
      FROM appointments a
      JOIN voice_settings vs ON vs.business_id = a.business_id
     WHERE a.status = 'confirmed'
       AND vs.enabled AND vs.outbound_enabled
       AND a.starts_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
       AND a.customer_contact ~ '^\s*\+[0-9][0-9 ()\-\.]{6,}$'
  LOOP
    v_seen := v_seen + 1;
    v_res := enqueue_voice_job(
      p_business_id => r.business_id,
      p_to_e164     => r.phone,
      p_purpose     => 'appointment_reminder',
      p_payload     => jsonb_build_object('appointment_id', r.id, 'customer_name', r.customer_name,
                                          'service', r.service, 'starts_at', r.starts_at),
      -- Fire two hours from now rather than immediately, so a run at 3am does
      -- not queue a call that the window check then has to reject.
      p_scheduled_for => NOW() + INTERVAL '2 hours',
      p_idempotency_key => 'appt:' || r.id || ':24h',
      p_callee_timezone => r.timezone,
      p_consent_source  => 'existing appointment'
    );
    IF (v_res ->> 'ok')::boolean AND NOT COALESCE((v_res ->> 'duplicate')::boolean, false) THEN
      v_made := v_made + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('scanned', v_seen, 'enqueued', v_made);
END $$;

-- ---------------------------------------------------------------------------
-- 4. Audio retention
--
-- Transcripts are kept; only the audio expires. Two steps because the storage
-- object lives outside Postgres: the sweeper reads what is due, deletes the
-- objects, then clears the rows it actually managed to delete.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.voice_retention_due(p_limit INT DEFAULT 200)
RETURNS TABLE (kind TEXT, row_id UUID, business_id UUID, path TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'call'::text, c.id, c.business_id, c.recording_path
    FROM voice_calls c JOIN voice_settings s ON s.business_id = c.business_id
   WHERE c.recording_path IS NOT NULL
     AND c.started_at < NOW() - (s.retention_days || ' days')::interval
  UNION ALL
  SELECT 'voicemail'::text, v.id, v.business_id, v.recording_path
    FROM voice_voicemails v JOIN voice_settings s ON s.business_id = v.business_id
   WHERE v.recording_path IS NOT NULL AND v.recording_path <> ''
     AND v.created_at < NOW() - (s.retention_days || ' days')::interval
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.voice_retention_clear(p_kind TEXT, p_row_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_kind = 'call' THEN
    UPDATE voice_calls SET recording_path = NULL,
           metadata = metadata || '{"audio_expired":true}'::jsonb WHERE id = p_row_id;
  ELSIF p_kind = 'voicemail' THEN
    UPDATE voice_voicemails SET recording_path = '' WHERE id = p_row_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Knowledge base embeddings
--
-- Nothing has ever written knowledge_base_articles.embedding, so the pgvector
-- RPC that business-context.ts calls has been falling back to recency on every
-- request. Rather than patch the four separate write paths (dashboard, file
-- training, scraper, MCP), edits just clear the vector and a sweeper refills
-- it. One place to get right instead of four.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kb_clear_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kb_clear_embedding_trg ON public.knowledge_base_articles;
CREATE TRIGGER kb_clear_embedding_trg
  BEFORE UPDATE ON public.knowledge_base_articles
  FOR EACH ROW EXECUTE FUNCTION public.kb_clear_embedding();

CREATE OR REPLACE FUNCTION public.kb_pending_embeddings(p_limit INT DEFAULT 25)
RETURNS TABLE (id UUID, title TEXT, content TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, title, content FROM knowledge_base_articles
   WHERE embedding IS NULL AND content IS NOT NULL AND btrim(content) <> ''
   ORDER BY updated_at DESC NULLS LAST
   LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.kb_set_embedding(p_id UUID, p_embedding TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Passed as text and cast here so the caller does not need a vector codec.
  -- The trigger only fires on title/content changes, so this does not wipe it.
  UPDATE knowledge_base_articles SET embedding = p_embedding::vector WHERE id = p_id;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Grants: service role only.
-- ---------------------------------------------------------------------------
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'voice_voicemail_record(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, TEXT, NUMERIC)',
    'voice_voicemail_transcript(UUID, TEXT, NUMERIC)',
    'voice_call_result(TEXT, TEXT, TEXT, INT, TEXT, TEXT)',
    'enqueue_voice_job(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID)',
    'voice_dnc_add(UUID, TEXT, TEXT)',
    'voice_enqueue_appointment_reminders()',
    'voice_retention_due(INT)',
    'voice_retention_clear(TEXT, UUID)',
    'kb_pending_embeddings(INT)',
    'kb_set_embedding(UUID, TEXT)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Schedules
--
-- Same shape as the existing 'expire-trials' job (jobid 3), which is the only
-- proof in this database that pg_cron plus pg_net actually works here.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_base TEXT := 'https://dnjhvfmlmvhabrlpcmao.supabase.co/functions/v1';
  v_key  TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping voice schedules';
    RETURN;
  END IF;

  -- Reuse the secret the existing job already carries rather than writing the
  -- value into this file. Verified against jobid 3, which authenticates with
  -- 'Authorization: Bearer <CRON_SECRET>' exactly as enforce-trial-end expects.
  SELECT substring(command from 'Bearer ([A-Za-z0-9_.\-]+)') INTO v_key
    FROM cron.job WHERE jobname = 'expire-trials' LIMIT 1;

  IF v_key IS NULL THEN
    RAISE NOTICE 'Could not read the cron secret from the expire-trials job. Schedule the voice jobs manually once CRON_SECRET is known.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('voice-dispatch','voice-reminders','voice-retention','kb-embed');

  PERFORM cron.schedule('voice-dispatch', '* * * * *', format($c$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb) $c$, v_base || '/voice-jobs/dispatch', v_key));

  PERFORM cron.schedule('voice-reminders', '7 * * * *', format($c$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb) $c$, v_base || '/voice-jobs/reminders', v_key));

  PERFORM cron.schedule('voice-retention', '25 3 * * *', format($c$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb) $c$, v_base || '/voice-jobs/retention', v_key));

  PERFORM cron.schedule('kb-embed', '*/5 * * * *', format($c$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb) $c$, v_base || '/kb-embed', v_key));
END $$;
