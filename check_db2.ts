import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), 'client/.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'] || '';
const supabaseKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'] || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: players } = await supabase.from('players').select('id, full_name, elo_rating, singles_elo, singles_matches_played, doubles_elo, mixed_elo').ilike('full_name', '%Raja%');
  console.log('Players:', players);

  if (players && players.length > 0) {
    const p = players[0];
    const { data: logs } = await supabase.from('elo_calculation_logs').select('*').eq('player_id', p.id).order('created_at', { ascending: true });
    console.log('Logs for Raja:', logs);

    const { data: friendly } = await supabase.from('matches').select('*').or(`player1_id.eq.${p.id},player2_id.eq.${p.id}`);
    console.log('Friendly matches:', friendly?.map(m => ({ id: m.id, status: m.status, score: m.score, elo_change_p1: m.elo_change_p1 })));

    const { data: tourney } = await supabase.from('tournament_matches').select('*').or(`player1_id.eq.${p.id},player2_id.eq.${p.id}`);
    console.log('Tourney matches:', tourney?.map(m => ({ id: m.id, status: m.status, score: m.score })));
  }
}

main();
