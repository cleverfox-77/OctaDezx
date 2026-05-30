-- ============================================================================
-- Migration: Lock down orders so they cannot be forged
-- Date: 2026-05-30
-- ----------------------------------------------------------------------------
-- The original orders table shipped with:
--     CREATE POLICY "Authenticated users can create orders"
--       ON public.orders FOR INSERT WITH CHECK (true);
-- Combined with client-side inserts that trusted an AI-generated total, ANY
-- caller could create an order for ANY business at ANY price.
--
-- After this migration only the `create-order` edge function (service role) can
-- insert orders, and it recomputes every total from the product catalogue.
-- Customers can still READ their own orders (scoped by their chat session) so
-- invoice/tracking features keep working.
-- ============================================================================

-- 1) Remove the forge-anything insert policy.
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;

-- 2) Customers may read ONLY orders that belong to one of their own sessions.
--    (chat_sessions.user_id is the anonymous customer's auth.uid().)
DROP POLICY IF EXISTS "Customers can view their own session orders" ON public.orders;
CREATE POLICY "Customers can view their own session orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = orders.session_id
        AND s.user_id = auth.uid()
    )
  );

-- 3) Re-assert owner + service-role policies idempotently (no behaviour change).
DROP POLICY IF EXISTS "Business owners can view their orders" ON public.orders;
CREATE POLICY "Business owners can view their orders"
  ON public.orders FOR SELECT
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can update their orders" ON public.orders;
CREATE POLICY "Business owners can update their orders"
  ON public.orders FOR UPDATE
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access to orders" ON public.orders;
CREATE POLICY "Service role full access to orders"
  ON public.orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- NOTE: there is intentionally NO INSERT policy for anon/authenticated. Order
-- creation must go through the create-order edge function (service role).
