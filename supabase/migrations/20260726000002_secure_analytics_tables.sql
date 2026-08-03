-- Secure Analytics Subsystem (Strict RBAC with Multi-Source Support)

-- Helper function to centralize participation checks across all match sources
CREATE OR REPLACE FUNCTION is_authorized_for_analytics(p_auth_uid UUID, p_match_id UUID, p_match_source TEXT, p_target_player UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    (p_auth_uid = p_target_player) AND (
      (p_match_source = 'practice') OR
      (p_match_source = 'tournament' AND EXISTS (
        SELECT 1 FROM tournament_matches tm
        WHERE tm.id = p_match_id
        AND p_auth_uid IN (tm.player1_id, tm.player2_id, tm.player3_id, tm.player4_id)
      )) OR
      (p_match_source = 'friendly' AND EXISTS (
        SELECT 1 FROM matches m
        WHERE m.id = p_match_id
        AND p_auth_uid IN (m.player1_id, m.player2_id, m.team1_partner_id, m.team2_partner_id)
      )) OR
      EXISTS (SELECT 1 FROM public.players WHERE id = p_auth_uid AND role IN ('admin', 'master_admin', 'umpire'))
    );
$$;

-- Revoke default PUBLIC execution access
REVOKE EXECUTE ON FUNCTION is_authorized_for_analytics(UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_authorized_for_analytics(UUID, UUID, TEXT, UUID) TO authenticated;


-- match_stroke_analytics
DROP POLICY IF EXISTS "Players and admins can insert match strokes" ON match_stroke_analytics;
CREATE POLICY "Players and admins can insert match strokes" ON match_stroke_analytics
  FOR INSERT WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, processed_by));

DROP POLICY IF EXISTS "Users can update strokes they processed" ON match_stroke_analytics;
CREATE POLICY "Users can update strokes they processed" ON match_stroke_analytics
  FOR UPDATE USING (is_authorized_for_analytics(auth.uid(), match_id, match_source, processed_by))
  WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, processed_by));


-- match_motion_stats
DROP POLICY IF EXISTS "mms_auth_insert" ON match_motion_stats;
CREATE POLICY "mms_auth_insert" ON match_motion_stats
  FOR INSERT WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, recorded_by));

DROP POLICY IF EXISTS "mms_auth_update_own" ON match_motion_stats;
CREATE POLICY "mms_auth_update_own" ON match_motion_stats
  FOR UPDATE USING (is_authorized_for_analytics(auth.uid(), match_id, match_source, recorded_by))
  WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, recorded_by));


-- match_sensor_analytics
DROP POLICY IF EXISTS "msa_auth_insert" ON match_sensor_analytics;
CREATE POLICY "msa_auth_insert" ON match_sensor_analytics
  FOR INSERT WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, player_id));

DROP POLICY IF EXISTS "msa_auth_update_own" ON match_sensor_analytics;
CREATE POLICY "msa_auth_update_own" ON match_sensor_analytics
  FOR UPDATE USING (is_authorized_for_analytics(auth.uid(), match_id, match_source, player_id))
  WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, player_id));


-- match_rally_stats
DROP POLICY IF EXISTS "mrs_auth_insert" ON match_rally_stats;
CREATE POLICY "mrs_auth_insert" ON match_rally_stats
  FOR INSERT WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, recorded_by));

DROP POLICY IF EXISTS "mrs_auth_update_own" ON match_rally_stats;
CREATE POLICY "mrs_auth_update_own" ON match_rally_stats
  FOR UPDATE USING (is_authorized_for_analytics(auth.uid(), match_id, match_source, recorded_by))
  WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, recorded_by));


-- match_player_paths
DROP POLICY IF EXISTS "mpp_auth_insert" ON match_player_paths;
CREATE POLICY "mpp_auth_insert" ON match_player_paths
  FOR INSERT WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, processed_by));

DROP POLICY IF EXISTS "mpp_auth_update_own" ON match_player_paths;
CREATE POLICY "mpp_auth_update_own" ON match_player_paths
  FOR UPDATE USING (is_authorized_for_analytics(auth.uid(), match_id, match_source, processed_by))
  WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, processed_by));


-- match_video_calibration
DROP POLICY IF EXISTS "mvc_auth_insert" ON match_video_calibration;
CREATE POLICY "mvc_auth_insert" ON match_video_calibration
  FOR INSERT WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, created_by));

DROP POLICY IF EXISTS "mvc_auth_update_own" ON match_video_calibration;
CREATE POLICY "mvc_auth_update_own" ON match_video_calibration
  FOR UPDATE USING (is_authorized_for_analytics(auth.uid(), match_id, match_source, created_by))
  WITH CHECK (is_authorized_for_analytics(auth.uid(), match_id, match_source, created_by));
