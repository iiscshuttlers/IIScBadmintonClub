import { supabase } from './client/src/lib/supabase';
async function run() {
  const { data } = await supabase.from('tournament_matches').select('*').or('player1_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b,player2_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b');
  const sureshId = '59c8707c-4873-46e6-a174-9192691598e0';
  const filtered = data.filter(m => m.player1_id === sureshId || m.player2_id === sureshId || m.player3_id === sureshId || m.player4_id === sureshId);
  console.log(filtered);
}
run();
