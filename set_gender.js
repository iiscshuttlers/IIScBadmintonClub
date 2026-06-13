import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envContent = '';
try {
  envContent = fs.readFileSync('./client/.env.local', 'utf8');
} catch (e) {
  envContent = fs.readFileSync('./client/.env', 'utf8');
}

const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'] || env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in client/.env.local or client/.env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Setting gender to Male for all players except Radhika Dutt...");
  
  // Set everyone to Male
  const { error: errMale } = await supabase
    .from('players')
    .update({ gender: 'Male' })
    .neq('full_name', 'Radhika Dutt');
    
  if (errMale) {
    console.error("Error setting Male:", errMale);
  } else {
    console.log("Successfully set Male for all other players.");
  }

  console.log("Setting gender to Female for Radhika Dutt...");
  const { error: errFemale } = await supabase
    .from('players')
    .update({ gender: 'Female' })
    .eq('full_name', 'Radhika Dutt');
    
  if (errFemale) {
    console.error("Error setting Female:", errFemale);
  } else {
    console.log("Successfully set Female for Radhika Dutt.");
  }
}

run();
