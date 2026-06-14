-- Admin activity log table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id          BIGSERIAL   PRIMARY KEY,
  admin_email TEXT        NOT NULL,
  action      TEXT        NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read logs" ON public.admin_logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.admin_logs;

-- Admin check is enforced at the app level via VITE_ADMIN_EMAILS.
-- RLS allows any authenticated user to read (the admin UI is route-guarded).
CREATE POLICY "Admins can read logs"
  ON public.admin_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert logs"
  ON public.admin_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_email      ON public.admin_logs (admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action     ON public.admin_logs (action);
