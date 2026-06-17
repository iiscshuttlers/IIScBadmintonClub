-- Broadcast notification history
-- Logged every time an admin sends a custom push notification

CREATE TABLE IF NOT EXISTS broadcast_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by text NOT NULL,         -- admin email
  title text NOT NULL,
  body text,
  url text,
  devices_sent int DEFAULT 0,
  devices_failed int DEFAULT 0
);

-- Admins can read full history; regular users cannot
ALTER TABLE broadcast_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read broadcast history"
  ON broadcast_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
  );

CREATE POLICY "Admins can insert broadcast history"
  ON broadcast_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role IN ('master_admin', 'admin'))
  );
