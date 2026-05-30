-- ============================================================================
-- Migration: Discount Codes / Referral System + Fix Signup Trigger
-- Date: 2026-04-15
-- Description:
--   1. Bulletproof handle_new_user() trigger (never fails signup)
--   2. Adds referral_code column to profiles
--   3. Creates discount_codes table for influencer tracking
--   4. Admin RPC functions for discount management
-- ============================================================================

-- ============================================================================
-- 1. ADD referral_code COLUMN TO profiles
-- ============================================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;


-- ============================================================================
-- 2. CREATE discount_codes TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT, -- Influencer name, e.g., "John Doe YouTube"
  percentage INT NOT NULL DEFAULT 10 CHECK (percentage >= 0 AND percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON public.discount_codes (is_active);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Only service role and admins should access this table directly
-- (All access will go through RPC functions that verify admin status)
DROP POLICY IF EXISTS "Service role full access on discount_codes" ON public.discount_codes;
CREATE POLICY "Service role full access on discount_codes"
  ON public.discount_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 3. BULLETPROOF handle_new_user() TRIGGER
-- Never fails signup. Captures referral_code from raw_user_meta_data.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      user_id,
      business_name,
      contact_email,
      subscription_status,
      plan_type,
      referral_code
    )
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data ->> 'business_name',
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        NULL
      ),
      NEW.email,
      'trial',
      'trial',
      NEW.raw_user_meta_data ->> 'referral_code'
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but DO NOT fail the auth.users insert.
      -- The useSubscription hook will create the profile on first frontend visit.
      RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 4. ADMIN RPC: admin_list_discount_codes()
-- Returns all codes with user counts and MRR contribution per code.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_discount_codes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
  v_result JSONB;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', dc.id,
      'code', dc.code,
      'name', dc.name,
      'percentage', dc.percentage,
      'is_active', dc.is_active,
      'notes', dc.notes,
      'created_at', dc.created_at,
      'total_signups', (
        SELECT COUNT(*) FROM public.profiles p
        WHERE p.referral_code = dc.code
      ),
      'paid_signups', (
        SELECT COUNT(*) FROM public.profiles p
        WHERE p.referral_code = dc.code
          AND p.plan_type IN ('starter', 'pro', 'enterprise', 'appsumo_ltd')
          AND p.subscription_status IN ('active', 'past_due')
      ),
      'mrr_contribution', (
        SELECT COALESCE(SUM(
          CASE p.plan_type
            WHEN 'starter' THEN 9
            WHEN 'pro' THEN 29
            WHEN 'enterprise' THEN 99
            ELSE 0
          END
        ), 0)
        FROM public.profiles p
        WHERE p.referral_code = dc.code
          AND p.subscription_status IN ('active', 'past_due')
      )
    ) AS row_data
    FROM public.discount_codes dc
  ) sub;

  RETURN jsonb_build_object('codes', v_result);
END;
$$;


-- ============================================================================
-- 5. ADMIN RPC: admin_create_discount_code(code, name, notes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_discount_code(
  p_code TEXT,
  p_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_percentage INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
  v_new_id UUID;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Normalize code: uppercase, no spaces
  p_code := UPPER(TRIM(p_code));

  IF p_code = '' OR p_code IS NULL THEN
    RETURN jsonb_build_object('error', 'Code cannot be empty');
  END IF;

  -- Insert (unique constraint on code will catch duplicates)
  BEGIN
    INSERT INTO public.discount_codes (code, name, notes, percentage, created_by)
    VALUES (p_code, p_name, p_notes, p_percentage, v_caller)
    RETURNING id INTO v_new_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('error', 'Code already exists');
  END;

  RETURN jsonb_build_object('success', true, 'id', v_new_id, 'code', p_code);
END;
$$;


-- ============================================================================
-- 6. ADMIN RPC: admin_toggle_discount_code(id, is_active)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_toggle_discount_code(
  p_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.discount_codes
  SET is_active = p_is_active
  WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ============================================================================
-- 7. ADMIN RPC: admin_get_code_users(code)
-- Returns all users who signed up with a specific code.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_code_users(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
  v_users JSONB;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  p_code := UPPER(TRIM(p_code));

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_users
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.user_id,
      'email', COALESCE(u.email, p.contact_email),
      'plan_type', COALESCE(p.plan_type, 'free'),
      'subscription_status', COALESCE(p.subscription_status, 'none'),
      'created_at', p.created_at,
      'mrr', CASE p.plan_type
        WHEN 'starter' THEN 9
        WHEN 'pro' THEN 29
        WHEN 'enterprise' THEN 99
        ELSE 0
      END
    ) AS row_data
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.referral_code = p_code
  ) sub;

  RETURN jsonb_build_object('users', v_users);
END;
$$;


-- ============================================================================
-- 8. ADMIN RPC: admin_delete_discount_code(id)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_discount_code(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller UUID;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = v_caller) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  DELETE FROM public.discount_codes WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
