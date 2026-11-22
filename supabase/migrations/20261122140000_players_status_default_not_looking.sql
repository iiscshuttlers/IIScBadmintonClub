-- players.status: stop marking everyone "looking" (Available) by default.
--
-- 20261118100000_restore_players_status added the column as
-- `not null default 'looking'`, so all 300 players read as looking to play
-- without anyone choosing it. The status picker that could change it was
-- removed (8922eaa9), so nobody has picked any value since: on 22 Nov every
-- row was 'looking' and none was playing/resting/injured.
--
-- From now on NULL means "not set" = not looking. Only an explicit choice
-- makes a player 'looking'. The live "I'm available to play now" toggle
-- (player_availability) is unaffected and stays the real "free now" signal.
--
-- The legacy is_looking_to_play flag is reset too: the profile form derived it
-- from the same 'looking' default on save, so its true values (239 on 22 Nov)
-- were never a choice either. Its column default is already false.
--
-- The check constraint (looking | playing | resting | injured) still holds:
-- CHECK passes NULL. The `reset-playing-status-at-court-close` cron only
-- touches rows where status = 'playing', so it is unaffected. No trigger on
-- players reads status or is_looking_to_play.
--
-- Rollback (restores the pre-migration state exactly for status, since every
-- row was 'looking'; is_looking_to_play's old values carried no information):
--   alter table public.players alter column status set default 'looking';
--   update public.players set status = 'looking' where status is null;
--   alter table public.players alter column status set not null;

alter table public.players alter column status drop not null;
alter table public.players alter column status set default null;

update public.players set status = null where status = 'looking';
update public.players set is_looking_to_play = false where is_looking_to_play is true;

comment on column public.players.status is
  'Availability picker: looking (Available) | playing | resting | injured. NULL = not set (not looking).';
