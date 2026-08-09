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
  const oldRajaId = 'bd837392-4cf7-440c-82ee-12fc8f5b735c';
  
  // Find the new Raja profile
  const { data, error } = await supabase.from('players').select('*').eq('full_name', 'Raja Janmejay');
  console.log("Found players:", data?.length, "error:", error);
  
  const newRaja = data?.find(p => p.id !== oldRajaId);
  if (!newRaja) {
    console.log("New Raja profile not found yet. The user needs to save their profile first.");
    return;
  }
  
  console.log("Found New Raja ID:", newRaja.id);
  
  // Transfer matches using claim_guest_player via rpc
  // Wait, claim_guest_player relies on auth.uid() being an admin.
  // Since we use SERVICE_ROLE_KEY, it bypasses RLS but maybe not auth.uid() checks inside the function?
  // Let's do it manually since we are using service role anyway.
  
  console.log("Transferring matches from", oldRajaId, "to", newRaja.id);
  
  await supabase.from('matches').update({ player1_id: newRaja.id }).eq('player1_id', oldRajaId);
  await supabase.from('matches').update({ player2_id: newRaja.id }).eq('player2_id', oldRajaId);
  await supabase.from('matches').update({ team1_partner_id: newRaja.id }).eq('team1_partner_id', oldRajaId);
  await supabase.from('matches').update({ team2_partner_id: newRaja.id }).eq('team2_partner_id', oldRajaId);
  await supabase.from('matches').update({ winner_id: newRaja.id }).eq('winner_id', oldRajaId);
  await supabase.from('matches').update({ submitted_by: newRaja.id }).eq('submitted_by', oldRajaId);
  
  // Delete the old guest profile
  const delRes = await supabase.from('players').delete().eq('id', oldRajaId);
  console.log("Deleted old Raja profile:", delRes.error || "Success");
}

run();
