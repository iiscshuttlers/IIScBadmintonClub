import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const env = fs.readFileSync(path.resolve('.env'), 'utf-8');
const envVars = Object.fromEntries(env.split('\n').map(line => line.split('=')));

const supabase = createClient(
  envVars.VITE_SUPABASE_URL.trim(),
  envVars.VITE_SUPABASE_SERVICE_ROLE_KEY.trim()
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
