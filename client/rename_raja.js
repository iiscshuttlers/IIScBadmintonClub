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
  const { data, error } = await supabase.from('players').select('*').eq('full_name', 'Raja');
  console.log("Found players:", data?.length, "error:", error);
  
  if (data && data.length > 0) {
    const oldRaja = data.find(p => p.email === 'Raja@iisc.ac.in') || data[0];
    const res = await supabase.from('players').update({ 
      full_name: 'Raja (Guest)', 
      email: null, 
      iisc_email: null,
      is_guest: true
    }).eq('id', oldRaja.id);
    
    console.log("Renamed old Raja to Raja (Guest). Result:", res.error || "Success");
    console.log("Old Raja ID:", oldRaja.id);
  }
}

run();
