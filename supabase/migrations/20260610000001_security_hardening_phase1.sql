-- ============================================================================
-- Migration: Security hardening PHASE 1 (safe with the currently-live frontend)
-- Date: 2026-06-10
-- ----------------------------------------------------------------------------
-- Fixes found in the 2026-06-10 security review that do NOT depend on the new
-- frontend build. Phase 2 (20260610000002) drops the remaining blanket chat
-- policies and must be applied only AFTER the new frontend is live on Vercel.
-- ============================================================================

-- 1) CRITICAL — anyone could forge orders for any business at any price.
--    Order creation has gone through the create-order edge function (service
--    role, server-side prices) since 2026-05-30, so no client needs this.
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;

-- 2) CRITICAL — the discount_codes "service role" policy was written with a
--    literal `true` qual/check for role public: ANY caller could read, create,
--    modify, or delete discount codes with the public anon key.
DROP POLICY IF EXISTS "Service role full access on discount_codes" ON public.discount_codes;
CREATE POLICY "Service role manages discount codes"
  ON public.discount_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3) HIGH — send_email_message (MailerSend) was executable by anon and
--    authenticated: anyone with the public anon key could send arbitrary
--    emails from the business's verified domain (spam/phishing vector).
--    Only edge functions (service role) may send mail now.
REVOKE EXECUTE ON FUNCTION public.send_email_message(jsonb) FROM PUBLIC, anon, authenticated;

-- 4) HIGH — every invoice (customer names, addresses, amounts, PDF links) was
--    readable by anyone because the policy only required the parent order to
--    have a session id. Scope reads to the customer who owns the chat session.
DROP POLICY IF EXISTS "Public can read invoices via order session" ON public.invoices;
DROP POLICY IF EXISTS "Customers can view invoices for their sessions" ON public.invoices;
CREATE POLICY "Customers can view invoices for their sessions"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.chat_sessions s ON s.id = o.session_id
      WHERE o.id = invoices.order_id
        AND s.user_id = auth.uid()
    )
  );

-- 5) MEDIUM — every knowledge-base article of every business was publicly
--    readable (qual `true`). The AI reads the KB server-side; the widget's
--    client-side fetch was unused, so nothing breaks.
DROP POLICY IF EXISTS "Public can view knowledge base" ON public.knowledge_base_articles;

-- 6) LOW — any logged-in user could list the platform admins. A user only
--    needs to check their own membership.
DROP POLICY IF EXISTS "Public read admins" ON public.platform_admins;
DROP POLICY IF EXISTS "Users can check their own admin status" ON public.platform_admins;
CREATE POLICY "Users can check their own admin status"
  ON public.platform_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
