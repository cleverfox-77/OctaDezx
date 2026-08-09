-- Self-improving AI, part 2: capture and scheduling.
--
-- 20260806000000 built the store (signals, lessons, gaps, the human-veto guard)
-- and ai-chat-response learned to SERVE approved lessons. Nothing yet WROTE the
-- single most valuable signal, so the loop had no input and the review queue
-- stayed empty forever.
--
-- The signal in question: a human on the business's team takes over an escalated
-- chat and answers it themselves. The gap between what the AI said and what the
-- human then said is the highest quality training data this product has. It is
-- specific to the business, it is written by someone who actually knows the
-- answer, and it arrives already labelled as "the AI got this wrong".
--
-- Captured by a trigger rather than in application code because human replies
-- are inserted straight from the dashboard by the browser, and are also written
-- by the MCP server's reply_to_customer tool. A trigger catches every route and
-- cannot be forgotten by the next thing that learns to reply.

-- ---------------------------------------------------------------------------
-- 1. Capture a human correction.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ai_capture_human_correction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_enabled     BOOLEAN;
  v_ai_text     TEXT;
  v_ai_at       TIMESTAMPTZ;
  v_cust_text   TEXT;
BEGIN
  SELECT s.business_id INTO v_business_id
    FROM public.chat_sessions s WHERE s.id = NEW.session_id;
  IF v_business_id IS NULL THEN RETURN NEW; END IF;

  -- Respect the owner's switch. Off means do not even collect.
  SELECT l.enabled INTO v_enabled
    FROM public.ai_learning_settings l WHERE l.business_id = v_business_id;
  IF v_enabled IS NOT NULL AND v_enabled = FALSE THEN RETURN NEW; END IF;

  -- The AI's last word before the human stepped in. No AI turn means the human
  -- simply spoke first, which teaches nothing.
  SELECT m.content, m.created_at INTO v_ai_text, v_ai_at
    FROM public.chat_messages m
   WHERE m.session_id = NEW.session_id
     AND m.sender_type = 'ai'
     AND m.created_at <= NEW.created_at
   ORDER BY m.created_at DESC
   LIMIT 1;
  IF v_ai_text IS NULL THEN RETURN NEW; END IF;

  -- What the customer had actually asked.
  SELECT m.content INTO v_cust_text
    FROM public.chat_messages m
   WHERE m.session_id = NEW.session_id
     AND m.sender_type = 'customer'
     AND m.created_at <= v_ai_at
   ORDER BY m.created_at DESC
   LIMIT 1;
  IF v_cust_text IS NULL THEN RETURN NEW; END IF;

  -- A one word "thanks" or "ok" from staff is not a correction.
  IF char_length(btrim(NEW.content)) < 15 THEN RETURN NEW; END IF;

  INSERT INTO public.ai_learning_signals
    (business_id, session_id, kind, polarity, customer_text, ai_text, human_text, dedup_key)
  VALUES
    (v_business_id, NEW.session_id, 'human_correction', 'negative',
     left(v_cust_text, 2000), left(v_ai_text, 2000), left(NEW.content, 2000),
     -- Per message, so replaying this trigger cannot inflate the evidence count.
     'human_correction:' || NEW.id::TEXT)
  ON CONFLICT (business_id, dedup_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A member of staff answering a customer must never fail because the
  -- learning layer had a problem. Swallow, and leave a breadcrumb.
  RAISE WARNING 'ai_capture_human_correction skipped: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ai_capture_human_correction ON public.chat_messages;
CREATE TRIGGER trg_ai_capture_human_correction
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'human')
  EXECUTE FUNCTION public.ai_capture_human_correction();

-- ---------------------------------------------------------------------------
-- 2. The uniqueness the ON CONFLICT above resolves against.
--
--    20260806000000 already created this index on exactly (business_id,
--    dedup_key), verified against the live database, so this is a no-op safety
--    net rather than a new object. It is restated because the trigger above and
--    the upserts in ai-chat-response both name that conflict target, and a
--    missing index turns "do nothing" into a raised exception.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_learning_signals_dedup
  ON public.ai_learning_signals (business_id, dedup_key);

-- ---------------------------------------------------------------------------
-- 3. Owners need to read their own signals for the dashboard's "what it learned
--    from" panel. Writing stays service-role and trigger only: a signal is an
--    observation, not something anyone should be able to author.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners read their learning signals" ON public.ai_learning_signals;
CREATE POLICY "Owners read their learning signals"
  ON public.ai_learning_signals FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Schedule the distillation pass.
--
--    Hourly, not per message: distillation is a Gemini call over a batch, and
--    running it per conversation would cost more than the chat itself.
--    Retirement runs nightly.
--
--    The cron secret is read back out of an existing job rather than written
--    into this file, exactly as the voice schedules do.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_base TEXT := 'https://dnjhvfmlmvhabrlpcmao.supabase.co/functions/v1';
  v_key  TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed, skipping learning schedules';
    RETURN;
  END IF;

  SELECT substring(command from 'Bearer ([A-Za-z0-9_.\-]+)') INTO v_key
    FROM cron.job WHERE jobname = 'expire-trials' LIMIT 1;

  IF v_key IS NULL THEN
    RAISE NOTICE 'Could not read the cron secret. Schedule ai-learn manually once CRON_SECRET is known.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('ai-learn-distill', 'ai-learn-retire');

  PERFORM cron.schedule('ai-learn-distill', '13 * * * *', format($c$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb) $c$, v_base || '/ai-learn/distill', v_key));

  PERFORM cron.schedule('ai-learn-retire', '40 3 * * *', format($c$
    SELECT net.http_post(
      url := %L,
      headers := jsonb_build_object('content-type','application/json','Authorization','Bearer ' || %L),
      body := '{}'::jsonb) $c$, v_base || '/ai-learn/retire', v_key));
END $$;
