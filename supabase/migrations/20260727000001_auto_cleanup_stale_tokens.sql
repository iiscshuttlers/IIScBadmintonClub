-- Auto-cleanup stale push tokens older than 7 days
-- FCM tokens expire after ~1 week without refresh

CREATE OR REPLACE FUNCTION cleanup_stale_push_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_push_tokens
  WHERE updated_at < NOW() - INTERVAL '7 days';

  RAISE NOTICE 'Cleaned up stale push tokens older than 7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily
-- (Note: Requires pg_cron extension - check if available)
-- SELECT cron.schedule('cleanup-stale-tokens', '0 2 * * *', 'SELECT cleanup_stale_push_tokens();');
