-- ============================================================================
-- Migration: Security hardening PHASE 2 — apply ONLY AFTER the 2026-06-10
-- frontend build is live on Vercel.
-- ----------------------------------------------------------------------------
-- The new frontend authenticates widget requests with the visitor's anonymous
-- JWT (instead of the bare anon key) and bootstraps via get_public_business.
-- These drops break the OLD frontend, so deploy first:  npx vercel --prod
-- ============================================================================

-- 1) CRITICAL — "Public can read own session" had qual `true`: anyone with the
--    anon key could read EVERY chat session of EVERY business (customer names
--    and emails). Guests now authenticate, so the scoped policy
--    "Guests can view own sessions" (auth.uid() = user_id) takes over.
DROP POLICY IF EXISTS "Public can read own session" ON public.chat_sessions;

-- 2) HIGH — blanket insert allowed creating sessions for any business with an
--    arbitrary user_id. "Guests can create sessions" (auth.uid() = user_id)
--    covers the widget; api-v1/platform-webhook use the service role.
DROP POLICY IF EXISTS "Anyone can create chat sessions" ON public.chat_sessions;

-- 3) HIGH — blanket message insert let anyone spoof messages (incl. fake "ai"
--    replies) into ANY session whose id they obtained. Guests keep writing to
--    their own sessions; owners get an explicit reply policy (the old owner
--    insert policy was dropped in the 2026-05-30 leak fix and never replaced).
DROP POLICY IF EXISTS "Insert messages into existing sessions" ON public.chat_messages;

DROP POLICY IF EXISTS "Owners can reply in their business chats" ON public.chat_messages;
CREATE POLICY "Owners can reply in their business chats"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_sessions s
      JOIN public.businesses b ON b.id = s.business_id
      WHERE s.id = chat_messages.session_id
        AND b.owner_id = auth.uid()
    )
  );

-- 4) MEDIUM — "Enable read access for all users" exposed every business's
--    policies and ai_instructions (prompt) to anyone. The widget now uses the
--    get_public_business RPC, which returns only public fields.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.businesses;
