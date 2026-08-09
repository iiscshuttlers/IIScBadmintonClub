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
    const res = await supabase.from('players').update({ email: 'Raja@iisc.ac.in', iisc_email: 'Raja@iisc.ac.in' }).eq('id', data[0].id);
    console.log("Update result:", res.error || "Success");
  }
}

run();
