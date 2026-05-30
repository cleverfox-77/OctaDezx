-- Run this script in the Supabase SQL Editor
-- This will manually create profiles for any users that are missing them.

INSERT INTO public.profiles (user_id, subscription_status, trial_start_timestamp)
SELECT id, 'trial', now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);

-- Output the number of profiles
SELECT count(*) as total_profiles FROM public.profiles;
