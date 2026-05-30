-- ==========================================
-- SETUP RATE LIMITING & CORS PROTECTION
-- ==========================================

-- 1. UTILITY: Function to get the real IP address
-- This tries to get the IP from various headers Supabase/Cloudflare might use.
create or replace function get_request_ip() returns text as $$
declare
  headers json;
begin
  -- 'request.headers' is a config variable set by PostgREST
  headers := current_setting('request.headers', true)::json;
  
  if headers is null then
    return 'unknown';
  end if;

  -- Prioritize CF-Connecting-IP (Cloudflare), then X-Forwarded-For
  return coalesce(
    headers->>'cf-connecting-ip',
    headers->>'x-forwarded-for',
    'unknown'
  );
end;
$$ language plpgsql security definer;

-- 2. SCHEMA: Add ip_address column to chat_messages if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'chat_messages' and column_name = 'ip_address') then
    alter table chat_messages add column ip_address text;
  end if;
end $$;

-- 3. TRIGGER FUNCTION: Enforce Rate Limit & CORS
create or replace function check_chat_rate_limit() returns trigger as $$
declare
  client_ip text;
  headers json;
  origin text;
  -- EDIT AUTHORIZED DOMAINS HERE:
  allowed_domains text[] := array[
    'http://localhost:8080', 
    'http://localhost:5173', 
    'https://app.octadezx.com', 
    'https://octadezx.com'
  ];
  is_allowed boolean := false;
  d text;
  msg_count int;
begin
  -- Only limit CUSTOMER messages. AI/Admin can send freely.
  if NEW.sender_type <> 'customer' then
    return NEW;
  end if;

  -- ==========================================================
  -- A. CORS / ORIGIN VALIDATION
  -- ==========================================================
  headers := current_setting('request.headers', true)::json;
  origin := headers->>'origin';

  -- If Origin header is present, we VALIDATE it.
  -- (If absent, it might be a direct API call or server-side adjustment.
  --  You can choose to block null origins if you want strict browser-only access).
  if origin is not null then
    foreach d in array allowed_domains loop
      -- Check for exact match or subdomain match if needed.
      -- Here we check if the origin STARTS with the allowed domain.
      if position(d in origin) = 1 then
        is_allowed := true;
      end if;
    end loop;
    
    -- Also allow localhost with any port (for development flexibility)
    if origin like 'http://localhost:%' then
      is_allowed := true;
    end if;

    if not is_allowed then
      raise exception 'Access Denied: Request from unauthorized origin (%)', origin;
    end if;
  end if;

  -- ==========================================================
  -- B. RATE LIMITING (10 messages / minute / IP)
  -- ==========================================================
  client_ip := get_request_ip();
  
  -- 1. Store the IP in the record (for logging/debugging)
  NEW.ip_address := client_ip;

  -- 2. Count recent messages from this IP
  select count(*) into msg_count
  from chat_messages
  where ip_address = client_ip
  and sender_type = 'customer'
  and created_at > (now() - interval '1 minute');

  if msg_count >= 10 then
    raise exception 'Rate Limit Exceeded: You are sending messages too fast. Please wait a moment.';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- 4. APPLY TRIGGER
drop trigger if exists check_rate_limit_trigger on chat_messages;

create trigger check_rate_limit_trigger
before insert on chat_messages
for each row execute function check_chat_rate_limit();

comment on trigger check_rate_limit_trigger on chat_messages is 'Enforces 10 msg/min rate limit per IP and checks Origin header';

-- Verify structure
select column_name, data_type from information_schema.columns where table_name = 'chat_messages';
