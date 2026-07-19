import pg from 'pg';
const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function verify() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("Tables in public schema:");
  console.log(res.rows.map(r => r.table_name).join(", "));

  try {
    const matchesRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'matches'`);
    console.log("Matches columns:", matchesRes.rows.map(r => r.column_name).join(", "));
  } catch (e) {
    console.log("Matches table query failed:", e.message);
  }

  await client.end();
}

verify().catch(console.error);
