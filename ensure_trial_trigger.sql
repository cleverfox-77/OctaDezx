-- 1. Create or Replace the handle_new_user function
-- This function runs automatically whenever a new user signs up via Supabase Auth.
-- It ensures a profile is created with the correct 'trial' status and timestamp.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, subscription_status, trial_start_timestamp)
  VALUES (
    new.id,
    'trial',
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    subscription_status = COALESCE(profiles.subscription_status, 'trial'),
    trial_start_timestamp = COALESCE(profiles.trial_start_timestamp, now());
  
  RETURN new;
END;
$$;

-- 2. Ensure the trigger is attached to the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
