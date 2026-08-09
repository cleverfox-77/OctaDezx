-- Voice: persona, per-direction openers and instructions, owner training, and
-- capability flags.
--
-- Four things drove this:
--
--   1. Outbound calls spoke the inbound greeting, so a call OUT opened with
--      "you have reached our team", which is nonsense to the person answering.
--      Outbound now has its own opener and its own instructions.
--   2. The assistant had one instruction block for both directions. Answering a
--      customer who dialled you and ringing someone who did not are different
--      jobs and needed to be configurable separately.
--   3. Owners had no way to train the voice assistant beyond the shared
--      ai_instructions used by chat.
--   4. Identifying as an automated assistant and reading an opt-out line were
--      hardcoded. They are now settings, defaulted off at the owner's explicit
--      instruction. See the note on disclose_ai below.
--
-- The existing `greeting` column keeps its meaning and becomes the INBOUND
-- greeting rather than being renamed, so a deployed media server reading it
-- carries on working through this migration instead of breaking until redeploy.

alter table public.voice_settings
  -- Who the caller thinks they are talking to.
  add column if not exists persona_name  text,
  add column if not exists persona_role  text,
  add column if not exists persona_style text not null
    default 'Warm, natural and easy to talk to. Sounds like a real colleague, not a script.',

  -- Openers. `greeting` above is the inbound one.
  add column if not exists outbound_greeting text not null
    default 'Hi, sorry to call out of the blue. Do you have a quick minute?',

  -- Owner training. Empty means "use the built in behaviour for that
  -- direction"; the prompt builder supplies sensible defaults rather than
  -- forcing every owner to write instructions before voice works at all.
  add column if not exists inbound_instructions  text not null default '',
  add column if not exists outbound_instructions text not null default '',

  -- Reusable default context for outbound calls. A single call can override it
  -- with its own note, which is what the "what the call is about" box sends.
  add column if not exists outbound_script text not null default '',

  -- Disclosure controls.
  --
  -- Defaulted false on the owner's explicit instruction after being told what
  -- each one is for: disclose_ai covers California's B.O.T. Act and EU AI Act
  -- Article 50, include_opt_out covers the TCPA opt-out expected on outbound
  -- artificial-voice calls in the US. Both are per business and the dashboard
  -- states the trade off at the switch. Leaving them as columns rather than
  -- constants means a business that needs them can turn them on without a
  -- code change.
  add column if not exists disclose_ai     boolean not null default false,
  add column if not exists include_opt_out boolean not null default false,

  -- What the assistant may actually DO on a call, as opposed to describe.
  add column if not exists can_book_appointments boolean not null default true,
  add column if not exists can_take_orders       boolean not null default true,
  add column if not exists can_answer_questions  boolean not null default true;

comment on column public.voice_settings.greeting is
  'Spoken to callers who dial in. Outbound uses outbound_greeting.';
comment on column public.voice_settings.disclose_ai is
  'When true the assistant states it is automated. Off by default; see CA B.O.T. Act and EU AI Act Art 50.';
comment on column public.voice_settings.include_opt_out is
  'When true outbound calls offer a spoken opt-out. Off by default; see TCPA.';

-- The shipped default greeting announced "an automated assistant". Owners who
-- never edited it would keep saying that regardless of the new setting, so the
-- default text changes with it.
--
-- Only rows still holding the exact old default are rewritten. Anything an
-- owner has customised, even slightly, is left alone: silently rewording what
-- a business says to its customers is not this migration's business.
alter table public.voice_settings
  alter column greeting set default 'Hi, thanks for calling. How can I help?';

update public.voice_settings
   set greeting = 'Hi, thanks for calling. How can I help?'
 where greeting = 'Hi, you have reached our team. You are speaking with an automated assistant. How can I help?';

-- Same reasoning for the answering machine message.
alter table public.voice_settings
  alter column amd_message set default
    'Hi, sorry we missed you. Please give us a call back when you get a chance.';

update public.voice_settings
   set amd_message = 'Hi, sorry we missed you. Please give us a call back when you get a chance.'
 where amd_message = 'Hello, this is an automated call from your service provider. Please call us back at your convenience.';
