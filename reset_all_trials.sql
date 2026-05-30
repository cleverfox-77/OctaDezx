-- Reset ALL non-subscribed users to a fresh 24-hour trial
-- This ensures that anyone who hasn't paid gets a new 24-hour window starting NOW.

UPDATE public.profiles
SET 
  subscription_status = 'trial',
  trial_start_timestamp = now()
WHERE subscription_status IS NULL OR subscription_status != 'active';
