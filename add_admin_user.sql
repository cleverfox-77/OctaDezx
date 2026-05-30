-- Replace 'YOUR_USER_ID_HERE' with your actual Supabase User ID.
-- You can find this in the Supabase Dashboard -> Authentication -> Users.

insert into platform_admins (user_id)
values ('YOUR_USER_ID_HERE')
on conflict (user_id) do nothing;

-- Verify it worked
select * from platform_admins;
