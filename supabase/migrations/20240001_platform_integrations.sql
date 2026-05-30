-- Platform Integrations Table
-- Stores credentials & state for each connected messaging platform per business

create table if not exists public.platform_integrations (
  id                    uuid        default gen_random_uuid() primary key,
  business_id           uuid        not null references public.businesses(id) on delete cascade,
  platform              text        not null,   -- 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'viber' | 'line'
  status                text        not null default 'disconnected',
                        -- 'disconnected' | 'pending' | 'connected' | 'error'
  credentials           jsonb       not null default '{}'::jsonb,
                        -- encrypted at rest by Supabase; contains tokens/IDs per platform
  webhook_verify_token  text        not null default gen_random_uuid()::text,
  webhook_verified      boolean     not null default false,
  platform_account_name text,       -- human-readable name of the connected account / page / bot
  platform_account_id   text,       -- platform's own identifier for the account
  connected_at          timestamptz,
  last_message_at       timestamptz,
  message_count         integer     not null default 0,
  error_message         text,       -- last error detail if status = 'error'
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint platform_integrations_status_check
    check (status in ('disconnected', 'pending', 'connected', 'error')),
  constraint platform_integrations_platform_check
    check (platform in ('whatsapp', 'facebook', 'instagram', 'telegram', 'viber', 'line')),
  constraint platform_integrations_business_platform_uniq
    unique (business_id, platform)
);

-- Updated-at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_integrations_updated_at on public.platform_integrations;
create trigger platform_integrations_updated_at
  before update on public.platform_integrations
  for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.platform_integrations enable row level security;

-- Only the business owner can read / write their integrations
create policy "owner_select" on public.platform_integrations
  for select using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "owner_insert" on public.platform_integrations
  for insert with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "owner_update" on public.platform_integrations
  for update using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "owner_delete" on public.platform_integrations
  for delete using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Service-role bypass for webhook edge function
create policy "service_all" on public.platform_integrations
  for all using (auth.role() = 'service_role');

comment on table public.platform_integrations is
  'Stores messaging-platform connection credentials and stats per business. Credentials column is protected by Supabase column-level encryption at rest.';
