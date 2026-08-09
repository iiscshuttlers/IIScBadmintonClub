import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixByeMatches() {
  const rajaId = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b';

  console.log('Fixing MD_R1_03...');
  await supabase.from('tournament_matches')
    .update({ winner_side: 1, winner_id: rajaId })
    .eq('match_code', 'MD_R1_03');
    
  console.log('Fixing MD_QF_02 player1_id...');
  await supabase.from('tournament_matches')
    .update({ player1_id: rajaId })
    .eq('match_code', 'MD_QF_02');

  console.log('Fixing XD_R1_11...');
  await supabase.from('tournament_matches')
    .update({ winner_side: 1, winner_id: rajaId })
    .eq('match_code', 'XD_R1_11');
    
  console.log('Fixing XD_R2_06 player1_id...');
  await supabase.from('tournament_matches')
    .update({ player1_id: rajaId })
    .eq('match_code', 'XD_R2_06');

  console.log('Recalculating ELO...');
  await supabase.rpc('recalculate_all_elo');
  console.log('Done!');
}

fixByeMatches();
