import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('tournament_matches').select('id, match_code, status, winner_side, advances_to_match, player1_id, player2_id, team1_label, team2_label').eq('status', 'walkover');
  console.log('Walkover matches:', data);
}
run();
