import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Get SUPABASE_URL and SUPABASE_ANON_KEY from client/.env.local
const envFile = fs.readFileSync('client/.env.local', 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data, error } = await supabase.from('tournament_matches')
    .select('id, match_code, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label')
    .ilike('category', '%MD%')
    .in('match_code', ['MD_3RD_01', 'MD_SF_02', 'MD_SF_01', 'MD_QF_03'])
    .limit(10);
  console.log(JSON.stringify(data, null, 2));
}
run();
