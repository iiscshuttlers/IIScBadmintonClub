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
    .select('id, full_name, email');
  
  if (error) {
    console.error(error);
    return;
  }
  
  const names = new Set();
  const emails = new Set();
  
  data.forEach(p => {
    if (names.has(p.full_name)) console.log(`Duplicate name: ${p.full_name}`);
    if (p.email && emails.has(p.email)) console.log(`Duplicate email: ${p.email}`);
    names.add(p.full_name);
    if (p.email) emails.add(p.email);
  });
  console.log("Total players:", data.length);
}

checkDuplicates();
