const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.hzyxikdngfuzjlsgqqas:sb_publishable_dWERfMPzKYO5Cxyj35vsUg_xnjwzdNx@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  await client.connect();
  
  const sql = `
CREATE OR REPLACE FUNCTION toggle_match_kudos(p_match_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_player_id UUID    := auth.uid();
  v_is_liked  BOOLEAN;
BEGIN
  IF v_player_id IS NULL THEN RAISE EXCEPTION 'Not authenticated or no player profile'; END IF;

  -- Check if match is in matches table
  IF EXISTS (SELECT 1 FROM matches WHERE id = p_match_id) THEN
    SELECT v_player_id::text = ANY(COALESCE(kudos_users, ARRAY[]::TEXT[])) INTO v_is_liked FROM matches WHERE id = p_match_id;
    IF v_is_liked THEN
      UPDATE matches SET
        kudos_users = array_remove(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text),
        kudos_count = GREATEST(0, COALESCE(kudos_count, 0) - 1)
      WHERE id = p_match_id;
    ELSE
      UPDATE matches SET
        kudos_users = array_append(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text),
        kudos_count = COALESCE(kudos_count, 0) + 1
      WHERE id = p_match_id;
    END IF;
  
  -- Else check tournament_matches table
  ELSIF EXISTS (SELECT 1 FROM tournament_matches WHERE id = p_match_id) THEN
    SELECT v_player_id::text = ANY(COALESCE(kudos_users, ARRAY[]::TEXT[])) INTO v_is_liked FROM tournament_matches WHERE id = p_match_id;
    IF v_is_liked THEN
      UPDATE tournament_matches SET
        kudos_users = array_remove(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text),
        kudos_count = GREATEST(0, COALESCE(kudos_count, 0) - 1)
      WHERE id = p_match_id;
    ELSE
      UPDATE tournament_matches SET
        kudos_users = array_append(COALESCE(kudos_users, ARRAY[]::TEXT[]), v_player_id::text),
        kudos_count = COALESCE(kudos_count, 0) + 1
      WHERE id = p_match_id;
    END IF;
  END IF;
END;
$$;
  `;
  
  try {
    await client.query(sql);
    console.log("Updated toggle_match_kudos successfully!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
