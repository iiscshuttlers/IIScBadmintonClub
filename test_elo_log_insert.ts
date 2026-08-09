import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Try direct insert to elo_calculation_logs
  const { data, error } = await supabase
    .from('elo_calculation_logs')
    .insert({
      match_uuid: 'd2a32585-59a6-4de9-92f6-0f1081fc5c40',
      player_id: '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b',
      previous_elo: 1200,
      new_elo: 1231,
      elo_change: 31,
      expected_score: 0.5,
      actual_score: 1.0,
      category: 'MS'
    })
    .select();
    
  console.log('Insert result:', data);
  console.log('Insert error:', error);
}

main();
