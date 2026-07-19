import pg from 'pg';
const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function check() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='players' AND column_name='id';`);
  console.log("Players ID type:", res.rows[0].data_type);

  await client.end();
}

check().catch(console.error);
