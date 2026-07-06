import pg from 'pg';
const { Client } = pg;

const oldDbUrl = "postgresql://postgres.gewnvlanitzlukaiiznu:OldDB_Password_123!@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function transferData() {
  const oldClient = new Client({ connectionString: oldDbUrl });
  const newClient = new Client({ connectionString: newDbUrl });

  try { await oldClient.connect(); } catch (e) { console.error(e); process.exit(1); }
  try { await newClient.connect(); } catch (e) { console.error(e); process.exit(1); }

  const tables = ["tournaments", "tournament_matches", "site_data"]; // Skipping admin_history due to auth.users fkey

  for (const table of tables) {
    try {
      console.log(`Transferring ${table}...`);
      const { rows } = await oldClient.query(`SELECT * FROM public.${table}`);
      console.log(`Found ${rows.length} rows in ${table}`);

      if (rows.length === 0) continue;

      // Get columns that exist in NEW DB
      const newColsQuery = await newClient.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}' AND table_schema = 'public'`);
      const validColumns = new Set(newColsQuery.rows.map(r => r.column_name));

      const oldColumns = Object.keys(rows[0]).filter(c => validColumns.has(c));
      
      for (const row of rows) {
        const values = oldColumns.map(c => {
          let val = row[c];
          if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        const placeholders = oldColumns.map((_, i) => `$${i + 1}`).join(", ");
        const query = `INSERT INTO public.${table} (${oldColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        
        try {
          await newClient.query(query, values);
        } catch (insertErr) {
          if (!insertErr.message.includes('violates foreign key constraint')) {
             console.error(`Row insert failed:`, insertErr.message);
          }
        }
      }
      console.log(`Successfully transferred ${table}`);
    } catch (err) {
      console.error(`Error transferring ${table}:`, err.message);
    }
  }

  await oldClient.end();
  await newClient.end();
  console.log("Transfer complete!");
}

transferData();
