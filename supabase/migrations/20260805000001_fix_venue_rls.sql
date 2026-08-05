drop policy if exists "Users can log their own presence events" on public.venue_presence_events;

create policy "Users can log their own presence events"
  on public.venue_presence_events for insert
  with check (
    auth.uid() = player_id OR 
    (select email from players where id = player_id) = auth.jwt()->>'email'
  );
