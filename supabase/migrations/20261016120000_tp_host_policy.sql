-- Allow tournament creators (hosts) to manage participants in their own tournaments
CREATE POLICY "tp_host_manage" ON "public"."tournament_participants"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."tournaments" t
      WHERE t.id = tournament_participants.tournament_id
        AND t.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."tournaments" t
      WHERE t.id = tournament_participants.tournament_id
        AND t.created_by = auth.uid()
    )
  );
