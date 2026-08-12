import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && k.trim()) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

// Use service role key to bypass RLS
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function checkConstraints() {
  console.log("Inserting user 1...");
  const res1 = await supabase.from('players').insert({
    id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Test Name 1',
    iisc_email: 'test1@iisc.ac.in',
    email: 'test1@gmail.com'
  });
  console.log("Res1:", res1.error ? res1.error.message : "Success");
  
  console.log("Inserting user 2 with same name...");
  const res2 = await supabase.from('players').insert({
    id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Test Name 1',
    iisc_email: 'test2@iisc.ac.in',
    email: 'test2@gmail.com'
  });
  console.log("Res2:", res2.error ? res2.error.message : "Success");
  
  await supabase.from('players').delete().in('id', ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']);
}

checkConstraints();
