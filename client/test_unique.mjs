import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && k.trim()) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkConstraints() {
  // Query to get all unique constraints for players table via postgres rest api 
  // actually let's just make a dummy request to try and insert a duplicate name but different email to see if it fails.
  const { data: d1, error: e1 } = await supabase.from('players').insert({
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Test Name 1',
    iisc_email: 'test1@iisc.ac.in',
    email: 'test1@gmail.com'
  });
  
  const { data: d2, error: e2 } = await supabase.from('players').insert({
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Test Name 1',
    iisc_email: 'test2@iisc.ac.in',
    email: 'test2@gmail.com'
  });
  
  console.log("Insert 1 error:", e1?.message);
  console.log("Insert 2 error:", e2?.message);
  console.log("Insert 2 code:", e2?.code);
  
  // cleanup
  await supabase.from('players').delete().in('id', ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']);
}

checkConstraints();
