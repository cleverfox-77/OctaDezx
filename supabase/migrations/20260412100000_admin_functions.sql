-- ============================================================================
-- Migration: Admin Dashboard RPC Functions
-- Date: 2026-04-12
-- Description: Creates SECURITY DEFINER functions for admin dashboard.
--              All functions verify caller is in platform_admins table.
-- ============================================================================

-- ============================================================================
-- 1. admin_get_platform_stats()
-- Returns aggregated KPI data for the admin overview tab.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
  v_total_users INT;
  v_active_subs INT;
  v_mrr NUMERIC;
  v_total_businesses INT;
  v_plan_distribution JSONB;
  v_signups_30d JSONB;
  v_daily_usage_today INT;
BEGIN
  -- Auth check
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;

  -- Active subscriptions (active + past_due)
  SELECT COUNT(*) INTO v_active_subs
  FROM public.profiles
  WHERE subscription_status IN ('active', 'past_due');

  -- MRR calculation
  SELECT COALESCE(SUM(
    CASE plan_type
      WHEN 'starter' THEN 9
      WHEN 'pro' THEN 29
      WHEN 'enterprise' THEN 99
      ELSE 0
    END
  ), 0) INTO v_mrr
  FROM public.profiles
  WHERE subscription_status IN ('active', 'past_due')
    AND plan_type IN ('starter', 'pro', 'enterprise');

  -- Total businesses
  SELECT COUNT(*) INTO v_total_businesses FROM public.businesses;

  -- Plan distribution
  SELECT COALESCE(jsonb_object_agg(pt, cnt), '{}'::jsonb)
  INTO v_plan_distribution
  FROM (
    SELECT COALESCE(plan_type, 'free') AS pt, COUNT(*) AS cnt
    FROM public.profiles
    GROUP BY COALESCE(plan_type, 'free')
  ) sub;

  -- New signups last 30 days (grouped by date)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('date', signup_date, 'count', cnt)
    ORDER BY signup_date
  ), '[]'::jsonb)
  INTO v_signups_30d
  FROM (
    SELECT created_at::date AS signup_date, COUNT(*) AS cnt
    FROM public.profiles
    WHERE created_at >= (CURRENT_DATE - INTERVAL '30 days')
    GROUP BY created_at::date
  ) sub;

  -- Daily unique customers across all businesses today
  SELECT COUNT(*) INTO v_daily_usage_today
  FROM public.daily_customer_usage
  WHERE usage_date = CURRENT_DATE;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'active_subscriptions', v_active_subs,
    'mrr', v_mrr,
    'total_businesses', v_total_businesses,
    'plan_distribution', v_plan_distribution,
    'signups_last_30d', v_signups_30d,
    'daily_usage_today', v_daily_usage_today
  );
END;
$$;


-- ============================================================================
-- 2. admin_list_users(search_text, limit, offset)
-- Returns paginated user list with subscription and business info.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
  v_users JSONB;
  v_total INT;
BEGIN
  -- Auth check
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Count total matching
  SELECT COUNT(*) INTO v_total
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p_search = ''
    OR p.contact_email ILIKE '%' || p_search || '%'
    OR p.business_name ILIKE '%' || p_search || '%'
    OR u.email ILIKE '%' || p_search || '%';

  -- Get paginated results
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'email', COALESCE(u.email, p.contact_email),
      'business_name', p.business_name,
      'plan_type', COALESCE(p.plan_type, 'free'),
      'subscription_status', COALESCE(p.subscription_status, 'none'),
      'lemon_squeezy_customer_id', p.lemon_squeezy_customer_id,
      'created_at', p.created_at,
      'business_count', (
        SELECT COUNT(*) FROM public.businesses b WHERE b.owner_id = p.user_id
      )
    ) AS row_data
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p_search = ''
      OR p.contact_email ILIKE '%' || p_search || '%'
      OR p.business_name ILIKE '%' || p_search || '%'
      OR u.email ILIKE '%' || p_search || '%'
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'users', v_users,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;


-- ============================================================================
-- 3. admin_list_businesses(search_text, limit, offset)
-- Returns paginated business list with stats.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_businesses(
  p_search TEXT DEFAULT '',
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
  v_businesses JSONB;
  v_total INT;
BEGIN
  -- Auth check
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Count total matching
  SELECT COUNT(*) INTO v_total
  FROM public.businesses b
  LEFT JOIN public.profiles p ON p.user_id = b.owner_id
  LEFT JOIN auth.users u ON u.id = b.owner_id
  WHERE p_search = ''
    OR b.name ILIKE '%' || p_search || '%'
    OR COALESCE(u.email, p.contact_email, '') ILIKE '%' || p_search || '%';

  -- Get paginated results
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_businesses
  FROM (
    SELECT jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'owner_email', COALESCE(u.email, p.contact_email),
      'owner_plan', COALESCE(p.plan_type, 'free'),
      'is_active', b.is_active,
      'created_at', b.created_at,
      'products_count', (
        SELECT COUNT(*) FROM public.products pr WHERE pr.business_id = b.id
      ),
      'sessions_count', (
        SELECT COUNT(*) FROM public.chat_sessions cs WHERE cs.business_id = b.id
      ),
      'orders_count', (
        SELECT COUNT(*) FROM public.orders o WHERE o.business_id = b.id
      ),
      'daily_usage_today', (
        SELECT COUNT(*) FROM public.daily_customer_usage dcu
        WHERE dcu.business_id = b.id AND dcu.usage_date = CURRENT_DATE
      )
    ) AS row_data
    FROM public.businesses b
    LEFT JOIN public.profiles p ON p.user_id = b.owner_id
    LEFT JOIN auth.users u ON u.id = b.owner_id
    WHERE p_search = ''
      OR b.name ILIKE '%' || p_search || '%'
      OR COALESCE(u.email, p.contact_email, '') ILIKE '%' || p_search || '%'
    ORDER BY b.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'businesses', v_businesses,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;


-- ============================================================================
-- 4. admin_update_user_plan(target_user_id, new_plan_type)
-- Allows admin to manually override a user's plan.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_plan(
  p_user_id UUID,
  p_plan_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
BEGIN
  -- Auth check
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Validate plan type
  IF p_plan_type NOT IN ('free', 'trial', 'starter', 'pro', 'enterprise', 'appsumo_ltd') THEN
    RETURN jsonb_build_object('error', 'Invalid plan type');
  END IF;

  -- Update
  UPDATE public.profiles
  SET plan_type = p_plan_type,
      subscription_status = CASE
        WHEN p_plan_type IN ('starter', 'pro', 'enterprise', 'appsumo_ltd') THEN 'active'
        WHEN p_plan_type = 'trial' THEN 'trial'
        ELSE 'expired'
      END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'plan_type', p_plan_type);
END;
$$;
