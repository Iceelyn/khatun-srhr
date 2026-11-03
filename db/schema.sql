-- Naiz database tables (Supabase / Postgres).
-- Supabase dashboard > SQL Editor > paste this > Run.
--
-- Security: Row Level Security is ON and there are NO public policies, so the public
-- "anon" key can't read or write anything. Only the Naiz server, using the
-- service_role key (kept in SUPABASE_SERVICE_KEY, never in the browser), can.
-- Testers can only ADD feedback through /api/tester-feedback; only the team
-- (TEAM_TOKEN) can read, triage, export or delete it.

create table if not exists tester_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text,              -- young_woman | health_worker | parent | other
  age_group text,         -- 18-20 | 21-24 | 25-29 | 30+ | ''
  platform text,          -- ios | android | windows | mac | linux | other (from the browser, coarse)
  source text,
  consent boolean not null default false,
  task_chat text,         -- easy | hard | failed | skipped
  task_check text,
  task_clinic text,
  rate_easy smallint check (rate_easy between 1 and 5),
  rate_private smallint check (rate_private between 1 and 5),
  rate_trust smallint check (rate_trust between 1 and 5),
  rate_would_test smallint check (rate_would_test between 1 and 5),
  liked text,
  confusing text,
  change text,
  -- filled in by the team when triaging
  category text default '', -- bug | usability | missing_feature | enhancement | positive | not_actionable
  priority text default '', -- P0 | P1 | P2 | P3
  moscow text default '',   -- must | should | could | wont
  status text default 'new',-- new | planned | fixed | wont_fix
  team_note text default ''
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null,     -- anonymous code like W01 / H01 / P01. Never a name.
  grp text,               -- young_woman | health_worker | parent
  method text,            -- in_person | phone | online
  month text,             -- YYYY-MM only (no exact dates)
  consent boolean not null default false,
  key_points text,
  quote text,
  themes text
);

-- Anonymous usage counts: no message text, names or IDs.
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ev text,                -- question | check | feedback
  ch text,                -- web | messenger
  refs jsonb,             -- knowledge-base entry ids used
  flag text,              -- red-flag type, if any
  mode text,              -- llm | keyword | red_flag | no_match
  level text,             -- check result level
  helpful boolean
);

alter table tester_feedback enable row level security;
alter table interviews enable row level security;
alter table events enable row level security;

-- Let the server (service_role key) use the tables. Newer Supabase projects don't always
-- grant this automatically to tables made in the SQL Editor. Safe to run more than once.
grant usage on schema public to service_role;
grant select, insert, update, delete on table tester_feedback, interviews, events to service_role;
-- The public anon/authenticated roles get nothing: RLS is on and there are no policies.
revoke all on table tester_feedback, interviews, events from anon, authenticated;

-- Problem-validation survey answers from /survey (research/02-protocol.md, section A).
-- Anonymous: no name, email or phone. Tick-all answers are stored as JSON lists.
create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lang text,              -- mn | en
  age_group text,         -- 18-20 | 21-24 | 25-29
  location text,          -- ulaanbaatar | aimag_center | soum | other
  gyn_visits text,        -- never | once | more
  last_gyn text,          -- within_1y | 1_3y | over_3y | never
  unchecked_worry text,   -- yes | no | prefer_not
  barriers jsonb default '[]'::jsonb,
  info_sources jsonb default '[]'::jsonb,
  info_trust text,        -- 1-5
  heard_hpv text,         -- yes | no | not_sure
  would_use_chat text,    -- 1-5
  what_would_help text    -- scrubbed of emails, phone numbers and links
);
alter table survey_responses enable row level security;
grant select, insert, update, delete on table survey_responses to service_role;
revoke all on table survey_responses from anon, authenticated;

-- Tell the Supabase API to notice new tables straight away.
notify pgrst, 'reload schema';
