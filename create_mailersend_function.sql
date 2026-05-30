-- 1. Enable the HTTP extension if not already enabled
create extension if not exists "http" with schema extensions;

-- 2. Create the function
create or replace function send_email_message(message jsonb)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public, private
as $$
declare
  retval jsonb;
  api_token text;
begin
  -- Fetch the API token from private.keys table
  select value into api_token
  from private.keys
  where key = 'MAILERSEND_API_TOKEN';

  if api_token is null then
    raise exception 'MAILERSEND_API_TOKEN not found in private.keys';
  end if;

  -- Make the HTTP POST request to MailerSend
  select content::jsonb into retval
  from http((
    'POST',
    'https://api.mailersend.com/v1/email',
    ARRAY[
      http_header('Authorization', 'Bearer ' || api_token),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    jsonb_build_object(
      'from', jsonb_build_object('email', message->>'sender'),
      'to', jsonb_build_array(jsonb_build_object('email', message->>'recipient')),
      'subject', message->>'subject',
      'html', message->>'html_body',
      'headers', jsonb_build_object('List-Unsubscribe', '<mailto:unsubscribe@octadezx.com>')
    )::text
  ));

  return retval;
end;
$$;
