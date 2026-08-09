-- Fix: the second call to or from any number was dropped before it started.
--
-- voice_call_start reused whatever chat_session that caller already had open:
--
--   SELECT id INTO v_session FROM chat_sessions
--    WHERE business_id = ... AND external_user_id = v_ext AND status = 'active'
--
-- That is chat behaviour, where one person has one running thread. But
-- voice_calls.session_id carries a UNIQUE constraint, one call to one session,
-- so reusing a session made the insert fail with 23505. The media server saw a
-- null back from the RPC and hung up before recording anything, which is why
-- five outbound jobs completed with no error while voice_calls stayed empty and
-- the call history looked broken.
--
-- It was invisible on the very first call and guaranteed from the second,
-- because nothing ever closed the session: voice_call_end wrote a closing
-- message into the transcript but left status = 'active' forever.
--
-- Both halves are fixed here. A phone call is a discrete conversation with its
-- own transcript, and the UNIQUE constraint already said so, so the session
-- lookup goes and every call gets its own session. The constraint stays: it is
-- what surfaced this at all.

CREATE OR REPLACE FUNCTION public.voice_call_start(
  p_business_id uuid,
  p_direction   text,
  p_from_e164   text,
  p_to_e164     text,
  p_call_sid    text,
  p_stream_sid  text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_peer    TEXT := CASE WHEN p_direction = 'inbound' THEN p_from_e164 ELSE p_to_e164 END;
  v_ext     TEXT;
  v_session UUID;
  v_call    UUID;
BEGIN
  v_ext := 'voice:' || COALESCE(v_peer, 'unknown');

  -- Idempotent on the carrier's call id, because Telnyx retries webhooks and a
  -- retry must not open a second call. Unchanged, and still the first thing
  -- checked.
  SELECT id, session_id INTO v_call, v_session FROM voice_calls WHERE carrier_call_id = p_call_sid;
  IF FOUND THEN
    RETURN jsonb_build_object('call_id', v_call, 'session_id', v_session, 'reused', true);
  END IF;

  -- One session per call, always. Looking for an existing open session here is
  -- what caused the collision, and a caller's previous call is a separate
  -- conversation anyway: merging them would put two calls in one transcript.
  INSERT INTO chat_sessions (business_id, external_user_id, source, status)
  VALUES (p_business_id, v_ext,
          CASE WHEN p_direction = 'outbound' THEN 'voice_outbound' ELSE 'voice' END,
          'active')
  RETURNING id INTO v_session;

  INSERT INTO voice_calls (business_id, session_id, direction, carrier_call_id, carrier_stream_id,
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
END $function$;

-- Close the session when the call ends.
--
-- Without this every finished call left an 'active' session behind, which piled
-- up in the owner's live conversation list and, before the change above, was
-- the thing the next call collided with. Escalated sessions are left alone:
-- those are waiting on a human and closing them would hide the handover.

CREATE OR REPLACE FUNCTION public.voice_call_end(
  p_call_id          uuid,
  p_status           text    DEFAULT 'completed'::text,
  p_disposition      text    DEFAULT 'ai_handled'::text,
  p_duration_seconds integer DEFAULT NULL::integer,
  p_hangup_cause     text    DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

    UPDATE chat_sessions
       SET status = 'resolved'
     WHERE id = v_session
       AND status = 'active';
  END IF;
END $function$;

-- Tidy the sessions left open by the old behaviour.
--
-- Scoped to voice sessions whose call has already ended, so nothing live and no
-- chat conversation is touched. Escalated sessions are excluded for the reason
-- above.
UPDATE public.chat_sessions s
   SET status = 'resolved'
 WHERE s.status = 'active'
   AND s.source IN ('voice', 'voice_outbound')
   AND EXISTS (
     SELECT 1 FROM public.voice_calls c
      WHERE c.session_id = s.id
        AND c.ended_at IS NOT NULL
   );
