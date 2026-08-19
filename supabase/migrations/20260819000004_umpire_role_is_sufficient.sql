-- Simplify who may umpire: the ROLE is the permission.
--
-- Previously a user needed role = 'umpire' AND a row in umpire_assignments
-- (either for that specific match, or a time block covering now). That second
-- layer duplicated the role check, had to be maintained per match or per shift,
-- and — combined with the score-save bug fixed in 20260819000003 — is what
-- pushed umpires into being promoted to full admins just to score a game.
--
-- Assignments are now advisory only: they still drive scheduling and the
-- "my matches" view via tournament_matches.umpired_by, but they no longer gate
-- who can score. Nothing is dropped, so existing assignment data stays intact.

CREATE OR REPLACE FUNCTION public.can_umpire_match(p_match_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE id = p_uid
      AND role IN ('admin', 'master_admin', 'umpire')
  );
$$;

COMMENT ON FUNCTION public.can_umpire_match(uuid, uuid) IS
  'True when the user may score a tournament match. Role-based only: admin, '
  'master_admin or umpire. p_match_id is retained for call-site compatibility '
  'and in case per-match rules are reintroduced.';
