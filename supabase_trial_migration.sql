-- Run this script in the Supabase SQL Editor

-- 1. Add new columns to the profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS trial_start_timestamp timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial', -- Values: 'trial', 'active', 'expired', 'cancelled'
ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id text,
ADD COLUMN IF NOT EXISTS lemon_squeezy_subscription_id text;

-- 2. Ensure existing users have the trial defaults applied
UPDATE public.profiles 
SET 
  subscription_status = 'trial',
  trial_start_timestamp = now()
WHERE subscription_status IS NULL OR trial_start_timestamp IS NULL;
