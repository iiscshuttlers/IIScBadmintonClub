-- Venue presence tracking, fed by the Android geofence (enter/exit Gymkhana).
-- Raw events are private to each player; everyone else only ever sees the
-- aggregate functions below, never a per-user row.

create table if not exists public.venue_presence_events (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.players(id) on delete cascade not null,
  event_type text not null check (event_type in ('enter', 'exit')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists venue_presence_events_player_created_idx
  on public.venue_presence_events (player_id, created_at desc);

create index if not exists venue_presence_events_created_idx
  on public.venue_presence_events (created_at desc);

alter table public.venue_presence_events enable row level security;

drop policy if exists "Users can log their own presence events" on public.venue_presence_events;
create policy "Users can log their own presence events"
  on public.venue_presence_events for insert
  with check (auth.uid() = player_id);

drop policy if exists "Users can view their own presence events" on public.venue_presence_events;
create policy "Users can view their own presence events"
  on public.venue_presence_events for select
  using (auth.uid() = player_id);

-- Live headcount: a player counts as "at the venue" if their most recent
-- event is 'enter' and it happened recently. The staleness cutoff covers
-- cases where the EXIT transition never fires (app killed, permission
-- revoked, phone died) so nobody gets stuck "checked in" forever.
create or replace function public.get_venue_active_count()
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer
  from (
    select distinct on (player_id) player_id, event_type, created_at
    from public.venue_presence_events
    order by player_id, created_at desc
  ) latest
  where latest.event_type = 'enter'
    and latest.created_at > now() - interval '3 hours';
$$;

grant execute on function public.get_venue_active_count() to authenticated, anon;

-- "Popular times"-style pattern: average number of enter-events per hour of
-- day, over the trailing N days. Aggregate only — never returns player_id.
create or replace function public.get_venue_hourly_pattern(days_back integer default 14)
returns table (hour_of_day integer, avg_checkins numeric)
language sql
security definer
stable
set search_path = public
as $$
  select
    h.hour_of_day,
    coalesce(round(avg(daily.checkins), 1), 0) as avg_checkins
  from generate_series(0, 23) as h(hour_of_day)
  left join (
    select
      extract(hour from created_at)::integer as hour_of_day,
      date_trunc('day', created_at) as day,
      count(*) as checkins
    from public.venue_presence_events
    where event_type = 'enter'
      and created_at > now() - (days_back || ' days')::interval
    group by 1, 2
  ) daily on daily.hour_of_day = h.hour_of_day
  group by h.hour_of_day
  order by h.hour_of_day;
$$;

grant execute on function public.get_venue_hourly_pattern(integer) to authenticated, anon;
