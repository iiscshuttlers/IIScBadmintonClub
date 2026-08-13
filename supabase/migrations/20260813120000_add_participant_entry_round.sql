-- Manual seeding control: let an admin pin the round a participant plays their
-- first match in, instead of always handing byes to the top seeds automatically.
--
-- entry_round semantics (draw-size independent, so it survives participants
-- being added or removed):
--   NULL -> automatic. The draw hands this participant a bye only if there are
--           spare bye slots left after the pinned participants are honoured.
--   1    -> plays in round 1 (no bye). Pinning this pushes byes past them.
--   2    -> one bye (e.g. enters at the round of 64 in a 128 draw)
--   3    -> two byes (e.g. enters at the round of 32 in a 128 draw)
--
-- Additive and nullable: every existing row stays NULL, which is the previous
-- automatic behaviour, so nothing that reads or writes this table changes.

alter table public.tournament_participants
  add column if not exists entry_round integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tournament_participants_entry_round_check'
      and conrelid = 'public.tournament_participants'::regclass
  ) then
    alter table public.tournament_participants
      add constraint tournament_participants_entry_round_check
      check (entry_round is null or entry_round between 1 and 16);
  end if;
end $$;

comment on column public.tournament_participants.entry_round is
  'Round this participant plays their first match in. NULL = automatic bye allocation, 1 = no bye, 2 = one bye, 3 = two byes.';
