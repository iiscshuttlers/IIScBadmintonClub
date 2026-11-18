-- Restore players.status: the Available / Playing / Resting / Injured picker.
--
-- The client (PersonalProfilePage's status picker via
-- playerService.updatePlayerStatus, and useProfileSetup) and the pg_cron job
-- `reset-playing-status-at-court-close` (UPDATE players SET status = 'resting'
-- WHERE status = 'playing', daily 17:00 UTC) all use this column, but it did
-- not exist in production: every status change failed and the cron job errored
-- on every run.
--
-- Every existing row starts as 'looking'. That is what the app already showed
-- for everyone, because it fell back to 'looking' when status was missing, so
-- nobody's visible status changes. No backfill from is_looking_to_play: its
-- column default is false, so false doesn't reliably mean a player chose it.
--
-- Old clients are compatible: they already write status (which now succeeds)
-- and read it with a 'looking' fallback. anon/authenticated have table-level
-- SELECT/UPDATE on players and RLS limits updates to the owner or admins, so no
-- column grants are needed; protect_player_sensitive_columns doesn't guard it.
--
-- Idempotent, so it is safe to apply on its own with
-- `supabase db query --remote -f` (see docs/decisions/wp10-*.md) and again
-- later through `db push`.

alter table public.players
  add column if not exists status text not null default 'looking';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'players_status_check'
       and conrelid = 'public.players'::regclass
  ) then
    alter table public.players
      add constraint players_status_check
      check (status in ('looking', 'playing', 'resting', 'injured'));
  end if;
end $$;

comment on column public.players.status is
  'Availability shown on the profile: looking (Available), playing, resting, injured. '
  'reset-playing-status-at-court-close moves playing -> resting nightly.';
