-- CTAP Tracker – Supabase schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New Query)

-- ── users_profile ──────────────────────────────────────────────────────────
create table if not exists public.users_profile (
  id               uuid primary key references auth.users(id) on delete cascade,
  display_name     text not null default '',
  base_hours       numeric not null default 40,
  weekly_target_pct numeric not null default 0.8,
  starting_balance numeric not null default 0,
  theme            text not null default 'dark',
  coach_mode       boolean not null default false,
  migration_complete boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.users_profile enable row level security;

create policy "users_profile: own row only"
  on public.users_profile
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── weeks ──────────────────────────────────────────────────────────────────
create table if not exists public.weeks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  week_key         text not null,           -- 'YYYY-MM-DD' (Monday)
  deduction_mins   integer not null default 0,
  exclude_from_ctap boolean not null default false,
  shifts_json      jsonb not null default '{}',
  mentor_days_json jsonb not null default '{}',
  deductions_json  jsonb not null default '[]',
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(user_id, week_key)
);

alter table public.weeks enable row level security;

create policy "weeks: own rows only"
  on public.weeks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists weeks_user_id_week_key on public.weeks(user_id, week_key);

-- ── job_logs ───────────────────────────────────────────────────────────────
create table if not exists public.job_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  week_key         text not null,
  day_key          text not null,           -- 'YYYY-MM-DD'
  job_id           text not null,
  job_name         text not null default '',
  credit_mins      integer not null default 0,
  variable_value   numeric,
  logged_at        timestamptz not null default now(),
  sort_order       integer not null default 0
);

alter table public.job_logs enable row level security;

create policy "job_logs: own rows only"
  on public.job_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists job_logs_user_week on public.job_logs(user_id, week_key);
create index if not exists job_logs_user_day  on public.job_logs(user_id, day_key);

-- ── updated_at trigger (shared function) ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger users_profile_updated_at
  before update on public.users_profile
  for each row execute procedure public.set_updated_at();

create or replace trigger weeks_updated_at
  before update on public.weeks
  for each row execute procedure public.set_updated_at();
