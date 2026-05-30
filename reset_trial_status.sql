-- Reset the specific user to 'trial' status to test the banner
UPDATE public.profiles 
SET subscription_status = 'trial' 
WHERE user_id = 'f8c2d31e-6a3a-4f13-864e-4fcfd37d859e';
