-- ============================================================================
-- Migration: Plan restructure — Advanced tier + new Enterprise tier
-- Date: 2026-07-20
-- Description:
--   The former $99/mo "Enterprise" tier is renamed to "Advanced" and capped
--   at 5,000 unique customers/day (Fair Use: 100,000 messages/month).
--   A new $199/mo "Enterprise" tier handles up to 20,000 unique customers/day
--   (Fair Use: 250,000 messages/month).
--   Yearly billing (2 months free) maps to the same plan keys — Lemon Squeezy
--   yearly variants resolve to the same plan_type in the webhook.
-- ============================================================================

-- ============================================================================
-- 1. ALLOW 'advanced' IN THE plan_type CHECK CONSTRAINT
-- ============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_type_check
  CHECK (plan_type IN ('free', 'trial', 'starter', 'pro', 'advanced', 'enterprise', 'appsumo_ltd'));

-- ============================================================================
-- 2. MIGRATE EXISTING $99 SUBSCRIBERS TO THE RENAMED "Advanced" TIER
-- They keep the price they pay; the new Enterprise is a separate $199 product.
-- ============================================================================
UPDATE public.profiles SET plan_type = 'advanced' WHERE plan_type = 'enterprise';
UPDATE public.profiles SET subscription_plan = 'advanced' WHERE subscription_plan = 'enterprise';

-- ============================================================================
-- 3. REPLACE check_daily_limit RPC (display — DailyUsage component)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_daily_limit(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    WHEN 'advanced'    THEN v_daily_limit := 5000;
    WHEN 'enterprise'  THEN v_daily_limit := 20000;
    ELSE v_daily_limit := 0;
  END CASE;

  -- 4. Count unique sessions today
  SELECT COUNT(*) INTO v_daily_count
  FROM public.daily_customer_usage
  WHERE business_id = p_business_id
    AND usage_date = CURRENT_DATE;

  -- 5. Monthly usage (Advanced + Enterprise fair use)
  v_monthly_count := 0;
  v_monthly_limit := 0;
  IF v_plan IN ('advanced', 'enterprise') THEN
    v_monthly_limit := CASE v_plan WHEN 'advanced' THEN 100000 ELSE 250000 END;
    SELECT COALESCE(message_count, 0) INTO v_monthly_count
    FROM public.monthly_message_usage
    WHERE business_id = p_business_id
      AND usage_month = date_trunc('month', CURRENT_DATE)::date;
    v_monthly_count := COALESCE(v_monthly_count, 0);
  END IF;

  -- 6. Lock check
  v_is_locked := v_daily_count >= v_daily_limit
    OR (v_monthly_limit > 0 AND v_monthly_count >= v_monthly_limit)
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
-- 4. REPLACE check_and_record_usage RPC (enforcement — ai-chat-response)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_record_usage(
  p_business_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    WHEN 'advanced'    THEN v_daily_limit := 5000;
    WHEN 'enterprise'  THEN v_daily_limit := 20000;
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

  -- 7. Advanced + Enterprise monthly message check (Fair Use)
  IF v_plan IN ('advanced', 'enterprise') THEN
    v_monthly_limit := CASE v_plan WHEN 'advanced' THEN 100000 ELSE 250000 END;

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
