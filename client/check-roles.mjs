import fs from 'fs';
import path from 'path';

// Read .env.local
const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
const envLines = envContent.split('\n');
const supabaseUrl = envLines.find(l => l.startsWith('VITE_SUPABASE_URL='))?.split('=')[1].trim();
const supabaseKey = envLines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))?.split('=')[1].trim();

async function checkRoles() {
  // fetch roles from Supabase REST API
  const res = await fetch(`${supabaseUrl}/rest/v1/site_data?key=eq.roles&select=*`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log("Roles data:", JSON.stringify(data, null, 2));

  // fetch JAHA player
  const pRes = await fetch(`${supabaseUrl}/rest/v1/players?select=id,full_name,user_id,iisc_email`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  const players = await pRes.json();
  const jaha = players.filter(p => p.full_name && p.full_name.toLowerCase().includes('jaha'));
  console.log("JAHA players:", JSON.stringify(jaha, null, 2));
}

checkRoles().catch(console.error);
