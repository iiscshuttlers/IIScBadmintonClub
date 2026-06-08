const supabaseUrl = 'https://gewnvlanitzlukaiiznu.supabase.co';
const supabaseKey = 'sb_publishable_dWERfMPzKYO5Cxyj35vsUg_xnjwzdNx';

async function checkRoles() {
  const res = await fetch(`${supabaseUrl}/rest/v1/site_data?key=eq.roles&select=*`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  console.log("Roles data:", JSON.stringify(data, null, 2));

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
