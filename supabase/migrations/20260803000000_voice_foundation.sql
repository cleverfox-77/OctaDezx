-- ============================================================================
-- Migration: Voice foundation (real-time calls, voicemail, outbound)
-- Date: 2026-08-03
--
-- Transcripts deliberately REUSE chat_sessions + chat_messages so calls appear
-- in the same history, analytics, escalation queue and MCP tools as every other
-- channel. chat_sessions.source carries 'voice' / 'voice_outbound' (that column
-- has no CHECK, so no change is needed there) and chat_sessions.external_user_id
-- carries 'voice:+8801700000000' (added 20260802000000).
--
-- These tables hold only what does NOT belong on a chat session: carrier ids,
-- recordings, telephony status, business hours, the outbound queue and the
-- duration meter.
--
-- Requires: 20260802000000_fix_external_chat_identity.sql
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Carrier integration: allow 'twilio' in platform_integrations
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_integrations DROP CONSTRAINT IF EXISTS platform_integrations_platform_check;
ALTER TABLE public.platform_integrations ADD CONSTRAINT platform_integrations_platform_check CHECK (
  platform = ANY (ARRAY[
    'twilio',
    'whatsapp','facebook','instagram','telegram','viber','line','twitter','wechat','discord','slack',
    'shopify','woocommerce','amazon','etsy','ebay','bigcommerce','magento','lazada','shopee','tokopedia',
    'hubspot','salesforce','zoho','zendesk','freshdesk','intercom',
    'stripe','paypal','square',
    'easypost','shippo','aftership','shiprocket','pathao','steadfast','redx','paperfly','ecourier','sundarban',
    'delhivery','bluedart','dtdc','ekart','xpressbees','tcs','leopards','mnp','ninjavan','jtexpress','lalamove',
    'lbc','kerry','poslaju','sfexpress','cainiao','zto','yto','yamato','cjlogistics',
    'dhl','fedex','ups','usps','tnt','gls','postnl','dpd','hermes','royalmail','colissimo','bpost','deutschepost',
    'correos','posteitaliane','canadapost','correios','estafeta','ontrac','dhlecommerce','auspost','startrack',
    'aramex_au','nzpost','aramex','naqel','smsa','dpd_africa','postnet','cdek','russianpost'
  ])
);

-- ---------------------------------------------------------------------------
-- 2. Settings, hours
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_settings (
  business_id   UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  greeting      TEXT NOT NULL DEFAULT 'Hi, you have reached our team. You are speaking with an automated assistant. How can I help?',
  tts_provider  TEXT NOT NULL DEFAULT 'deepgram',
  tts_voice     TEXT NOT NULL DEFAULT 'aura-2-thalia-en',
  language      TEXT NOT NULL DEFAULT 'en',
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  max_call_seconds INT NOT NULL DEFAULT 600,

  record_calls  BOOLEAN NOT NULL DEFAULT false,
  consent_mode  TEXT NOT NULL DEFAULT 'announce' CHECK (consent_mode IN ('off','announce','announce_and_require_ack')),
  recording_announcement TEXT NOT NULL DEFAULT 'This call may be recorded for quality and training.',
  retention_days INT NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 365),

  transfer_enabled BOOLEAN NOT NULL DEFAULT false,
  transfer_e164    TEXT,

  voicemail_enabled     BOOLEAN NOT NULL DEFAULT true,
  voicemail_greeting    TEXT NOT NULL DEFAULT 'Sorry we missed you. Please leave a message after the tone and we will get back to you.',
  voicemail_max_seconds INT NOT NULL DEFAULT 120,
  after_hours_action    TEXT NOT NULL DEFAULT 'voicemail' CHECK (after_hours_action IN ('voicemail','ai','transfer','hangup')),

  outbound_enabled      BOOLEAN NOT NULL DEFAULT false,
  outbound_window_start TIME NOT NULL DEFAULT '09:00',
  outbound_window_end   TIME NOT NULL DEFAULT '20:00',
  amd_enabled           BOOLEAN NOT NULL DEFAULT true,
  amd_message           TEXT NOT NULL DEFAULT 'Hello, this is an automated call from your service provider. Please call us back at your convenience.',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.voice_settings.greeting IS
  'Spoken first. Must disclose that the caller is talking to an automated system (CA B.O.T. Act, EU AI Act Art. 50). The UI allows rewording but not removal of the disclosure.';

CREATE TABLE IF NOT EXISTS public.voice_business_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),   -- 0 = Sunday, matches EXTRACT(DOW)
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  UNIQUE (business_id, day_of_week, opens_at)
);

CREATE TABLE IF NOT EXISTS public.voice_hours_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  on_date     DATE NOT NULL,
  is_closed   BOOLEAN NOT NULL DEFAULT true,
  opens_at    TIME,
  closes_at   TIME,
  label       TEXT,
  UNIQUE (business_id, on_date)
);

-- ---------------------------------------------------------------------------
-- 3. Phone numbers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_phone_numbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  e164          TEXT NOT NULL UNIQUE,
  twilio_sid    TEXT UNIQUE,
  friendly_name TEXT,
  country       TEXT,
  capabilities  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 'byo' = the customer's own Twilio account, which keeps carrier cost off our books.
  provisioned_by TEXT NOT NULL DEFAULT 'platform' CHECK (provisioned_by IN ('platform','byo')),
  inbound_enabled   BOOLEAN NOT NULL DEFAULT true,
  outbound_caller_id BOOLEAN NOT NULL DEFAULT true,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','releasing','released')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voice_numbers_business ON public.voice_phone_numbers (business_id, status);

-- ---------------------------------------------------------------------------
-- 4. Calls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_calls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- 1:1 with the conversation. The transcript lives in chat_messages.
  session_id    UUID UNIQUE REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  twilio_call_sid   TEXT UNIQUE,
  twilio_stream_sid TEXT,
  from_e164     TEXT,
  to_e164       TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','ringing','in_progress','completed','failed','busy','no_answer','canceled')),
  answered_by   TEXT,   -- Twilio AMD verdict: human | machine_start | machine_end_beep | fax | unknown
  disposition   TEXT CHECK (disposition IN ('ai_handled','escalated_to_human','voicemail','abandoned','machine','failed','over_limit')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at   TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  duration_seconds INT NOT NULL DEFAULT 0,
  billable_seconds INT NOT NULL DEFAULT 0,
  -- Storage object key, never a public URL. Playback goes through a signed URL.
  recording_path TEXT,
  recording_duration_seconds INT,
  recording_consent TEXT CHECK (recording_consent IN ('announced','not_required','declined','n/a')),
  hangup_cause  TEXT,
  cost_cents_estimate NUMERIC(10,4),
  error_message TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_voice_calls_business ON public.voice_calls (business_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_active   ON public.voice_calls (business_id) WHERE status = 'in_progress';

-- ---------------------------------------------------------------------------
-- 5. Voicemail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_voicemails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  call_id     UUID REFERENCES public.voice_calls(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  from_e164   TEXT,
  recording_path TEXT NOT NULL,
  duration_seconds INT,
  transcript  TEXT,
  transcript_status TEXT NOT NULL DEFAULT 'pending' CHECK (transcript_status IN ('pending','done','failed')),
  transcript_confidence NUMERIC(4,3),
  reason      TEXT CHECK (reason IN ('after_hours','no_human_available','caller_opted','overflow','ai_unavailable','over_limit')),
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_voicemails_business ON public.voice_voicemails (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voicemails_unread   ON public.voice_voicemails (business_id) WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- 6. Outbound queue and do-not-call
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_outbound_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  to_e164       TEXT NOT NULL,
  -- IANA zone of the CALLED party, resolved at enqueue. TCPA windows are the
  -- callee's local time, not the business's.
  callee_timezone TEXT,
  purpose       TEXT NOT NULL DEFAULT 'manual',
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','done','failed','cancelled','skipped')),
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at     TIMESTAMPTZ,
  locked_by     TEXT,
  -- Makes re-running a generator safe, e.g. 'appt:<uuid>:24h'.
  idempotency_key TEXT NOT NULL,
  call_id       UUID REFERENCES public.voice_calls(id) ON DELETE SET NULL,
  last_error    TEXT,
  consent_source TEXT,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_outbound_claimable
  ON public.voice_outbound_jobs (next_attempt_at)
  WHERE status IN ('pending','processing');

CREATE TABLE IF NOT EXISTS public.voice_dnc (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  e164        TEXT NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, e164)
);

-- ---------------------------------------------------------------------------
-- 7. Duration meter (seconds, not events, unlike daily_customer_usage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.voice_usage_daily (
  business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  usage_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  seconds_used INT NOT NULL DEFAULT 0,
  calls_count  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, usage_date)
);

CREATE TABLE IF NOT EXISTS public.voice_usage_monthly (
  business_id  UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  usage_month  DATE NOT NULL,     -- first day of month
  seconds_used INT NOT NULL DEFAULT 0,
  calls_count  INT NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id, usage_month)
);

-- ---------------------------------------------------------------------------
-- 8. RLS: owners read their own; only the service role writes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.voice_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_business_hours   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_hours_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_phone_numbers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_calls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_voicemails       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_outbound_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_dnc              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_daily      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage_monthly    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'voice_settings','voice_business_hours','voice_hours_exceptions','voice_phone_numbers',
    'voice_calls','voice_voicemails','voice_outbound_jobs','voice_dnc',
    'voice_usage_daily','voice_usage_monthly'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner reads %1$s" ON public.%1$I', t);
    EXECUTE format($f$
      CREATE POLICY "owner reads %1$s" ON public.%1$I FOR SELECT TO authenticated
      USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
    $f$, t);

    EXECUTE format('DROP POLICY IF EXISTS "service writes %1$s" ON public.%1$I', t);
    EXECUTE format($f$
      CREATE POLICY "service writes %1$s" ON public.%1$I FOR ALL TO service_role
      USING (true) WITH CHECK (true)
    $f$, t);
  END LOOP;
END $$;

-- Owners configure their own settings and hours directly from the dashboard.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['voice_settings','voice_business_hours','voice_hours_exceptions','voice_dnc'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner writes %1$s" ON public.%1$I', t);
    EXECUTE format($f$
      CREATE POLICY "owner writes %1$s" ON public.%1$I FOR ALL TO authenticated
      USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
      WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
    $f$, t);
  END LOOP;
END $$;

-- Owners may mark a voicemail read and cancel a queued call.
DROP POLICY IF EXISTS "owner updates voicemails" ON public.voice_voicemails;
CREATE POLICY "owner updates voicemails" ON public.voice_voicemails FOR UPDATE TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "owner manages outbound jobs" ON public.voice_outbound_jobs;
CREATE POLICY "owner manages outbound jobs" ON public.voice_outbound_jobs FOR ALL TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 9. Private audio buckets
--
-- Explicitly NOT modelled on 'chat-files' / 'product-images', which are public
-- and anonymous-writable. Call audio is personal data and in many jurisdictions
-- is two-party-consent regulated.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('call-recordings','call-recordings', false, 52428800, ARRAY['audio/wav','audio/mpeg','audio/ogg','audio/x-wav']),
  ('chat-audio','chat-audio',           false, 10485760, ARRAY['audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/webm','audio/amr'])
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['call-recordings','chat-audio'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "owner reads %s" ON storage.objects', b);
    -- Path is {business_id}/... so the first folder segment is the tenant key.
    EXECUTE format($f$
      CREATE POLICY "owner reads %1$s" ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = %1$L
        AND (storage.foldername(name))[1] IN (
          SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
        )
      )
    $f$, b);

    EXECUTE format('DROP POLICY IF EXISTS "service writes %s" ON storage.objects', b);
    EXECUTE format($f$
      CREATE POLICY "service writes %1$s" ON storage.objects FOR ALL TO service_role
      USING (bucket_id = %1$L) WITH CHECK (bucket_id = %1$L)
    $f$, b);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 10. Live call monitoring in the dashboard
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'voice_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_calls;
  END IF;
END $$;
