-- AI Tool Matchmaker: initial schema.
-- Run in the Supabase SQL editor (or `supabase db push`). Then `npx tsx scripts/backfill.ts --import-json` to load data/tools.json.

create type tool_status as enum ('draft', 'published', 'rejected');
create type trust_level as enum ('verified', 'checks_passed', 'partial', 'unverified');
create type setup_complexity as enum ('low', 'medium', 'high');
create type engagement as enum ('self_serve', 'free_trial', 'book_demo', 'needs_setup_help');

create table tools (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  vendor text,
  canonical_url text unique not null,
  description text not null default '',
  status tool_status not null default 'draft',
  use_cases text[] not null default '{}',          -- first = primary
  industries text[] not null default '{}',
  pricing jsonb not null default '{}'::jsonb,       -- {free_plan, free_trial_days, est_monthly_usd_min, est_monthly_usd_max, plan_name, pricing_url}
  integrations text[] not null default '{}',        -- normalized taxonomy ids
  works_standalone boolean,
  integration_requirements text[] not null default '{}',
  setup_complexity setup_complexity,
  setup_steps text[] not null default '{}',
  engagement engagement,
  reviews jsonb,                                    -- {rating, count, source_url}
  vendor_checks jsonb not null default '{}'::jsonb,
  trust_level trust_level not null default 'unverified',
  warnings text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,      -- field -> {source_url, quote, claim_type}
  missing_fields text[] not null default '{}',
  last_checked_at timestamptz not null default now(),
  admin_reviewed boolean not null default false
);

create index tools_use_cases_idx on tools using gin (use_cases);
create index tools_industries_idx on tools using gin (industries);
create index tools_integrations_idx on tools using gin (integrations);
create index tools_status_idx on tools (status);

create table discovery_runs (
  id uuid primary key default gen_random_uuid(),
  query jsonb not null default '{}'::jsonb,
  status text not null default 'running',
  counts jsonb not null default '{"found":0,"new":0,"updated":0,"skipped":0,"failed":0}'::jsonb,
  log text[] not null default '{}',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Owners can read published tools; every write goes through server routes using the service role key.
alter table tools enable row level security;
alter table discovery_runs enable row level security;

create policy "public read published tools" on tools
  for select to anon using (status = 'published');
