-- Purge all location/geofence remnants.
-- venue_presence_events was fed by an Android geofence (a location service).
-- The client geofence code is already gone; this removes the now-unused DB
-- objects so there is zero location trace left in the project. Idempotent.

-- Drop the insert trigger first (also removed by the table CASCADE below, but
-- explicit for clarity and in case the table was already dropped).
drop trigger if exists venue_presence_notification_trigger on public.venue_presence_events;

-- Drop the table (CASCADE clears any remaining dependent objects/policies).
drop table if exists public.venue_presence_events cascade;

-- Drop the aggregate / notification functions.
drop function if exists public.get_venue_active_count();
drop function if exists public.get_venue_hourly_pattern(integer);
drop function if exists public.trigger_venue_presence_notification();
