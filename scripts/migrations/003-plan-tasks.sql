-- ═══ Migration 003: plan_tasks ═══
-- Tarefas semanais do plano com checkboxes de conclusão
-- Run in Supabase SQL Editor

create table if not exists public.plan_tasks (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now(),
  lead_id uuid references public.leads(id) on delete cascade not null,
  week integer not null,
  channel text not null default 'geral',
  title text not null,
  description text default '',
  completed boolean default false,
  completed_at timestamp with time zone
);

create index if not exists idx_plan_tasks_lead_id on public.plan_tasks(lead_id);
create index if not exists idx_plan_tasks_lead_week on public.plan_tasks(lead_id, week);

-- RLS permissiva (mesmo padrão das demais tabelas — auth é via Clerk no app)
alter table public.plan_tasks enable row level security;
create policy "Allow all plan_tasks" on public.plan_tasks for all using (true) with check (true);
