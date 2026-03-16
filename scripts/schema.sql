-- ═══ Mercado Visível — Database Schema ═══
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─── Leads table ────────────────────────────────────────────────────────
create table if not exists public.leads (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  
  -- Contact
  email text not null,
  whatsapp text default '',

  -- Digital presence (step 2)
  site text default '',
  instagram text default '',
  other_social text default '',
  google_maps text default '',
  digital_presence text[] default '{}',

  -- Business info (step 1 now)
  product text not null,
  region text not null,
  address text default '',
  ticket text default '',

  -- Business vision (step 3)
  channels text[] default '{}',
  differentiator text default '',
  competitors text[] default '{}',

  -- Final (step 4)
  challenge text default '',
  free_text text default '',

  -- Status tracking
  status text default 'pending' check (status in ('pending', 'processing', 'done', 'paid')),
  locale text default 'pt',
  coupon text default '',

  -- Pipeline results (JSONB — full display data saved after diagnosis)
  diagnosis_display jsonb,

  -- Plan generation
  plan_status text default null,

  -- User tracking
  clerk_user_id text,
  weeks_active integer default 0,
  last_active_at timestamp with time zone,

  -- Stripe
  stripe_session_id text,
  paid_at timestamp with time zone
);

-- ─── Diagnoses table ────────────────────────────────────────────────────
create table if not exists public.diagnoses (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  
  -- Search data
  terms jsonb not null default '[]',
  total_volume integer not null default 0,
  avg_cpc numeric(10,2) not null default 0,
  
  -- Market sizing (range, not single number)
  market_low integer not null default 0,
  market_high integer not null default 0,
  influence_percent numeric(5,2) not null default 0,
  
  -- Metadata
  source text default 'Google Ads Keyword Planner (estimativa)',
  confidence text default 'Estimativa',
  
  -- Claude enrichment (when available)
  enrichment jsonb,

  -- Pipeline metadata
  pipeline_run_id uuid,
  raw_data jsonb,
  confidence_level text,
  audiencia jsonb
);

-- ─── Indexes ────────────────────────────────────────────────────────────
create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_diagnoses_lead_id on public.diagnoses(lead_id);

-- ─── Row Level Security ─────────────────────────────────────────────────
alter table public.leads enable row level security;
alter table public.diagnoses enable row level security;

-- Allow inserts from anon (form submissions)
create policy "Allow anonymous inserts" on public.leads
  for insert with check (true);

create policy "Allow anonymous inserts" on public.diagnoses
  for insert with check (true);

-- Allow reads for own data (by lead_id in query)
create policy "Allow anonymous reads" on public.leads
  for select using (true);

create policy "Allow anonymous reads" on public.diagnoses
  for select using (true);

-- Allow status updates
create policy "Allow anonymous updates" on public.leads
  for update using (true);

-- ─── Migration: add columns if missing ───────────────────────────────────
-- Run these if the table already exists but is missing newer columns.
-- ALTER TABLE is idempotent with IF NOT EXISTS (Postgres 9.6+).
do $$
begin
  -- leads columns
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='whatsapp') then
    alter table public.leads add column whatsapp text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='diagnosis_display') then
    alter table public.leads add column diagnosis_display jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='plan_status') then
    alter table public.leads add column plan_status text default null;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='clerk_user_id') then
    alter table public.leads add column clerk_user_id text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='weeks_active') then
    alter table public.leads add column weeks_active integer default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='last_active_at') then
    alter table public.leads add column last_active_at timestamp with time zone;
  end if;
  -- diagnoses columns
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='pipeline_run_id') then
    alter table public.diagnoses add column pipeline_run_id uuid;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='raw_data') then
    alter table public.diagnoses add column raw_data jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='confidence_level') then
    alter table public.diagnoses add column confidence_level text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='audiencia') then
    alter table public.diagnoses add column audiencia jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='competition_index') then
    alter table public.diagnoses add column competition_index jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='client_type') then
    alter table public.diagnoses add column client_type text default 'b2c';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='client_type') then
    alter table public.leads add column client_type text default 'b2c';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='name') then
    alter table public.leads add column name text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='linkedin') then
    alter table public.leads add column linkedin text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='diagnoses' and column_name='influence_breakdown') then
    alter table public.diagnoses add column influence_breakdown jsonb;
  end if;
  -- Lifecycle columns
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='briefing_end_date') then
    alter table public.leads add column briefing_end_date timestamp with time zone;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='upsell_email_sent') then
    alter table public.leads add column upsell_email_sent boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='closure_email_sent') then
    alter table public.leads add column closure_email_sent boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='feedback_score') then
    alter table public.leads add column feedback_score integer;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='feedback_text') then
    alter table public.leads add column feedback_text text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='customer_description') then
    alter table public.leads add column customer_description text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='place_id') then
    alter table public.leads add column place_id text default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='lat') then
    alter table public.leads add column lat numeric;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='leads' and column_name='lng') then
    alter table public.leads add column lng numeric;
  end if;
end $$;

-- ─── Plans table ──────────────────────────────────────────────────────────
create table if not exists public.plans (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  status text default 'generating' check (status in ('generating', 'ready', 'error')),
  content jsonb,
  generation_model text,
  prompt_version text default 'v1',
  duration_ms integer
);

create index if not exists idx_plans_lead_id on public.plans(lead_id);

-- ─── Snapshots table (weekly re-scrape data) ─────────────────────────────
create table if not exists public.snapshots (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  week_number integer not null,
  data jsonb,
  diff_from_previous jsonb,
  sources_used text[] default '{}',
  sources_unavailable text[] default '{}',
  collection_duration_ms integer,
  unique(lead_id, week_number)
);

create index if not exists idx_snapshots_lead_id on public.snapshots(lead_id);

-- ─── Briefings table ─────────────────────────────────────────────────────
create table if not exists public.briefings (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  week_number integer not null,
  content jsonb,
  snapshot_id uuid,
  generation_model text,
  prompt_version text default 'v1',
  email_sent_at timestamp with time zone,
  whatsapp_sent_at timestamp with time zone,
  unique(lead_id, week_number)
);

create index if not exists idx_briefings_lead_id on public.briefings(lead_id);

-- ─── Events table (tracking) ─────────────────────────────────────────────
create table if not exists public.events (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  event_type text not null,
  lead_id uuid references public.leads(id) on delete set null,
  metadata jsonb default '{}'
);

create index if not exists idx_events_lead_id on public.events(lead_id);
create index if not exists idx_events_type on public.events(event_type);

-- ─── Pipeline runs table ─────────────────────────────────────────────────
create table if not exists public.pipeline_runs (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  pipeline_version text,
  total_duration_ms integer,
  steps_timing jsonb,
  sources_used text[] default '{}',
  sources_unavailable text[] default '{}',
  confidence_level text
);

create index if not exists idx_pipeline_runs_lead_id on public.pipeline_runs(lead_id);

-- ─── RLS for new tables ──────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.snapshots enable row level security;
alter table public.briefings enable row level security;
alter table public.events enable row level security;
alter table public.pipeline_runs enable row level security;

create policy "Allow all plans" on public.plans for all using (true) with check (true);
create policy "Allow all snapshots" on public.snapshots for all using (true) with check (true);
create policy "Allow all briefings" on public.briefings for all using (true) with check (true);
create policy "Allow all events" on public.events for all using (true) with check (true);
create policy "Allow all pipeline_runs" on public.pipeline_runs for all using (true) with check (true);
