import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://htejmhsqqlfedlajqqyv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0ZWptaHNxcWxmZWRsYWpxcXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTc1NjAsImV4cCI6MjA5ODkzMzU2MH0.2HhspVm0_ncPvEsv7-qET_6SYtjTP1s6nUbwuy30FRk';

// We need to use service key to simulate an authenticated user via set_config, or just use anon key with a JWT!
// Actually, let's just use service_role to check if the role is master_admin
const supabase = createClient(supabaseUrl, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || supabaseKey);

async function main() {
  const { data: admin1 } = await supabase.from('players').select('id, full_name, role').ilike('email', 'admin@iisc.ac.in');
  const { data: admin2 } = await supabase.from('players').select('id, full_name, role').ilike('email', 'iiscbadmintonclub@gmail.com');
  const { data: admin3 } = await supabase.from('players').select('id, full_name, role').ilike('email', 'raja79sharma@gmail.com');
  
  console.log('admin@iisc.ac.in:', admin1);
  console.log('iiscbadmintonclub@gmail.com:', admin2);
  console.log('raja79sharma@gmail.com:', admin3);
}

main();
