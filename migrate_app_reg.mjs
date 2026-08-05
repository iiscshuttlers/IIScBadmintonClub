import pg from 'pg';
const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString: newDbUrl });
  try {
    await client.connect();
    await client.query("ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS require_app_registration BOOLEAN NOT NULL DEFAULT FALSE;");
    console.log("Migration applied successfully.");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
