-- ============================================================================
-- Migration: Multi-Tiered Subscription System
-- Date: 2026-04-12
-- Description: Adds plan_type column, daily/monthly usage tracking tables,
--              and rate-limiting RPC functions for 4-tier subscription system.
-- ============================================================================

-- ============================================================================
-- 1. ADD plan_type COLUMN TO profiles
-- ============================================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free';

-- Add check constraint (safe: won't fail if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'profiles_plan_type_check'
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_plan_type_check
    CHECK (plan_type IN ('free', 'trial', 'starter', 'pro', 'enterprise', 'appsumo_ltd'));
  END IF;
END $$;

-- Backfill plan_type from existing subscription_plan data
UPDATE public.profiles
SET plan_type = subscription_plan
WHERE subscription_plan IN ('starter', 'pro')
  AND (plan_type IS NULL OR plan_type = 'free');

UPDATE public.profiles
SET plan_type = 'trial'
WHERE subscription_status = 'trial'
  AND (plan_type IS NULL OR plan_type = 'free');


-- ============================================================================
-- 2. CREATE daily_customer_usage TABLE
-- Tracks unique customers (by session_id) per business per day.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_customer_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, session_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_biz_date
  ON public.daily_customer_usage (business_id, usage_date);

ALTER TABLE public.daily_customer_usage ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role key)
CREATE POLICY "Service role full access on daily_customer_usage"
  ON public.daily_customer_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 3. CREATE monthly_message_usage TABLE
-- Tracks total messages per business per month (for enterprise fair use).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.monthly_message_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  usage_month DATE NOT NULL, -- First day of the month, e.g., '2026-04-01'
  message_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, usage_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_biz_month
  ON public.monthly_message_usage (business_id, usage_month);

ALTER TABLE public.monthly_message_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on monthly_message_usage"
  ON public.monthly_message_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 4. REPLACE check_daily_limit RPC
-- Called by the frontend DailyUsage component for display purposes.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_daily_limit(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_plan TEXT;
  v_status TEXT;
  v_daily_count INT;
  v_daily_limit INT;
  v_monthly_count INT;
  v_monthly_limit INT;
  v_is_locked BOOLEAN;
BEGIN
  -- 1. Get business owner
  SELECT owner_id INTO v_owner_id
  FROM public.businesses WHERE id = p_business_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Business not found');
  END IF;

  -- 2. Get owner's plan and status
  SELECT COALESCE(plan_type, 'free'), COALESCE(subscription_status, 'expired')
  INTO v_plan, v_status
  FROM public.profiles WHERE user_id = v_owner_id;

  -- 3. Set daily limit based on plan
  CASE v_plan
    WHEN 'appsumo_ltd' THEN v_daily_limit := 50;
    WHEN 'trial'       THEN v_daily_limit := 50;
    WHEN 'starter'     THEN v_daily_limit := 300;
    WHEN 'pro'         THEN v_daily_limit := 1000;
    WHEN 'enterprise'  THEN v_daily_limit := 100000;
    ELSE v_daily_limit := 0;
  END CASE;

  -- 4. Count unique sessions today
  SELECT COUNT(*) INTO v_daily_count
  FROM public.daily_customer_usage
  WHERE business_id = p_business_id
    AND usage_date = CURRENT_DATE;

  -- 5. Monthly usage (enterprise only)
  v_monthly_count := 0;
  v_monthly_limit := 0;
  IF v_plan = 'enterprise' THEN
    v_monthly_limit := 100000;
    SELECT COALESCE(message_count, 0) INTO v_monthly_count
    FROM public.monthly_message_usage
    WHERE business_id = p_business_id
      AND usage_month = date_trunc('month', CURRENT_DATE)::date;
  END IF;

  -- 6. Lock check
  v_is_locked := v_daily_count >= v_daily_limit
    OR (v_plan = 'enterprise' AND v_monthly_count >= v_monthly_limit)
    OR v_status NOT IN ('active', 'trial', 'past_due');

  RETURN jsonb_build_object(
    'usage', v_daily_count,
    'limit', v_daily_limit,
    'plan', v_plan,
    'status', v_status,
    'is_locked', v_is_locked,
    'monthly_usage', v_monthly_count,
    'monthly_limit', v_monthly_limit
  );
END;
$$;


-- ============================================================================
-- 5. CREATE check_and_record_usage RPC
-- Called by the ai-chat-response edge function before every Gemini API call.
-- Single atomic operation: lookup → record → check limits.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_record_usage(
  p_business_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id UUID;
  v_plan TEXT;
  v_status TEXT;
  v_daily_count INT;
  v_daily_limit INT;
  v_monthly_count INT;
  v_monthly_limit INT;
BEGIN
  -- 1. Get business owner + subscription info in one query
  SELECT b.owner_id, COALESCE(p.plan_type, 'free'), COALESCE(p.subscription_status, 'expired')
  INTO v_owner_id, v_plan, v_status
  FROM public.businesses b
  JOIN public.profiles p ON p.user_id = b.owner_id
  WHERE b.id = p_business_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Business not found');
  END IF;

  -- 2. Check subscription is active
  IF v_status NOT IN ('active', 'trial', 'past_due') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Subscription inactive',
      'status', v_status,
      'plan', v_plan
    );
  END IF;

  -- 3. Set daily limit based on plan
  CASE v_plan
    WHEN 'appsumo_ltd' THEN v_daily_limit := 50;
    WHEN 'trial'       THEN v_daily_limit := 50;
    WHEN 'starter'     THEN v_daily_limit := 300;
    WHEN 'pro'         THEN v_daily_limit := 1000;
    WHEN 'enterprise'  THEN v_daily_limit := 100000;
    ELSE RETURN jsonb_build_object('allowed', false, 'reason', 'No active plan', 'plan', v_plan);
  END CASE;

  -- 4. Record this session for today (idempotent: ON CONFLICT = already counted)
  INSERT INTO public.daily_customer_usage (business_id, session_id, usage_date)
  VALUES (p_business_id, p_session_id, CURRENT_DATE)
  ON CONFLICT (business_id, session_id, usage_date) DO NOTHING;

  -- 5. Count unique sessions today
  SELECT COUNT(*) INTO v_daily_count
  FROM public.daily_customer_usage
  WHERE business_id = p_business_id
    AND usage_date = CURRENT_DATE;

  -- 6. Check daily limit
  IF v_daily_count > v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Daily customer limit reached',
      'usage', v_daily_count,
      'limit', v_daily_limit,
      'plan', v_plan
    );
  END IF;

  -- 7. Enterprise monthly message check
  IF v_plan = 'enterprise' THEN
    v_monthly_limit := 100000;

    -- Upsert: increment message counter for this month
    INSERT INTO public.monthly_message_usage (business_id, usage_month, message_count)
    VALUES (p_business_id, date_trunc('month', CURRENT_DATE)::date, 1)
    ON CONFLICT (business_id, usage_month)
    DO UPDATE SET message_count = monthly_message_usage.message_count + 1,
                  updated_at = NOW();

    SELECT message_count INTO v_monthly_count
    FROM public.monthly_message_usage
    WHERE business_id = p_business_id
      AND usage_month = date_trunc('month', CURRENT_DATE)::date;

    IF v_monthly_count > v_monthly_limit THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Monthly message limit reached (Fair Use Policy)',
        'monthly_usage', v_monthly_count,
        'monthly_limit', v_monthly_limit,
        'plan', v_plan
      );
    END IF;
  END IF;

  -- 8. All checks passed
  RETURN jsonb_build_object(
    'allowed', true,
    'plan', v_plan,
    'usage', v_daily_count,
    'limit', v_daily_limit
  );
END;
$$;
