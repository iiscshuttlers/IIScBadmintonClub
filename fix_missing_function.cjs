const { Client } = require('pg');
async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  await client.connect();
  const sql = `
CREATE OR REPLACE FUNCTION process_tournament_bracket_progression(p_match_id UUID, p_winner_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- We just delegate to the newer function which only requires the match_id
  PERFORM advance_tournament_winner(p_match_id);
END;
$$;
  `;
  try {
    await client.query(sql);
    console.log("Successfully created process_tournament_bracket_progression!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}
run();
