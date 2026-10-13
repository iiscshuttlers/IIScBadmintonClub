-- #31 "Available to play now" — a purely manual, user-initiated presence signal.
-- NO location/geofence involved: a player explicitly toggles availability, which
-- sets an expiry timestamp. Everyone can see who is currently available.

create table if not exists public.player_availability (
  player_id uuid primary key references public.players(id) on delete cascade,
  available_until timestamptz not null,
  note text,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists player_availability_until_idx
  on public.player_availability (available_until desc);

alter table public.player_availability enable row level security;

-- Anyone signed in can see who is available.
drop policy if exists "availability readable by authenticated" on public.player_availability;
create policy "availability readable by authenticated"
  on public.player_availability for select
  to authenticated
  using (true);

-- A player manages only their own availability row.
drop policy if exists "manage own availability (insert)" on public.player_availability;
create policy "manage own availability (insert)"
  on public.player_availability for insert
  to authenticated
  with check (auth.uid() = player_id);

drop policy if exists "manage own availability (update)" on public.player_availability;
create policy "manage own availability (update)"
  on public.player_availability for update
  to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

drop policy if exists "manage own availability (delete)" on public.player_availability;
create policy "manage own availability (delete)"
  on public.player_availability for delete
  to authenticated
  using (auth.uid() = player_id);

-- Live updates for the directory.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_availability'
  ) then
    alter publication supabase_realtime add table public.player_availability;
  end if;
end $$;
