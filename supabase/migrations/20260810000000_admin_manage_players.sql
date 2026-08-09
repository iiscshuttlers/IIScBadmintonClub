BEGIN;

-- Admin delete policy
CREATE POLICY "Admins can delete any player" ON public.players
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
    )
  );

-- Admin update policy
CREATE POLICY "Admins can update any player" ON public.players
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players 
      WHERE id = auth.uid() AND role IN ('admin', 'master_admin')
    )
  );

COMMIT;
