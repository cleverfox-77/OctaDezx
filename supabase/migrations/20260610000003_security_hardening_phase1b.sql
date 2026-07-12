-- ============================================================================
-- Migration: Security hardening PHASE 1b — RPC execute grants
-- Date: 2026-06-10 (applied to prod same day, after phase 1)
-- ----------------------------------------------------------------------------
-- Tightens grants flagged by the Supabase security advisor. The admin_* RPCs
-- verify platform_admins membership internally, but anon has no business
-- calling them at all; trigger functions should never be RPC-callable.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.admin_chat_origin_summary(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_discount_code(text, text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_discount_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_code_users(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_platform_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_session_messages(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_businesses(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_chat_sessions(text, uuid, text, boolean, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_discount_codes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_discount_code(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_plan(uuid, text) FROM PUBLIC, anon;

-- Trigger functions: never callable via /rest/v1/rpc by any client role.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_dlai_user() FROM PUBLIC, anon, authenticated;

-- Invoice numbering is service-role-only (generate-invoice edge function).
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon;
