
-- Function to check daily customer usage for a specific business
-- Used by frontend DailyUsage component for display
CREATE OR REPLACE FUNCTION public.check_daily_limit(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID;
    v_plan TEXT;
    v_status TEXT;
    v_usage INT;
    v_limit INT;
    v_monthly_count INT;
    v_monthly_limit INT;
    v_is_locked BOOLEAN;
BEGIN
    -- 1. Get Business Owner ID
    SELECT owner_id INTO v_owner_id
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Business not found');
    END IF;

    -- 2. Get Subscription Plan
    SELECT COALESCE(plan_type, 'free'), COALESCE(subscription_status, 'expired')
    INTO v_plan, v_status
    FROM public.profiles
    WHERE user_id = v_owner_id;

    -- 3. Set Limit based on Plan
    CASE v_plan
        WHEN 'appsumo_ltd' THEN v_limit := 50;
        WHEN 'trial'       THEN v_limit := 50;
        WHEN 'starter'     THEN v_limit := 300;
        WHEN 'pro'         THEN v_limit := 1000;
        WHEN 'enterprise'  THEN v_limit := 100000;
        ELSE v_limit := 0;
    END CASE;

    -- 4. Count Unique Customers Today (from daily_customer_usage table)
    SELECT COUNT(*)
    INTO v_usage
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

    -- 6. Determine Lock Status
    v_is_locked := v_usage >= v_limit
        OR (v_plan = 'enterprise' AND v_monthly_count >= v_monthly_limit)
        OR v_status NOT IN ('active', 'trial', 'past_due');

    -- 7. Return Result
    RETURN jsonb_build_object(
        'usage', v_usage,
        'limit', v_limit,
        'plan', v_plan,
        'status', v_status,
        'is_locked', v_is_locked,
        'monthly_usage', v_monthly_count,
        'monthly_limit', v_monthly_limit
    );
END;
$$;
