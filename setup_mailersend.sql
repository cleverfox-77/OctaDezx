-- 1. Ensure the 'private' schema exists (it usually does in Supabase, but good to be safe)
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Ensure the 'keys' table exists
CREATE TABLE IF NOT EXISTS private.keys (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- 3. Insert or Update the MailerSend API Token
-- Replace 'aaaaaaaaaa' with your actual API token
INSERT INTO private.keys (key, value) 
VALUES ('MAILERSEND_API_TOKEN', 'aaaaaaaaaa')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Verify the key was inserted (optional)
SELECT * FROM private.keys WHERE key = 'MAILERSEND_API_TOKEN';
