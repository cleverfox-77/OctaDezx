-- ============================================================================
-- Migration: Teams (seats, roles, invitations) + the RLS rewrite they require
-- Date: 2026-08-06
-- ----------------------------------------------------------------------------
-- WHAT "1 / 3 / 10 / 20 teams" MEANS HERE
--
-- A "team" is the group of people who work one business's inbox, and the plan
-- number is how many PEOPLE may be in it, the owner included. Starter is 1,
-- which means the owner works alone and cannot invite anyone; Enterprise is 20,
-- a real support department. Read the other way ("N separate team groups") the
-- number buys nothing: groups are a routing concept, this product has no
-- routing, and 20 groups of nobody is not a feature. Seats also track the
-- customer-volume tiers already sold on each plan (300 / 1,000 / 5,000 / 20,000
-- unique customers a day), so the two numbers move together.
--
-- The number lives in ONE place, public.team_plan_limits, one row per plan.
-- Changing what a plan includes is an UPDATE, not a migration.
--
-- ----------------------------------------------------------------------------
-- WHY THIS MIGRATION IS MOSTLY A SECURITY MIGRATION
--
-- Every business-scoped policy in this database was written as "owner_id =
-- auth.uid()", because until now a business had exactly one human. Teams break
-- that assumption everywhere at once. Each rewritten policy below swaps that
-- single test for membership in the business's team, and the replacement is a
-- strict superset of the old rule: the owner still matches through the
-- owner_id branch of my_business_ids(). An existing customer who never invites
-- anyone sees no behaviour change at all.
--
-- Credential-bearing tables (api_keys, oauth_access_tokens) are deliberately
-- NOT widened. See the "left alone on purpose" list at the bottom.
--
-- Run this as ONE transaction (the Supabase CLI and the SQL editor both do).
-- Policies are dropped and recreated; a partial apply would leave gaps.
-- Safe to re-run.
-- ============================================================================


-- ── 1. Per-plan seat allowance ──────────────────────────────────────────────
-- A table rather than a CASE expression or an IMMUTABLE function (the shape
-- voice_plan_limits used) precisely so support can change a customer's
-- allowance without shipping SQL.
CREATE TABLE IF NOT EXISTS public.team_plan_limits (
  plan        TEXT PRIMARY KEY,
  max_members INT  NOT NULL CHECK (max_members >= 1),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- max_members counts the owner. "1" therefore means "no teammates", which is
-- the honest reading of Starter at $9.
INSERT INTO public.team_plan_limits (plan, max_members) VALUES
  ('free',         1),
  ('trial',        1),
  ('starter',      1),
  ('pro',          3),
  ('advanced',    10),
  ('enterprise',  20),
  -- appsumo_ltd is a lifetime deal with no published team size. Pitched at the
  -- Pro tier; change this row if the deal promised something else.
  ('appsumo_ltd',  3)
ON CONFLICT (plan) DO NOTHING;

ALTER TABLE public.team_plan_limits ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user: the dashboard shows "3 of 10 seats used" and
-- the upgrade prompt needs to know what the next plan includes. There is
-- nothing customer-specific in this table.
DROP POLICY IF EXISTS "Anyone signed in can read plan limits" ON public.team_plan_limits;
CREATE POLICY "Anyone signed in can read plan limits"
  ON public.team_plan_limits FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages plan limits" ON public.team_plan_limits;
CREATE POLICY "Service role manages plan limits"
  ON public.team_plan_limits FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- ── 2. Membership ───────────────────────────────────────────────────────────
-- One team per business, so membership is (business, user, role) with no
-- separate teams table. Roles, narrowest first:
--   agent  works the inbox: conversations, orders, appointments, invoices
--   admin  everything an agent can do, plus configuration and inviting people
--   owner  everything, plus billing, roles and removing admins. Exactly one,
--          and it always matches businesses.owner_id.
CREATE TABLE IF NOT EXISTS public.team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, user_id)
);

-- Only one owner row per business, enforced rather than assumed.
CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_owner
  ON public.team_members (business_id) WHERE role = 'owner';

CREATE INDEX IF NOT EXISTS team_members_user_idx     ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS team_members_business_idx ON public.team_members (business_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;


-- ── 3. Invitations ──────────────────────────────────────────────────────────
-- Only the SHA-256 of the token is stored. A database dump, a log line or a
-- leaked backup therefore yields nothing usable, exactly like api_keys.
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'agent')),  -- never 'owner'
  token_hash  TEXT NOT NULL UNIQUE,
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT team_invitations_email_lower CHECK (email = lower(email))
);

-- One live invitation per address per business. Without this, ten invitations
-- to the same person would each hold a seat.
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_live_email
  ON public.team_invitations (business_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS team_invitations_business_idx ON public.team_invitations (business_id);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;


-- ── 4. Membership predicates used by every policy below ─────────────────────
-- SECURITY DEFINER is load-bearing, not decoration. A policy on chat_messages
-- that queried team_members directly would trigger team_members' own policies,
-- which query team_members, which is infinite recursion. Running as the table
-- owner (postgres, and no table here sets FORCE ROW LEVEL SECURITY) reads the
-- membership rows without re-entering RLS.
--
-- The SETOF shape matters too: written as `business_id IN (SELECT
-- my_business_ids())` the planner evaluates the list once per query as an
-- InitPlan instead of calling a function per row. It also keeps the new
-- policies the same shape as the old `business_id IN (SELECT id FROM
-- businesses WHERE owner_id = auth.uid())` ones they replace.
CREATE OR REPLACE FUNCTION public.my_business_ids(p_scope TEXT DEFAULT 'member')
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- The owner_id branch is a safety net as much as a rule: even if the
  -- team_members backfill below were somehow skipped for a business, its owner
  -- can still reach their own data. Nothing in this migration can lock an
  -- owner out.
  SELECT b.id FROM public.businesses b WHERE b.owner_id = auth.uid()
  UNION
  SELECT m.business_id FROM public.team_members m
   WHERE m.user_id = auth.uid()
     AND (p_scope <> 'manage' OR m.role IN ('owner', 'admin'));
$$;

-- Scalar role of the current user in one business: 'owner' | 'admin' | 'agent'
-- | NULL. Used by the RPCs and by the dashboard to decide what to render.
CREATE OR REPLACE FUNCTION public.business_role(p_business_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.businesses b
                  WHERE b.id = p_business_id AND b.owner_id = auth.uid())
      THEN 'owner'
    ELSE (SELECT m.role FROM public.team_members m
           WHERE m.business_id = p_business_id AND m.user_id = auth.uid())
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_business_ids(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.business_role(UUID)   FROM PUBLIC;
-- anon needs EXECUTE even though it can never be a member: the guest-facing
-- policies on chat_sessions and chat_messages sit alongside the owner policies,
-- and Postgres evaluates every permissive policy on the table. Without the
-- grant an anonymous widget read would fail with "permission denied for
-- function" instead of simply matching no owner rows.
GRANT EXECUTE ON FUNCTION public.my_business_ids(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.business_role(UUID)   TO authenticated, anon, service_role;


-- ── 5. Seat accounting and its enforcement ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.team_seat_limit(p_business_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT l.max_members
       FROM public.businesses b
       JOIN public.profiles p        ON p.user_id = b.owner_id
       JOIN public.team_plan_limits l ON l.plan = COALESCE(p.plan_type, 'free')
      WHERE b.id = p_business_id),
    -- Missing profile or a plan name with no row yet: fall back to one seat,
    -- never zero. Zero would refuse the owner's own seat and make the business
    -- unusable, which is a far worse failure than under-selling a seat.
    1);
$$;

-- Pending invitations count against the limit. If they did not, a Starter
-- account could mail out fifty invitations and let all fifty land.
CREATE OR REPLACE FUNCTION public.team_seats_used(p_business_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*) FROM public.team_members m WHERE m.business_id = p_business_id)
  + (SELECT COUNT(*) FROM public.team_invitations i
      WHERE i.business_id = p_business_id
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW());
$$;

REVOKE EXECUTE ON FUNCTION public.team_seat_limit(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_seats_used(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.team_seat_limit(UUID) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.team_seats_used(UUID) TO authenticated, service_role;

-- The limit is enforced here, in the database, on the way in. The dashboard
-- also checks it, but only so the user sees a sensible message: a client-side
-- check is a hint, this is the rule.
CREATE OR REPLACE FUNCTION public.enforce_team_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_limit INT;
  v_used  INT;
BEGIN
  -- The owner's seat is never refused. It is created with the business, every
  -- plan allows at least one, and a plan misconfiguration must not make
  -- creating a business impossible.
  IF TG_TABLE_NAME = 'team_members' AND NEW.role = 'owner' THEN
    RETURN NEW;
  END IF;

  -- Serialise seat changes for this business. Two invitations sent at the same
  -- instant would otherwise both read "2 of 3 used" and both commit, putting
  -- the team one over its plan. The lock is released at transaction end.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.business_id::TEXT, 0));

  v_limit := public.team_seat_limit(NEW.business_id);
  v_used  := public.team_seats_used(NEW.business_id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION
      'Team is full: this plan includes % seat(s) and % are already taken by members and pending invitations.',
      v_limit, v_used
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_seat_limit_on_member ON public.team_members;
CREATE TRIGGER enforce_seat_limit_on_member
  BEFORE INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_seat_limit();

DROP TRIGGER IF EXISTS enforce_seat_limit_on_invitation ON public.team_invitations;
CREATE TRIGGER enforce_seat_limit_on_invitation
  BEFORE INSERT ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_seat_limit();


-- ── 6. The owner is a team member ───────────────────────────────────────────
-- Keeping the owner in team_members means seat counting is one query rather
-- than "members plus one", and the roster renders without a special case.
CREATE OR REPLACE FUNCTION public.add_owner_to_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members (business_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (business_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_owner_to_team_on_business ON public.businesses;
CREATE TRIGGER add_owner_to_team_on_business
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_to_team();

-- Backfill every business that already exists.
INSERT INTO public.team_members (business_id, user_id, role)
SELECT b.id, b.owner_id, 'owner' FROM public.businesses b
ON CONFLICT (business_id, user_id) DO NOTHING;

-- businesses.owner_id becomes writable by admins in section 8. Without this
-- guard an admin could set owner_id to their own id and take the account
-- outright: the UPDATE policy would pass both before and after the change,
-- because they are an admin in both worlds.
CREATE OR REPLACE FUNCTION public.guard_business_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
      RAISE EXCEPTION 'Only the current owner can transfer ownership of a business';
    END IF;
    -- Keep the owner row in step so the roster and seat count stay truthful.
    DELETE FROM public.team_members
     WHERE business_id = NEW.id AND role = 'owner';
    INSERT INTO public.team_members (business_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_owner_change_on_business ON public.businesses;
CREATE TRIGGER guard_owner_change_on_business
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_owner_change();


-- ── 7. RLS on the team tables themselves ────────────────────────────────────
-- SELECT only. Every mutation goes through the RPCs in section 9, so there is
-- exactly one code path that can change a role or add a seat, and it checks the
-- caller every time. An agent cannot UPDATE their own row to 'owner' because no
-- UPDATE policy exists for them to use.
DROP POLICY IF EXISTS "Members can see their teammates" ON public.team_members;
CREATE POLICY "Members can see their teammates"
  ON public.team_members FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "Service role manages team members" ON public.team_members;
CREATE POLICY "Service role manages team members"
  ON public.team_members FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Agents do not see pending invitations: who is being hired is a manager's
-- business, and the row carries an email address.
DROP POLICY IF EXISTS "Managers can see their invitations" ON public.team_invitations;
CREATE POLICY "Managers can see their invitations"
  ON public.team_invitations FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "Service role manages invitations" ON public.team_invitations;
CREATE POLICY "Service role manages invitations"
  ON public.team_invitations FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- 8. THE REWRITE
--
-- Every policy below previously said "you are the owner of this business".
-- Each now says "you are a member of this business's team", and where the data
-- is configuration rather than day-to-day work, "with a manager's role".
--
-- The split:
--   member  (owner + admin + agent)  the actual job: conversations, orders,
--                                    appointments, invoices, shipments, calls,
--                                    and read access to everything they answer
--                                    from
--   manage  (owner + admin)          configuration that changes how the AI
--                                    behaves or what it is connected to
-- ============================================================================

-- ── businesses ──
-- Widening SELECT is what makes a business visible to an invited teammate at
-- all; nothing else in the dashboard works until this one lands.
DROP POLICY IF EXISTS "Business owners can view their businesses" ON public.businesses;
CREATE POLICY "Team members can view their businesses"
  ON public.businesses FOR SELECT
  USING (id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "Business owners can update their businesses" ON public.businesses;
CREATE POLICY "Managers can update their businesses"
  ON public.businesses FOR UPDATE
  USING (id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (id IN (SELECT public.my_business_ids('manage')));
-- INSERT ("Business owners can create businesses", auth.uid() = owner_id) is
-- unchanged: creating a business is an account action, not a team action.
-- There is still no DELETE policy, so no one can delete a business through the
-- API. That was true before this migration and stays true.

-- ── chat_sessions ── the inbox itself
DROP POLICY IF EXISTS "Business owners can view their chat sessions" ON public.chat_sessions;
CREATE POLICY "Team members can view their chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "Business owners can update their chat sessions" ON public.chat_sessions;
CREATE POLICY "Team members can update their chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING (business_id IN (SELECT public.my_business_ids()));

-- ── chat_messages ── reading and replying to customers
DROP POLICY IF EXISTS "Business owners can view their chat messages" ON public.chat_messages;
CREATE POLICY "Team members can view their chat messages"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_sessions s
     WHERE s.id = chat_messages.session_id
       AND s.business_id IN (SELECT public.my_business_ids())));

DROP POLICY IF EXISTS "Owners can reply in their business chats" ON public.chat_messages;
CREATE POLICY "Team members can reply in their business chats"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chat_sessions s
     WHERE s.id = chat_messages.session_id
       AND s.business_id IN (SELECT public.my_business_ids())));

-- ── orders ── two duplicate owner pairs existed; collapse to one pair
DROP POLICY IF EXISTS "Business owners can view their orders"   ON public.orders;
DROP POLICY IF EXISTS "Owners can view their orders"            ON public.orders;
CREATE POLICY "Team members can view their orders"
  ON public.orders FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "Business owners can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Owners can update their orders"          ON public.orders;
CREATE POLICY "Team members can update their orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));
-- Order creation still belongs to the create-order edge function (service
-- role, server-side prices). No client-side INSERT policy is added.

-- ── products / product_images ── the catalogue is configuration
-- Agents keep read access through the pre-existing "Public can view products"
-- and "Public can view product images" policies, so only writes narrow here.
DROP POLICY IF EXISTS "Business owners can manage their products" ON public.products;
CREATE POLICY "Managers can manage their products"
  ON public.products FOR ALL
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "Business owners can manage their product images" ON public.product_images;
CREATE POLICY "Managers can manage their product images"
  ON public.product_images FOR ALL
  USING (product_id IN (
    SELECT p.id FROM public.products p
     WHERE p.business_id IN (SELECT public.my_business_ids('manage'))))
  WITH CHECK (product_id IN (
    SELECT p.id FROM public.products p
     WHERE p.business_id IN (SELECT public.my_business_ids('manage'))));

-- ── knowledge_base_articles ── agents must read what they answer from,
-- managers decide what it says
DROP POLICY IF EXISTS "Business owners can manage their knowledge base articles" ON public.knowledge_base_articles;
CREATE POLICY "Managers can manage their knowledge base articles"
  ON public.knowledge_base_articles FOR ALL
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "Team members can read their knowledge base" ON public.knowledge_base_articles;
CREATE POLICY "Team members can read their knowledge base"
  ON public.knowledge_base_articles FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

-- ── appointments ── booking and rescheduling is the job
DROP POLICY IF EXISTS "Owners manage their appointments" ON public.appointments;
CREATE POLICY "Team members manage their appointments"
  ON public.appointments FOR ALL
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));

-- ── appointment_settings ── which hours and services exist is configuration
DROP POLICY IF EXISTS "Owners manage their appointment settings" ON public.appointment_settings;
CREATE POLICY "Managers manage their appointment settings"
  ON public.appointment_settings FOR ALL
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

-- ── invoices / shipments ── fulfilment work
DROP POLICY IF EXISTS "Business owners can manage their invoices" ON public.invoices;
CREATE POLICY "Team members can manage their invoices"
  ON public.invoices FOR ALL
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "Business owners can manage their shipments" ON public.shipments;
CREATE POLICY "Team members can manage their shipments"
  ON public.shipments FOR ALL
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));

-- ── usage meters ── read-only numbers the whole team should see
DROP POLICY IF EXISTS "Owner can read their business daily usage" ON public.daily_customer_usage;
CREATE POLICY "Team members read their business daily usage"
  ON public.daily_customer_usage FOR SELECT
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "Owner can read their business monthly usage" ON public.monthly_message_usage;
CREATE POLICY "Team members read their business monthly usage"
  ON public.monthly_message_usage FOR SELECT
  USING (business_id IN (SELECT public.my_business_ids()));

-- ── scrape_jobs ── importing a catalogue rewrites the AI's world: managers
DROP POLICY IF EXISTS "Business owners can view their scrape jobs"   ON public.scrape_jobs;
CREATE POLICY "Managers can view their scrape jobs"
  ON public.scrape_jobs FOR SELECT
  USING (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "Business owners can create scrape jobs" ON public.scrape_jobs;
CREATE POLICY "Managers can create scrape jobs"
  ON public.scrape_jobs FOR INSERT
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

-- ── platform_integrations ── the row holds channel credentials, so managers
-- only. An agent answering WhatsApp does not need the WhatsApp token.
DROP POLICY IF EXISTS "owner_select" ON public.platform_integrations;
CREATE POLICY "manager_select" ON public.platform_integrations FOR SELECT
  USING (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "owner_insert" ON public.platform_integrations;
CREATE POLICY "manager_insert" ON public.platform_integrations FOR INSERT
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "owner_update" ON public.platform_integrations;
CREATE POLICY "manager_update" ON public.platform_integrations FOR UPDATE
  USING (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "owner_delete" ON public.platform_integrations;
CREATE POLICY "manager_delete" ON public.platform_integrations FOR DELETE
  USING (business_id IN (SELECT public.my_business_ids('manage')));

-- ── voice: transcripts, voicemail and DNC are the job ──
DROP POLICY IF EXISTS "owner reads voice_calls" ON public.voice_calls;
CREATE POLICY "members read voice_calls" ON public.voice_calls FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner reads voice_voicemails" ON public.voice_voicemails;
CREATE POLICY "members read voice_voicemails" ON public.voice_voicemails FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner updates voicemails" ON public.voice_voicemails;
CREATE POLICY "members update voicemails" ON public.voice_voicemails FOR UPDATE TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner reads voice_dnc" ON public.voice_dnc;
CREATE POLICY "members read voice_dnc" ON public.voice_dnc FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

-- Adding a caller to do-not-call is something an agent does mid-shift, and
-- erring towards "more people can honour an opt-out" is the right direction.
DROP POLICY IF EXISTS "owner writes voice_dnc" ON public.voice_dnc;
CREATE POLICY "members write voice_dnc" ON public.voice_dnc FOR ALL TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()))
  WITH CHECK (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner reads voice_phone_numbers" ON public.voice_phone_numbers;
CREATE POLICY "members read voice_phone_numbers" ON public.voice_phone_numbers FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner reads voice_usage_daily" ON public.voice_usage_daily;
CREATE POLICY "members read voice_usage_daily" ON public.voice_usage_daily FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner reads voice_usage_monthly" ON public.voice_usage_monthly;
CREATE POLICY "members read voice_usage_monthly" ON public.voice_usage_monthly FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

-- ── voice: how the AI answers the phone is configuration ──
DROP POLICY IF EXISTS "owner reads voice_settings" ON public.voice_settings;
CREATE POLICY "members read voice_settings" ON public.voice_settings FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner writes voice_settings" ON public.voice_settings;
CREATE POLICY "managers write voice_settings" ON public.voice_settings FOR ALL TO authenticated
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "owner reads voice_business_hours" ON public.voice_business_hours;
CREATE POLICY "members read voice_business_hours" ON public.voice_business_hours FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner writes voice_business_hours" ON public.voice_business_hours;
CREATE POLICY "managers write voice_business_hours" ON public.voice_business_hours FOR ALL TO authenticated
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

DROP POLICY IF EXISTS "owner reads voice_hours_exceptions" ON public.voice_hours_exceptions;
CREATE POLICY "members read voice_hours_exceptions" ON public.voice_hours_exceptions FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner writes voice_hours_exceptions" ON public.voice_hours_exceptions;
CREATE POLICY "managers write voice_hours_exceptions" ON public.voice_hours_exceptions FOR ALL TO authenticated
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));

-- Outbound campaigns spend money and dial real people: managers only.
DROP POLICY IF EXISTS "owner reads voice_outbound_jobs" ON public.voice_outbound_jobs;
CREATE POLICY "members read voice_outbound_jobs" ON public.voice_outbound_jobs FOR SELECT TO authenticated
  USING (business_id IN (SELECT public.my_business_ids()));

DROP POLICY IF EXISTS "owner manages outbound jobs" ON public.voice_outbound_jobs;
CREATE POLICY "managers manage outbound jobs" ON public.voice_outbound_jobs FOR ALL TO authenticated
  USING (business_id IN (SELECT public.my_business_ids('manage')))
  WITH CHECK (business_id IN (SELECT public.my_business_ids('manage')));


-- ============================================================================
-- LEFT ALONE ON PURPOSE
--
--   api_keys "Owners view their api keys"          an odx_ key is a bearer
--   oauth_access_tokens "Owners view their mcp     credential that bypasses the
--     tokens"                                      dashboard entirely. Handing
--                                                  one to an agent hands them
--                                                  everything, permanently and
--                                                  invisibly. Owner only.
--   profiles (all four policies)                   plan, billing and trial
--                                                  state. Strictly the account
--                                                  holder's own row.
--   chat_sessions / chat_messages "Guests ..."     the customer's side of the
--   orders / invoices / shipments "Customers ..."  conversation. Untouched.
--   every "Service role ..." policy                edge functions. Untouched.
--   chat_sessions "Admins can see everything"      hardcoded platform-admin
--   chat_messages "Admins can see all messages"    email. Pre-existing, out of
--                                                  scope for this change.
--   platform_admins, platform_feedback,            not business-scoped.
--     platform_support_tickets, applications,
--     discount_codes, edge_rate_limit,
--     processed_comments, oauth_clients,
--     oauth_authorization_codes,
--     oauth_refresh_tokens
-- ============================================================================


-- ============================================================================
-- 9. RPCs. Every mutation of a team lives here and nowhere else.
-- ============================================================================

-- Roster with email addresses. auth.users is not readable from the browser and
-- should not be, so the join happens here behind a membership check.
CREATE OR REPLACE FUNCTION public.list_team_members(p_business_id UUID)
RETURNS TABLE (id UUID, user_id UUID, email TEXT, role TEXT, created_at TIMESTAMPTZ, is_me BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.business_role(p_business_id) IS NULL THEN
    RAISE EXCEPTION 'Not a member of this business' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, u.email::TEXT, m.role, m.created_at, (m.user_id = auth.uid())
    FROM public.team_members m
    JOIN auth.users u ON u.id = m.user_id
   WHERE m.business_id = p_business_id
   ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at;
END;
$$;

-- Create an invitation and return the raw token EXACTLY ONCE. Only the hash is
-- stored, so this return value is the only chance to build the link.
CREATE OR REPLACE FUNCTION public.create_team_invitation(
  p_business_id UUID, p_email TEXT, p_role TEXT DEFAULT 'agent')
RETURNS TABLE (invitation_id UUID, token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_role    TEXT := public.business_role(p_business_id);
  v_email   TEXT := lower(trim(p_email));
  v_token   TEXT;
  v_id      UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only an owner or admin can invite people to this team'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_role NOT IN ('admin', 'agent') THEN
    RAISE EXCEPTION 'Role must be admin or agent' USING ERRCODE = 'check_violation';
  END IF;

  -- An admin promoting their way up by inviting a second owner is the obvious
  -- escalation; 'owner' is already excluded by the CHECK, but only the owner
  -- gets to create other admins.
  IF p_role = 'admin' AND v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can invite an admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'That does not look like an email address' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.team_members m
              JOIN auth.users u ON u.id = m.user_id
             WHERE m.business_id = p_business_id AND lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'That person is already on this team' USING ERRCODE = 'unique_violation';
  END IF;

  -- 32 bytes from the CSPRNG, hex encoded. Not derived from the email, the
  -- business or the clock, so knowing every invitation ever sent tells an
  -- attacker nothing about the next one.
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- The seat limit is applied by the BEFORE INSERT trigger, so an invitation
  -- that would overflow the plan never reaches the table.
  INSERT INTO public.team_invitations (business_id, email, role, token_hash, invited_by)
  VALUES (p_business_id, v_email, p_role,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid())
  RETURNING public.team_invitations.id, public.team_invitations.expires_at
       INTO v_id, v_expires;

  RETURN QUERY SELECT v_id, v_token, v_expires;
END;
$$;

-- Accept. Single-use, time-limited, and only by the person it was addressed to.
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token TEXT)
RETURNS TABLE (business_id UUID, business_name TEXT, role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_inv   public.team_invitations%ROWTYPE;
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first, then open the invitation link again'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = auth.uid();

  -- FOR UPDATE plus the accepted_at test below is what makes the token
  -- single-use: two simultaneous accepts serialise here and the second finds
  -- accepted_at already set.
  SELECT * INTO v_inv FROM public.team_invitations
   WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'That invitation link is not valid' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation has already been used' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'That invitation was revoked' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'That invitation has expired. Ask for a new one'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Address binding. A forwarded or leaked link is useless to anyone else,
  -- which is what stops an invitation from being a bearer token for the team.
  IF v_email IS DISTINCT FROM v_inv.email THEN
    RAISE EXCEPTION 'This invitation was sent to %. Sign in with that address to accept it.', v_inv.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The seat trigger runs here too. Seats can have been filled between sending
  -- and accepting (or the plan downgraded), and the plan wins.
  INSERT INTO public.team_members (business_id, user_id, role, invited_by)
  VALUES (v_inv.business_id, auth.uid(), v_inv.role, v_inv.invited_by)
  ON CONFLICT (business_id, user_id) DO NOTHING;

  UPDATE public.team_invitations
     SET accepted_at = NOW(), accepted_by = auth.uid()
   WHERE public.team_invitations.id = v_inv.id;

  RETURN QUERY
  SELECT b.id, b.name, v_inv.role FROM public.businesses b WHERE b.id = v_inv.business_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_team_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business UUID;
  v_role     TEXT;
BEGIN
  SELECT i.business_id INTO v_business FROM public.team_invitations i WHERE i.id = p_invitation_id;
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = 'no_data_found';
  END IF;

  v_role := public.business_role(v_business);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only an owner or admin can revoke an invitation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Revoking frees the seat immediately, which is the whole point of counting
  -- pending invitations against the limit in the first place.
  UPDATE public.team_invitations
     SET revoked_at = NOW()
   WHERE id = p_invitation_id AND accepted_at IS NULL AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member public.team_members%ROWTYPE;
  v_role   TEXT;
BEGIN
  SELECT * INTO v_member FROM public.team_members WHERE id = p_member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Removing the owner would leave a business no one can administer, and
  -- businesses.owner_id would still point at them anyway. Ownership transfer
  -- is a separate, deliberate action.
  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'The owner cannot be removed from their own team'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_role := public.business_role(v_member.business_id);

  -- Anyone may remove themselves. Otherwise: owners remove anyone, admins
  -- remove agents only, so one admin cannot evict a peer or stage a takeover.
  IF v_member.user_id <> auth.uid() THEN
    IF v_role = 'admin' AND v_member.role <> 'agent' THEN
      RAISE EXCEPTION 'An admin can only remove agents' USING ERRCODE = 'insufficient_privilege';
    ELSIF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Only an owner or admin can remove a team member'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- The row is deleted outright, so my_business_ids() stops returning this
  -- business for them on their very next query. There is no lingering access.
  DELETE FROM public.team_members WHERE id = p_member_id;
END;
$$;

-- Role changes are the owner's alone. This is the only way a role can change,
-- which is why team_members has no UPDATE policy for authenticated at all.
CREATE OR REPLACE FUNCTION public.set_team_member_role(p_member_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member public.team_members%ROWTYPE;
BEGIN
  IF p_role NOT IN ('admin', 'agent') THEN
    RAISE EXCEPTION 'Role must be admin or agent' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_member FROM public.team_members WHERE id = p_member_id;
  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF public.business_role(v_member.business_id) <> 'owner' THEN
    RAISE EXCEPTION 'Only the owner can change a team member role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_member.role = 'owner' THEN
    RAISE EXCEPTION 'The owner role cannot be changed here' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.team_members SET role = p_role WHERE id = p_member_id;
END;
$$;

-- Seats used, the limit, and what the caller may do. One round trip for the
-- whole team panel.
CREATE OR REPLACE FUNCTION public.team_overview(p_business_id UUID)
RETURNS TABLE (seat_limit INT, seats_used INT, my_role TEXT, plan TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT := public.business_role(p_business_id);
BEGIN
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this business' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT public.team_seat_limit(p_business_id),
         public.team_seats_used(p_business_id),
         v_role,
         COALESCE((SELECT p.plan_type FROM public.businesses b
                     JOIN public.profiles p ON p.user_id = b.owner_id
                    WHERE b.id = p_business_id), 'free')::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_team_members(UUID)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_team_invitation(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_team_invitation(TEXT)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_team_invitation(UUID)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_team_member(UUID)                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_team_member_role(UUID, TEXT)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_overview(UUID)                      FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_team_members(UUID)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_team_invitation(UUID)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_team_member(UUID)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_team_member_role(UUID, TEXT)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_overview(UUID)                      TO authenticated, service_role;

COMMENT ON TABLE public.team_plan_limits IS
  'Seats included with each plan, owner counted. The single source of truth for the team size limit.';
COMMENT ON TABLE public.team_members IS
  'Who may work a business. Mutated only through the team RPCs, never directly from the browser.';
COMMENT ON TABLE public.team_invitations IS
  'Pending team invitations. Only the SHA-256 of the token is stored; pending rows hold a seat.';
