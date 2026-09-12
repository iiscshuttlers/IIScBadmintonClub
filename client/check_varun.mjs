import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => { const [k, ...v] = line.split('='); if(k) acc[k] = v.join('=').trim().replace(/"|'/g, ''); return acc; }, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: tourney } = await supabase.from('tournament_matches').select('*');
  tourney?.forEach(t => {
    if (t.player1_id && (t.player1_id === t.player2_id || t.player1_id === t.player3_id || t.player1_id === t.player4_id)) console.log('Dup:', t.id, t.score);
    else if (t.player2_id && (t.player2_id === t.player3_id || t.player2_id === t.player4_id)) console.log('Dup:', t.id, t.score);
    else if (t.player3_id && t.player3_id === t.player4_id) console.log('Dup:', t.id, t.score);
  });
}
run();
