import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: players } = await supabase.from('players').select('id, full_name, singles_elo, doubles_elo, mixed_elo').ilike('full_name', '%Raja Janmejay%');
  console.log('Players:', players);
  
  if (players && players.length > 0) {
    const { data: logs } = await supabase.from('elo_calculation_logs').select('*').eq('player_id', players[0].id);
    console.log('Logs for', players[0].full_name, ':', logs);
  }
}

main();
