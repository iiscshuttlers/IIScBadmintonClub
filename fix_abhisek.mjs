import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('client/.env.local', 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const abhisekId = '79e6d1cf-7097-4859-b75b-133bd670925d';

  // 1. MD_3RD_01
  const { data: d1, error: e1 } = await supabase.from('tournament_matches')
    .update({ player2_id: abhisekId })
    .eq('match_code', 'MD_3RD_01')
    .ilike('category', '%MD%');
  console.log('MD_3RD_01', e1 || 'success');

  // 2. MD_QF_03
  const { data: d2, error: e2 } = await supabase.from('tournament_matches')
    .update({ player1_id: abhisekId })
    .eq('match_code', 'MD_QF_03')
    .ilike('category', '%MD%');
  console.log('MD_QF_03', e2 || 'success');

  // 3. MD_SF_02
  const { data: d3, error: e3 } = await supabase.from('tournament_matches')
    .update({ player1_id: abhisekId })
    .eq('match_code', 'MD_SF_02')
    .ilike('category', '%MD%');
  console.log('MD_SF_02', e3 || 'success');

  // Also fix tournament_participants just in case (already did earlier, but make sure)
  await supabase.from('tournament_participants')
    .update({ player_id: abhisekId })
    .ilike('display_name', 'Abhisek K & Kaustav Basumatary');

  console.log("Done fixing Abhisek's missing IDs.");
}
run();
