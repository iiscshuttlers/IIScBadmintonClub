import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => { const [k, ...v] = line.split('='); if(k) acc[k] = v.join('=').trim().replace(/"|'/g, ''); return acc; }, {});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: players } = await supabase.from('players').select('id').eq('full_name', 'Manish Mandal');
  const id = players[0].id;
  const { data, error } = await supabase.rpc('recalculate_player_all_records', { player_uuid: id });
  const { data: players2 } = await supabase.from('players').select('win_loss_record, doubles_record').eq('id', id);
  console.log(players2);
}
run();
