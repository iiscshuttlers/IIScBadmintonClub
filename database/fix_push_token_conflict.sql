-- Root cause of push tokens never saving (table stayed empty):
--
-- The table had two mutually exclusive constraints:
--   * FOREIGN KEY (user_id) REFERENCES players(id)  -> user_id must be a player slug
--   * RLS INSERT check: auth.uid()::text = user_id   -> user_id must be the auth UUID
--
-- A slug is never a UUID, so every insert failed: the app inserts the auth UUID
-- (profile.user_id), which passes RLS but violates the foreign key. The backend
-- (notify-match) also queries tokens by the auth UUID, so user_id SHOULD hold the
-- UUID and the foreign key to players(id) is simply wrong.
--
-- Drop the incorrect foreign key. RLS still guarantees user_id matches the
-- authenticated user, so referential integrity is preserved.

ALTER TABLE public.user_push_tokens
  DROP CONSTRAINT IF EXISTS user_push_tokens_user_id_fkey;
