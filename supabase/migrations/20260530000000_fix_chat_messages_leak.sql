-- ============================================================================
-- Migration: Fix CRITICAL chat_messages data leak
-- Date: 2026-05-30
-- ----------------------------------------------------------------------------
-- A prior migration (20250913120000_secure_chat_policies.sql) added a blanket
-- policy `USING (auth.role() = 'anon')` to chat_messages. Because the anon key
-- is public, that let ANY anonymous caller read EVERY message of EVERY business
-- (customer names, phone numbers, delivery addresses, order details).
--
-- Fix: remove all blanket anon read policies and serve a single conversation's
-- history through a SECURITY DEFINER RPC scoped to one session UUID — the same
-- capability-by-UUID pattern already used by get_public_business(). Reading the
-- whole table as `anon` now returns zero rows.
-- ============================================================================

-- 1) Remove every historically-known blanket/anon policy on chat_messages.
DROP POLICY IF EXISTS "Anonymous users can view messages"        ON public.chat_messages;
DROP POLICY IF EXISTS "Anonymous users can create messages"      ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can view messages in active sessions" ON public.chat_messages;
DROP POLICY IF EXISTS "Anyone can create chat messages"          ON public.chat_messages;
DROP POLICY IF EXISTS "Owners can view their chat messages"      ON public.chat_messages;
DROP POLICY IF EXISTS "Owners can create messages in their chats" ON public.chat_messages;

-- 2) Business owners keep full read access to their own conversations.
DROP POLICY IF EXISTS "Business owners can view their chat messages" ON public.chat_messages;
CREATE POLICY "Business owners can view their chat messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_sessions s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = chat_messages.session_id
      AND b.owner_id = auth.uid()
  )
);

-- 3) Inserts are allowed ONLY into a session that actually exists. This keeps
--    the customer widget working (it writes customer + assistant turns) while
--    blocking inserts into arbitrary / non-existent session ids. No blanket
--    SELECT is granted here, so writers still cannot read other conversations.
DROP POLICY IF EXISTS "Insert messages into existing sessions" ON public.chat_messages;
CREATE POLICY "Insert messages into existing sessions"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id
  )
);

-- 4) Capability-scoped read: returns ONLY the messages of the one session whose
--    (unguessable) UUID the caller already holds. Mirrors get_public_business().
CREATE OR REPLACE FUNCTION public.get_session_messages(p_session_id uuid)
RETURNS TABLE (
  id          uuid,
  session_id  uuid,
  sender_type text,
  content     text,
  image_url   text,
  created_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.session_id, m.sender_type, m.content, m.image_url, m.created_at
  FROM public.chat_messages m
  WHERE m.session_id = p_session_id
  ORDER BY m.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.get_session_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_messages(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- AFTER APPLYING: in the Supabase dashboard (Auth > Policies > chat_messages)
-- confirm the ONLY SELECT policy left is "Business owners can view their chat
-- messages". If any other anon/blanket SELECT policy was added by hand, drop it.
-- ----------------------------------------------------------------------------
