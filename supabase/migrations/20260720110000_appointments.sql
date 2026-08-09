-- ============================================================================
-- Migration: Appointments / slot booking
-- Date: 2026-07-20
-- Description:
--   Per-business booking settings + an appointments table. The AI books via
--   ai-chat-response (service role), owners manage from the dashboard (RLS),
--   and Claude can manage via MCP (service role).
-- ============================================================================

-- 1. Booking settings (one row per business)
CREATE TABLE IF NOT EXISTS public.appointment_settings (
  business_id  UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL DEFAULT false,
  timezone     TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  slot_minutes INT NOT NULL DEFAULT 30,
  working_hours TEXT NOT NULL DEFAULT 'Mon to Sat, 10:00 to 18:00',
  services     TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their appointment settings" ON public.appointment_settings;
CREATE POLICY "Owners manage their appointment settings"
  ON public.appointment_settings FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

-- 2. Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id       UUID,
  customer_name    TEXT,
  customer_contact TEXT,
  service          TEXT,
  starts_at        TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 30,
  status           TEXT NOT NULL DEFAULT 'requested',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_biz_time ON public.appointments (business_id, starts_at);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their appointments" ON public.appointments;
CREATE POLICY "Owners manage their appointments"
  ON public.appointments FOR ALL
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'appointments_status_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_status_check
      CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed'));
  END IF;
END $$;
