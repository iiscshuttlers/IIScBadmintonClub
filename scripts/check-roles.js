import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'client/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data } = await supabase.from('site_data').select('*').eq('key', 'roles').single();
  console.log('Roles:', JSON.stringify(data, null, 2));
  
  // also get the JAHA player
  const { data: players } = await supabase.from('players').select('id, full_name, user_id, iisc_email');
  const jaha = players.find(p => p.full_name.toLowerCase().includes('jaha'));
  console.log('JAHA Player:', jaha);
}
checkRoles();
