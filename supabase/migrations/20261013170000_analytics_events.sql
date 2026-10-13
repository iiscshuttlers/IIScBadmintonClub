-- #27 Lightweight, privacy-respecting product analytics.
-- Stores coarse product events (no PII beyond an optional player_id) so the
-- team can see what's used. Anyone signed in can log an event; only admins
-- can read them.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  props jsonb not null default '{}'::jsonb,
  player_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists analytics_events_event_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;

-- Signed-in users can log events (as themselves or anonymously via null).
drop policy if exists "log analytics" on public.analytics_events;
create policy "log analytics"
  on public.analytics_events for insert
  to authenticated
  with check (player_id is null or auth.uid() = player_id);

-- Only admins can read the event stream.
drop policy if exists "admins read analytics" on public.analytics_events;
create policy "admins read analytics"
  on public.analytics_events for select
  to authenticated
  using (exists (select 1 from public.players p where p.id = auth.uid() and p.role in ('admin','master_admin')));

-- Aggregated counts for the admin dashboard (last N days). Admin-gated via the
-- SELECT policy above is not enough for a SECURITY DEFINER function, so this is
-- SECURITY INVOKER and relies on the caller's RLS.
create or replace function public.analytics_event_counts(days_back integer default 30)
returns table (event text, count bigint)
language sql
stable
as $$
  select event, count(*)::bigint as count
  from public.analytics_events
  where created_at > now() - make_interval(days => days_back)
  group by event
  order by count desc;
$$;
