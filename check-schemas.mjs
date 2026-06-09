const supabaseUrl = "https://gewnvlanitzlukaiiznu.supabase.co";
const supabaseKey = "sb_publishable_dWERfMPzKYO5Cxyj35vsUg_xnjwzdNx";

async function describeTable(table) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const data = await res.json();
  if (data && data.length > 0) {
    console.log(`Schema for ${table}:`, Object.keys(data[0]));
  } else {
    console.log(`No data in ${table} to infer schema.`);
  }
}

async function run() {
  await describeTable("matches");
  await describeTable("players");
}

run().catch(console.error);
