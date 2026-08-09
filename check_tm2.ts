import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: tm } = await supabase.from('tournament_matches').select('*').or('player1_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b,player2_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b,player3_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b,player4_id.eq.1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b');
  console.log('TMs:', tm);
}

main();
