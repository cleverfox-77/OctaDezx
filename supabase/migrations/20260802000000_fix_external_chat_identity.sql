-- ============================================================================
-- Migration: fix external-channel chat identity and sender_type
-- Date: 2026-08-02
--
-- WHY:
--   platform-webhook writes a synthetic identity like "whatsapp:8801700000000"
--   into chat_sessions.user_id, but that column is uuid REFERENCES auth.users(id).
--   The insert fails on the type cast, sess comes back null, and handleMessage
--   throws "session error". Every one of the ten messaging platforms has been
--   non-functional. It went unnoticed because no platform_integrations row has
--   ever been created in production, so the path was never exercised.
--
--   The same function then inserts chat_messages.sender_type = 'user', which is
--   not in that table's CHECK ('customer','ai','human'). Neither insert result
--   was ever checked, which is why both failures stayed silent.
--
-- WHAT:
--   1. A dedicated text column for non-authenticated external identities, so
--      user_id keeps meaning "a real auth.users row" and the FK stays intact.
--   2. sender_type gains 'system' for non-speech events (call started, voicemail
--      received, transferred to human), which the voice feature needs and which
--      chat can use too.
--
-- Safe to re-run.
-- ============================================================================

-- 1. External identity ------------------------------------------------------

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS external_user_id TEXT;

COMMENT ON COLUMN public.chat_sessions.external_user_id IS
  'Identity on an external channel, formatted "<channel>:<id>" (e.g. whatsapp:8801700000000, voice:+8801700000000). Used when the customer has no auth.users row. Mutually exclusive with user_id in practice.';

-- handleMessage looks up by exactly this triple, so index it.
CREATE INDEX IF NOT EXISTS idx_chat_sessions_external
  ON public.chat_sessions (business_id, external_user_id, status)
  WHERE external_user_id IS NOT NULL;

-- 2. sender_type: allow 'system' -------------------------------------------

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_sender_type_check
  CHECK (sender_type IN ('customer', 'ai', 'human', 'system'));

COMMENT ON COLUMN public.chat_messages.sender_type IS
  'customer = inbound from the customer; ai = generated reply; human = agent takeover; system = non-speech event note (call started, voicemail received, transferred).';
