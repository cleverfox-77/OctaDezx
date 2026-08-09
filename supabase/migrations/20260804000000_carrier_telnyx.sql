-- ===========================================================================
-- Carrier swap: Twilio out, Telnyx in.
--
-- The three voice migrations named Twilio in the schema itself. Telnyx is now
-- the carrier, and a column called twilio_call_sid holding a Telnyx call id is
-- the kind of lie that survives for years, so the columns get carrier-neutral
-- names while every voice table is still empty. Verified empty before writing
-- this: voice_calls, voice_phone_numbers, voice_voicemails, voice_outbound_jobs
-- and voice_settings all had zero rows, so there is no data migration to do and
-- this will never be cheaper than it is now.
--
-- Function PARAMETER names are deliberately left alone. Telnyx TeXML is
-- Twilio-compatible on the wire and posts CallSid exactly as Twilio did, so
-- p_call_sid still describes what it receives. Renaming parameters would also
-- force a DROP FUNCTION (CREATE OR REPLACE cannot rename inputs) and break
-- every supabase-js .rpc() call, which passes arguments by name.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns
--
-- Each rename is guarded so the file can be re-run. A migration that fails
-- halfway and then cannot be started again is a bad half hour, and this one
-- renames three columns before touching two functions.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('voice_calls',         'twilio_call_sid',   'carrier_call_id'),
      ('voice_calls',         'twilio_stream_sid', 'carrier_stream_id'),
      ('voice_phone_numbers', 'twilio_sid',        'carrier_number_id')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.old_name
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.tbl, r.old_name, r.new_name);
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.voice_calls.carrier_call_id IS
  'Carrier call identifier. Telnyx TeXML CallSid, matching what the TeXML webhooks and status callbacks post.';
COMMENT ON COLUMN public.voice_calls.carrier_stream_id IS
  'Media stream identifier from the WebSocket start event (Telnyx stream_id).';
COMMENT ON COLUMN public.voice_phone_numbers.carrier_number_id IS
  'Carrier-side phone number record id (Telnyx phone number id), used to release the number.';

-- ---------------------------------------------------------------------------
-- 2. Functions that referenced the old column names
--
-- plpgsql resolves column names at execution, not at creation, so these two
-- would have kept the old names and failed on the first real call rather than
-- failing here where it is visible. Both bodies are otherwise unchanged.
-- ---------------------------------------------------------------------------
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

  -- Idempotent on the carrier's call id: Telnyx retries webhooks.
  SELECT id, session_id INTO v_call, v_session FROM voice_calls WHERE carrier_call_id = p_call_sid;
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
END $$;

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
    FROM voice_calls WHERE carrier_call_id = p_call_sid;
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
-- 3. Allow 'telnyx' as an integration platform
--
-- Added for the same reason 'twilio' was: a business bringing its own carrier
-- account needs somewhere to store those credentials. 'twilio' stays in the
-- list because nothing is gained by removing a value no row uses, and it keeps
-- the door open if a customer arrives already on Twilio.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.platform_integrations
    DROP CONSTRAINT IF EXISTS platform_integrations_platform_check;

  ALTER TABLE public.platform_integrations
    ADD CONSTRAINT platform_integrations_platform_check CHECK (platform = ANY (ARRAY[
      'telnyx','twilio',
      'whatsapp','facebook','instagram','telegram','viber','line','twitter','wechat','discord','slack',
      'shopify','woocommerce','amazon','etsy','ebay','bigcommerce','magento','lazada','shopee','tokopedia',
      'hubspot','salesforce','zoho','zendesk','freshdesk','intercom',
      'stripe','paypal','square',
      'easypost','shippo','aftership','shiprocket',
      'pathao','steadfast','redx','paperfly','ecourier','sundarban',
      'delhivery','bluedart','dtdc','ekart','xpressbees',
      'tcs','leopards','mnp',
      'ninjavan','jtexpress','lalamove','lbc','kerry','poslaju',
      'sfexpress','cainiao','zto','yto','yamato','cjlogistics',
      'dhl','fedex','ups','usps','tnt','gls','postnl','dpd','hermes','royalmail','colissimo','bpost',
      'deutschepost','correos','posteitaliane','canadapost','correios','estafeta','ontrac','dhlecommerce',
      'auspost','startrack','aramex_au','nzpost',
      'aramex','naqel','smsa',
      'dpd_africa','postnet','cdek','russianpost'
    ]::text[]));
END $$;
