import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

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
