-- Purge all location/geofence remnants.
-- venue_presence_events was fed by an Android geofence (a location service).
-- The client geofence code is already gone; this removes the now-unused DB
-- objects so there is zero location trace left in the project. Idempotent and
-- safe whether or not the table still exists.

do $$
begin
  if to_regclass('public.venue_presence_events') is not null then
    -- DROP TRIGGER IF EXISTS still errors when the table is absent, so guard it.
    drop trigger if exists venue_presence_notification_trigger on public.venue_presence_events;
    drop table if exists public.venue_presence_events cascade;
  end if;
end $$;

-- Functions are independent of the table; safe to drop unconditionally.
drop function if exists public.get_venue_active_count();
drop function if exists public.get_venue_hourly_pattern(integer);
drop function if exists public.trigger_venue_presence_notification();
