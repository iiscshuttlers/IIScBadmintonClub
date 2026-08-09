import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envStr = fs.readFileSync(path.resolve('../.env.local'), 'utf-8');
const envVars = {};
envStr.split('\n').forEach(line => {
  if (line.includes('=')) {
    const [key, ...rest] = line.split('=');
    envVars[key.trim()] = rest.join('=').trim().replace(/^['"](.*)['"]$/, '$1');
  }
});

const supabase = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY']
);

async function run() {
  const { data, error } = await supabase.from('players').insert({
    id: '12345678-1234-1234-1234-123456789012',
    full_name: 'Test',
    email: 'test@example.com'
  });
  
  const res2 = await supabase.from('players').insert({
    id: '87654321-4321-4321-4321-210987654321',
    full_name: 'Test', // Same name
    email: 'test2@example.com'
  });
  console.log("Insert 2 result (same name, diff email):", res2.error?.message, res2.error?.details);
  
  const res3 = await supabase.from('players').insert({
    id: '11111111-2222-3333-4444-555555555555',
    full_name: 'Test3', 
    email: 'test@example.com' // Same email
  });
  console.log("Insert 3 result (diff name, same email):", res3.error?.message, res3.error?.details);
  
  await supabase.from('players').delete().eq('full_name', 'Test');
}

run();
