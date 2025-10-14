ALTER TABLE public.profiles
ADD COLUMN subscription_plan TEXT DEFAULT 'free',
ADD COLUMN subscription_status TEXT DEFAULT 'active';
