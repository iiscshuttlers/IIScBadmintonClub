-- #31 Live bracket advancement: ensure team-tie tables emit realtime changes.
-- Adds tournament_ties and tie_matches to the supabase_realtime publication so
-- the client RealtimeProvider receives postgres_changes for them. Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournament_ties'
  ) then
    alter publication supabase_realtime add table public.tournament_ties;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tie_matches'
  ) then
    alter publication supabase_realtime add table public.tie_matches;
  end if;
end $$;
