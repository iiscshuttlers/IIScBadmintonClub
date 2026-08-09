import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: admin } = await supabase.from('players').select('id, full_name, role').ilike('email', '%admin%');
  console.log('Admin Player:', admin);
  
  // try inserting a dummy log
  const { error } = await supabase.from('elo_calculation_logs').insert([
    {
      match_uuid: '00000000-0000-0000-0000-000000000000',
      player_id: admin?.[0]?.id,
      previous_elo: 1200,
      new_elo: 1200,
      elo_change: 0,
      expected_score: 0.5,
      actual_score: 0.5,
      category: 'Singles'
    }
  ]);
  console.log('Insert log with fake uuid error:', error);
}

main();
