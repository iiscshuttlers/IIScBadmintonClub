import pg from 'pg';
const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function reload() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  console.log("Reloading PostgREST schema cache...");
  await client.query("NOTIFY pgrst, 'reload schema';");

  console.log("Schema cache reloaded!");
  await client.end();
}

reload().catch(console.error);
