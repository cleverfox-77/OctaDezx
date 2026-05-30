-- ============================================================================
-- Migration: Per-IP rate limiting for public edge functions
-- Date: 2026-05-30
-- ----------------------------------------------------------------------------
-- The ai-chat-response function is callable anonymously. Without an IP-level
-- limit, an attacker who knows a businessId can spam requests to burn the
-- victim's daily customer cap (denial of service) and run up Gemini costs.
-- This fixed-window counter lets the edge function throttle per IP.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.edge_rate_limit (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         int         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE public.edge_rate_limit ENABLE ROW LEVEL SECURITY;

-- Only the service role (edge functions) touches this table.
DROP POLICY IF EXISTS "Service role manages edge_rate_limit" ON public.edge_rate_limit;
CREATE POLICY "Service role manages edge_rate_limit"
  ON public.edge_rate_limit FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Atomically increments the counter for (key, current window) and reports
-- whether the caller is still within p_max requests per p_window_seconds.
CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_hits int;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RETURN true; -- can't identify caller; don't hard-block
  END IF;

  v_window := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.edge_rate_limit (bucket_key, window_start, hits)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.edge_rate_limit.hits + 1
  RETURNING hits INTO v_hits;

  -- Opportunistic cleanup of stale windows (keeps the table tiny).
  DELETE FROM public.edge_rate_limit
  WHERE window_start < now() - interval '1 hour';

  RETURN v_hits <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ip_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(text, int, int) TO service_role;
