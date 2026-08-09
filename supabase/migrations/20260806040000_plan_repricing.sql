-- ============================================================================
-- Migration: August 2026 repricing
-- Date: 2026-08-06
--
-- WHAT CHANGES
--   1. The $9 Starter is withdrawn. The three accounts on it are moved to a key
--      of their own, legacy_starter, so nothing about the new Starter silently
--      changes what they get for the $9 they still pay.
--   2. Every tier shifts down one name: the old $29 Pro becomes Starter, the
--      old $99 Advanced becomes Pro, the old $199 Enterprise becomes Advanced.
--      Prices do not move. Nobody pays more than they did yesterday.
--   3. A new Enterprise tier is metered rather than capped.
--   4. The customer-facing limit stops being "unique customers per day" and
--      becomes "AI messages per month", which is the thing people were actually
--      trying to reason about when they read a monthly bill.
--
-- WHY A SINGLE CASE UPDATE
--   The renames form a chain: pro -> starter while starter -> legacy_starter.
--   Run as separate statements in any order, one rename would feed the next and
--   an account would move two rungs. A single UPDATE ... CASE reads the value
--   each row had BEFORE the statement began, so every row moves exactly once.
--
-- Safe to re-run: the CASE only matches the old key names, which stop existing
-- after the first run, and every other statement is idempotent.
--
-- Requires: 20260720090000_plan_restructure_advanced_enterprise.sql
--           20260803000100_voice_functions.sql
--           20260806010000_teams.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ALLOW THE NEW KEY BEFORE ANY ROW CAN CARRY IT
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_type_check
  CHECK (plan_type IN (
    'free', 'trial', 'starter', 'pro', 'advanced', 'enterprise',
    'legacy_starter', 'appsumo_ltd'
  ));

-- ---------------------------------------------------------------------------
-- 2. MOVE EVERY PAYING ACCOUNT ONE RUNG, IN ONE STATEMENT
-- ---------------------------------------------------------------------------
UPDATE public.profiles
   SET plan_type = CASE plan_type
                     WHEN 'starter'    THEN 'legacy_starter'
                     WHEN 'pro'        THEN 'starter'
                     WHEN 'advanced'   THEN 'pro'
                     WHEN 'enterprise' THEN 'advanced'
                     ELSE plan_type
                   END
 WHERE plan_type IN ('starter', 'pro', 'advanced', 'enterprise');

-- subscription_plan is a second, older column that the Lemon Squeezy webhook
-- also writes. Left behind it would disagree with plan_type on every migrated
-- account, and support would read whichever one they happened to open.
UPDATE public.profiles
   SET subscription_plan = CASE subscription_plan
                             WHEN 'starter'    THEN 'legacy_starter'
                             WHEN 'pro'        THEN 'starter'
                             WHEN 'advanced'   THEN 'pro'
                             WHEN 'enterprise' THEN 'advanced'
                             ELSE subscription_plan
                           END
 WHERE subscription_plan IN ('starter', 'pro', 'advanced', 'enterprise');

-- ---------------------------------------------------------------------------
-- 3. TEAM SEATS
-- Seats follow the names, so the numbers move with the accounts that just
-- moved. legacy_starter keeps the single seat the $9 plan always had.
-- ---------------------------------------------------------------------------
INSERT INTO public.team_plan_limits (plan, max_members) VALUES
  ('free',            1),
  ('trial',           1),
  ('legacy_starter',  1),
  ('starter',         3),
  ('pro',            10),
  ('advanced',       20),
  ('enterprise',    100),
  ('appsumo_ltd',     3)
ON CONFLICT (plan) DO UPDATE
  SET max_members = EXCLUDED.max_members, updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 4. MESSAGE AND VOICE ALLOWANCES, IN ONE PLACE
--
-- Sized so that a customer who burns every message AND every minute still costs
-- us under 40% of what they pay, measured against the YEARLY effective price
-- (two months free makes that the thinnest revenue per month we ever collect).
-- Unit costs at August 2026 list prices: $0.0015 a message, $0.030 a voice
-- minute, $1.50 a month fixed. See src/lib/plans.ts for the full working.
--
--   Starter   2,500 msg + 100 min = $8.25  of $24.17  = 34.1%
--   Pro      10,000 msg + 400 min = $28.50 of $82.50  = 34.5%
--   Advanced 22,000 msg + 900 min = $61.50 of $165.83 = 37.1%
--
-- monthly_messages = -1 means metered with no ceiling, which is Enterprise.
-- 0 means no allowance at all. NULL would have been ambiguous between the two.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.plan_message_limit(p_plan TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE COALESCE(p_plan, '')
           WHEN 'starter'        THEN 2500
           WHEN 'pro'            THEN 10000
           WHEN 'advanced'       THEN 22000
           WHEN 'enterprise'     THEN -1
           WHEN 'legacy_starter' THEN 2000
           WHEN 'trial'          THEN 200
           WHEN 'appsumo_ltd'    THEN 2000
           ELSE 0
         END;
$$;

-- Voice allowance moves onto the new names too. Starter now includes calls:
-- it is the plan the old $29 Pro became, and that plan already had them.
CREATE OR REPLACE FUNCTION public.voice_plan_limits(p_plan TEXT)
RETURNS TABLE (monthly_seconds INT, per_call_seconds INT, max_concurrent INT)
LANGUAGE sql IMMUTABLE AS $$
  -- Columns listed explicitly: SELECT * over the VALUES list would also return
  -- the plan name, giving this branch four columns against the fallback's
  -- three, which is a UNION error rather than a silent one.
  SELECT t.month_secs, t.call_secs, t.concurrent
    FROM (VALUES
      ('starter',     100 * 60,  10 * 60,  3),
      ('pro',         400 * 60,  20 * 60, 10),
      ('advanced',    900 * 60,  20 * 60, 25),
      -- Enterprise is metered. A very large ceiling rather than a special case:
      -- callers compare seconds against this number and an unbounded value
      -- would need every one of them to learn a new rule.
      ('enterprise', 999999 * 60, 30 * 60, 50)
    ) AS t(plan, month_secs, call_secs, concurrent)
   WHERE t.plan = p_plan
  UNION ALL
  -- free, trial, legacy_starter, appsumo_ltd and anything unknown get no voice.
  -- COALESCE matters: a NULL plan against NOT IN yields NULL, which returns no
  -- rows at all instead of a zero allowance, and a caller reading
  -- monthly_seconds off an empty record sees NULL rather than 0.
  SELECT 0, 0, 0
   WHERE COALESCE(p_plan, '') NOT IN ('starter', 'pro', 'advanced', 'enterprise');
$$;

-- ---------------------------------------------------------------------------
-- 5. DISPLAY RPC
--
-- Still called check_daily_limit because the dashboard, the generated types and
-- the MCP server all name it, and renaming an RPC that three clients call is a
-- deploy ordering problem for no gain. What it reports has changed: monthly
-- messages and monthly voice minutes, the two meters that can actually run out.
-- The daily figures stay in the payload so nothing reading them breaks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_daily_limit(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id       UUID;
  v_plan           TEXT;
  v_status         TEXT;
  v_daily_count    INT;
  v_monthly_count  INT;
  v_monthly_limit  INT;
  v_voice_seconds  INT;
  v_voice_limit    INT;
  v_is_locked      BOOLEAN;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.businesses WHERE id = p_business_id;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Business not found');
  END IF;

  SELECT COALESCE(plan_type, 'free'), COALESCE(subscription_status, 'expired')
    INTO v_plan, v_status
    FROM public.profiles WHERE user_id = v_owner_id;

  v_monthly_limit := public.plan_message_limit(v_plan);

  SELECT COALESCE(message_count, 0) INTO v_monthly_count
    FROM public.monthly_message_usage
   WHERE business_id = p_business_id
     AND usage_month = date_trunc('month', CURRENT_DATE)::date;
  v_monthly_count := COALESCE(v_monthly_count, 0);

  SELECT COUNT(*) INTO v_daily_count
    FROM public.daily_customer_usage
   WHERE business_id = p_business_id AND usage_date = CURRENT_DATE;

  SELECT COALESCE(seconds_used, 0) INTO v_voice_seconds
    FROM public.voice_usage_monthly
   WHERE business_id = p_business_id
     AND usage_month = date_trunc('month', CURRENT_DATE)::date;
  v_voice_seconds := COALESCE(v_voice_seconds, 0);

  SELECT monthly_seconds INTO v_voice_limit FROM public.voice_plan_limits(v_plan);

  -- -1 is the metered sentinel, so it can never be "over".
  v_is_locked := (v_monthly_limit >= 0 AND v_monthly_count >= v_monthly_limit)
              OR v_status NOT IN ('active', 'trial', 'past_due');

  RETURN jsonb_build_object(
    'plan',                v_plan,
    'status',              v_status,
    'is_locked',           v_is_locked,
    'monthly_usage',       v_monthly_count,
    'monthly_limit',       GREATEST(v_monthly_limit, 0),
    'metered',             v_monthly_limit < 0,
    'voice_minutes_used',  v_voice_seconds / 60,
    'voice_minutes_limit', COALESCE(v_voice_limit, 0) / 60,
    -- Kept for anything still reading the old shape. The daily figure is now
    -- informational: it does not gate anything.
    'usage',               v_daily_count,
    'limit',               GREATEST(v_monthly_limit, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. ENFORCEMENT RPC
--
-- One call per AI answer, from ai-chat-response. The daily unique-customer gate
-- is gone: it punished a business for a busy Saturday and could not be squared
-- with a monthly invoice. The month of messages is now the only thing that can
-- stop the AI answering.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_record_usage(
  p_business_id UUID,
  p_session_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id      UUID;
  v_plan          TEXT;
  v_status        TEXT;
  v_monthly_count INT;
  v_monthly_limit INT;
BEGIN
  SELECT b.owner_id, COALESCE(p.plan_type, 'free'), COALESCE(p.subscription_status, 'expired')
    INTO v_owner_id, v_plan, v_status
    FROM public.businesses b
    JOIN public.profiles p ON p.user_id = b.owner_id
   WHERE b.id = p_business_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Business not found');
  END IF;

  IF v_status NOT IN ('active', 'trial', 'past_due') THEN
    RETURN jsonb_build_object(
      'allowed', false, 'reason', 'Subscription inactive',
      'status', v_status, 'plan', v_plan
    );
  END IF;

  v_monthly_limit := public.plan_message_limit(v_plan);

  IF v_monthly_limit = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'No active plan', 'plan', v_plan);
  END IF;

  -- Still recorded, because analytics and the business owner both want to know
  -- how many different people wrote in today. It no longer gates anything.
  INSERT INTO public.daily_customer_usage (business_id, session_id, usage_date)
  VALUES (p_business_id, p_session_id, CURRENT_DATE)
  ON CONFLICT (business_id, session_id, usage_date) DO NOTHING;

  -- Count first, then decide. Incrementing before the check would let a
  -- customer who is already over their limit keep inflating the counter with
  -- messages we refuse to answer, so the overage in the invoice would not match
  -- the work we actually did.
  INSERT INTO public.monthly_message_usage (business_id, usage_month, message_count)
  VALUES (p_business_id, date_trunc('month', CURRENT_DATE)::date, 1)
  ON CONFLICT (business_id, usage_month)
  DO UPDATE SET message_count = monthly_message_usage.message_count + 1,
                updated_at = NOW()
  RETURNING message_count INTO v_monthly_count;

  IF v_monthly_limit > 0 AND v_monthly_count > v_monthly_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Monthly message allowance used up',
      'monthly_usage', v_monthly_count,
      'monthly_limit', v_monthly_limit,
      'plan', v_plan
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'plan', v_plan,
    'usage', v_monthly_count,
    'limit', GREATEST(v_monthly_limit, 0),
    'metered', v_monthly_limit < 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_message_limit(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.voice_plan_limits(TEXT)  TO service_role, authenticated;

COMMENT ON FUNCTION public.plan_message_limit(TEXT) IS
  'AI messages included per calendar month. -1 means metered with no ceiling, 0 means no allowance. Mirrors PLANS in src/lib/plans.ts.';
