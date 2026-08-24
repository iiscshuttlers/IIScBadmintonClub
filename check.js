import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
const supabase = createClient(url, key);
async function run() {
  const { data } = await supabase.from('tournament_matches').select('*').or('player1_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b,player2_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b');
  const sureshId = '59c8707c-4873-46e6-a174-9192691598e0';
  const filtered = data.filter(m => m.player1_id === sureshId || m.player2_id === sureshId || m.player3_id === sureshId || m.player4_id === sureshId);
  console.log('Matches with Suresh:', filtered.length);
  
  // also check if "Unknown Partner" returns
  const { data: p } = await supabase.from('players').select('id, full_name');
  
  // recreate logic
  let stats = {};
  data.forEach(m => {
    let partnerId = null;
    let myTeamWon = false;
    let playerId = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b';

    let tPartner1 = m.player3_id;
    let tPartner2 = m.player4_id;

    if (m.player1_id === playerId && tPartner1) {
      partnerId = tPartner1;
    } else if (tPartner1 === playerId) {
      partnerId = m.player1_id;
    } else if (m.player2_id === playerId && tPartner2) {
      partnerId = tPartner2;
    } else if (tPartner2 === playerId) {
      partnerId = m.player2_id;
    }

    if (partnerId) {
      if (!stats[partnerId]) {
        let pName = p.find(x => x.id === partnerId)?.full_name || 'Unknown Partner';
        stats[partnerId] = { count: 0, name: pName };
      }
      stats[partnerId].count++;
    }
  });
  console.log(stats);
}
run();
