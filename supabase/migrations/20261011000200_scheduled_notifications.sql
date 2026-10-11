-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1 — Scheduled / broadcast notifications backbone
--
-- One queue for reminders and announcements that organisers, referees and
-- umpires send across channels (email / push / in-app), either immediately or
-- scheduled for a future date-time. A later phase adds the dispatcher edge
-- function + cron that drains rows whose scheduled_at has passed and fans each
-- out to the channels every recipient has opted into (players.pref_receive_email
-- / pref_receive_push). This migration only creates the table + policies.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE, -- NULL = club-wide (admins only)
  created_by    uuid REFERENCES public.players(id) ON DELETE SET NULL,
  title         text NOT NULL,
  body          text NOT NULL,
  channels      text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  audience      text NOT NULL DEFAULT 'custom'
                  CHECK (audience IN ('all', 'tournament', 'team', 'custom')),
  recipient_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[], -- resolved players.id recipients
  scheduled_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at       timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_notifications_channels_valid
    CHECK (channels <@ ARRAY['email', 'push', 'in_app']::text[]
           AND array_length(channels, 1) >= 1)
);

-- Dispatcher reads due rows: pending with scheduled_at in the past.
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due
  ON public.scheduled_notifications (scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_tournament
  ON public.scheduled_notifications (tournament_id);

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Senders = admins, the tournament's organiser, or an assigned official.
-- (is_tournament_official(NULL, ...) resolves to admin-only, so club-wide
-- broadcasts are restricted to admins.)
DROP POLICY IF EXISTS "scheduled_notifications_manage" ON public.scheduled_notifications;
CREATE POLICY "scheduled_notifications_manage" ON public.scheduled_notifications
  FOR ALL TO authenticated
  USING (
    is_admin_or_master()
    OR created_by = auth.uid()
    OR is_tournament_official(tournament_id)
  )
  WITH CHECK (
    is_admin_or_master()
    OR created_by = auth.uid()
    OR is_tournament_official(tournament_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_notifications TO authenticated;
GRANT ALL ON public.scheduled_notifications TO service_role;
