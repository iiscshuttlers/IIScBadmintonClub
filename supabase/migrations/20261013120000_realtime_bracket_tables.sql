-- #31 Live bracket advancement: ensure team-tie tables emit realtime changes.
-- Adds tournament_ties and tournament_matches to the supabase_realtime
-- publication so the client RealtimeProvider receives postgres_changes for
-- them. Guarded by to_regclass so a missing table is skipped, and each table
-- handled independently. Idempotent.

do $$
begin
  if to_regclass('public.tournament_ties') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'tournament_ties'
     ) then
    alter publication supabase_realtime add table public.tournament_ties;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tournament_matches') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'tournament_matches'
     ) then
    alter publication supabase_realtime add table public.tournament_matches;
  end if;
end $$;
