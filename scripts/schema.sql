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
  enrichment jsonb
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
