-- Recognise every admin in the tournaments admin policies.
--
-- tournaments_admin_read and tournaments_admin_write matched admins only by
-- players.id = auth.uid(). The one players.role = 'admin' account has a
-- players.id that differs from their auth uid; is_admin_or_master() matches
-- them by their JWT e-mail, and so does the client (AuthContext), which shows
-- them the Tournament Admin screens. On tournaments someone else created,
-- their direct writes (settings, soft delete, Restore to Draft, Permanently
-- Delete) matched no policy and changed 0 rows without an error. Only the
-- self-host policies (created_by = auth.uid()) let them edit their own.
--
-- is_admin_or_master() (SECURITY DEFINER, STABLE) is the admin check that 15
-- other policies, is_tournament_official() and the enforce_ranked_gate
-- trigger on this table already use. It is true for the service role,
-- players with role admin or master_admin matched by id or by e-mail, and the
-- club's admin e-mail addresses. It is wrapped in (SELECT ...) so Postgres
-- evaluates it once per statement instead of once per row.
--
-- On 2026-11-18 this widens the tournaments admin policies from 1 login to 3:
-- the admin above, and the master admin's second login (signed in with the
-- IISc address in players.iisc_email, whose players row has the other
-- login's id). Both are already admins in the client and in the 15 policies
-- above. No login loses access, and no login gets admin rights only from the
-- e-mail list.
--
-- tournaments_admin_write is FOR ALL, so it also grants SELECT; together with
-- tournaments_official_read this makes tournaments_admin_read redundant. It
-- is kept so the policy set and its rollback stay one-for-one.
--
-- Not changed here: tp_admin_all (tournament_participants) and trr_admin_all
-- (tournament_round_rules) use the same id-only check.
--
-- Rollback: supabase/rollbacks/20261118160200_tournament_admin_policies_use_is_admin_or_master.rollback.sql

ALTER POLICY "tournaments_admin_read" ON public.tournaments
  USING ((SELECT public.is_admin_or_master()));

ALTER POLICY "tournaments_admin_write" ON public.tournaments
  USING ((SELECT public.is_admin_or_master()))
  WITH CHECK ((SELECT public.is_admin_or_master()));
