import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: players } = await supabase.from('players').select('id, full_name').ilike('full_name', '%Raja%');
  const rajaId = players?.[0]?.id;
  
  if (rajaId) {
    const tM = await supabase.from('tournament_matches').select('*').or(`player1_id.eq.${rajaId},player2_id.eq.${rajaId},player3_id.eq.${rajaId},player4_id.eq.${rajaId}`).eq('status', 'completed');
    console.log('Tournament matches completed:', tM.data);
    
    const m = await supabase.from('matches').select('*').or(`player1_id.eq.${rajaId},player2_id.eq.${rajaId},team1_partner_id.eq.${rajaId},team2_partner_id.eq.${rajaId}`).eq('status', 'confirmed');
    console.log('Regular matches confirmed:', m.data);
  }
}
main();
