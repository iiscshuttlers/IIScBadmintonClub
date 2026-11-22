-- Top pages for the admin Analytics panel (app simplification, 22 Nov 2026).
-- The client logs `page_view` events with props.route = the route shape only
-- (ids, slugs, tokens, query and hash stripped; see client/src/lib/pageViews.ts).
--
-- SECURITY INVOKER like analytics_event_counts: it relies on the caller's RLS,
-- where only admins can read analytics_events, so non-admins get no rows.

create or replace function public.analytics_top_pages(days_back integer default 14, max_rows integer default 25)
returns table (route text, views bigint, members bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(props->>'route', '(unknown)') as route,
    count(*)::bigint as views,
    count(distinct player_id)::bigint as members
  from public.analytics_events
  where event = 'page_view'
    and created_at > now() - make_interval(days => greatest(days_back, 1))
  group by 1
  order by views desc
  limit greatest(least(max_rows, 200), 1);
$$;

-- Signed-in callers only (RLS still limits rows to admins).
revoke all on function public.analytics_top_pages(integer, integer) from public, anon;
grant execute on function public.analytics_top_pages(integer, integer) to authenticated;
