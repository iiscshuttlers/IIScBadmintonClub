-- #21 Persist achievement unlocks (earned timestamps), so badges have real
-- "earned on" dates and can power feeds/leaderboards later. Unlocks are
-- detected client-side (deterministic from match history) and written by the
-- owner; everyone can read them.

create table if not exists public.player_achievements (
  player_id uuid references public.players(id) on delete cascade not null,
  achievement_id text not null,
  earned_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, achievement_id)
);

create index if not exists player_achievements_player_idx
  on public.player_achievements (player_id, earned_at desc);

alter table public.player_achievements enable row level security;

-- Anyone signed in can see earned achievements (they are already visible on
-- profiles — this just adds the timestamp).
drop policy if exists "achievements readable" on public.player_achievements;
create policy "achievements readable"
  on public.player_achievements for select
  to authenticated
  using (true);

-- A player records only their own unlocks.
drop policy if exists "record own achievements" on public.player_achievements;
create policy "record own achievements"
  on public.player_achievements for insert
  to authenticated
  with check (auth.uid() = player_id);
