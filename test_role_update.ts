import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
// Use the anon key - the frontend uses this
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Try to update Radhika Dutt's role to 'umpire' using direct table update
  const { data, error } = await supabase
    .from('players')
    .update({ role: 'umpire' })
    .eq('id', '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b') // Raja Janmejay
    .select('id, full_name, role');
  
  console.log('Updated data:', data);
  console.log('Error:', error);
}

main();
