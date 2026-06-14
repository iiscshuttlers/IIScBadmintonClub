-- Notification queue for smart batching (#56)
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   TEXT        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  sent        BOOLEAN     NOT NULL DEFAULT false,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on notification_queue" ON public.notification_queue;

CREATE POLICY "Service role full access on notification_queue"
  ON public.notification_queue FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_notif_queue_unsent  ON public.notification_queue (sent, created_at) WHERE sent = false;
CREATE INDEX IF NOT EXISTS idx_notif_queue_player  ON public.notification_queue (player_id);

-- nudge_sent_at on matches for match confirmation throttling (#58)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_pending_nudge
  ON public.matches (status, created_at, nudge_sent_at)
  WHERE status = 'pending';
