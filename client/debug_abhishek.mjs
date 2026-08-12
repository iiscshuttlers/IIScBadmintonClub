import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && k.trim()) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkDuplicates() {
  const { data, error } = await supabase
    .from('players')
    .select('id, full_name, iisc_email, email')
    .ilike('full_name', '%Abhishek%');
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Players matching Abhishek:", data);
}

checkDuplicates();
