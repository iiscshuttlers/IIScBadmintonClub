-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: tie_lineup_watchers and automated reveal alert notifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tie_lineup_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tie_id uuid NOT NULL REFERENCES public.tournament_ties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tie_id, user_id)
);

ALTER TABLE public.tie_lineup_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watch self insert" ON public.tie_lineup_watchers;
CREATE POLICY "watch self insert" ON public.tie_lineup_watchers
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "watch self read" ON public.tie_lineup_watchers;
CREATE POLICY "watch self read" ON public.tie_lineup_watchers
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "watch self delete" ON public.tie_lineup_watchers;
CREATE POLICY "watch self delete" ON public.tie_lineup_watchers
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.tie_lineup_watchers TO authenticated;
GRANT ALL ON public.tie_lineup_watchers TO service_role;

-- Index for speedy watcher resolution on tie reveal
CREATE INDEX IF NOT EXISTS idx_tie_lineup_watchers_tie_id
  ON public.tie_lineup_watchers(tie_id);

-- Function to enqueue notifications and notify watchers when a tie's lineups are revealed/locked
CREATE OR REPLACE FUNCTION public.notify_tie_lineup_watchers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_watchers uuid[];
  v_tie RECORD;
  v_title text;
  v_body text;
BEGIN
  -- We trigger when either both lineups become locked OR tie changes state to IN_PROGRESS
  IF (NEW.lineup_locked_a = true AND NEW.lineup_locked_b = true AND (OLD.lineup_locked_a = false OR OLD.lineup_locked_b = false))
     OR (NEW.state = 'IN_PROGRESS' AND OLD.state != 'IN_PROGRESS') THEN
    
    SELECT t.id, t.tie_code, t.tournament_id,
           ta.name as team_a_name, tb.name as team_b_name
    INTO v_tie
    FROM public.tournament_ties t
    LEFT JOIN public.tournament_teams ta ON ta.id = t.team_a_id
    LEFT JOIN public.tournament_teams tb ON tb.id = t.team_b_id
    WHERE t.id = NEW.id;

    -- Fetch all watcher user IDs
    SELECT array_agg(user_id) INTO v_watchers
    FROM public.tie_lineup_watchers
    WHERE tie_id = NEW.id;

    IF v_watchers IS NOT NULL AND array_length(v_watchers, 1) > 0 THEN
      v_title := 'Lineup Announced: ' || COALESCE(v_tie.tie_code, 'Tie');
      v_body := COALESCE(v_tie.team_a_name, 'Team A') || ' vs ' || COALESCE(v_tie.team_b_name, 'Team B') || ' lineups have been confirmed!';

      -- Enqueue into scheduled_notifications for dispatch
      INSERT INTO public.scheduled_notifications (
        tournament_id,
        title,
        body,
        channels,
        audience,
        recipient_ids,
        scheduled_at,
        status
      ) VALUES (
        v_tie.tournament_id,
        v_title,
        v_body,
        ARRAY['in_app', 'push']::text[],
        'custom',
        v_watchers,
        now(),
        'pending'
      );

      -- Delete watchers once notified
      DELETE FROM public.tie_lineup_watchers WHERE tie_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tie_lineup_watchers ON public.tournament_ties;
CREATE TRIGGER trg_notify_tie_lineup_watchers
  AFTER UPDATE OF lineup_locked_a, lineup_locked_b, state
  ON public.tournament_ties
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tie_lineup_watchers();
