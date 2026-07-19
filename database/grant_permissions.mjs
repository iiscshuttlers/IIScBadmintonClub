import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function grantPermissions() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  console.log("Granting usage on public schema...");
  await client.query(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
  
  console.log("Granting all on tables...");
  await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`);
  
  console.log("Granting all on sequences...");
  await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;`);
  
  console.log("Granting all on routines...");
  await client.query(`GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;`);
  
  console.log("Setting default privileges for future tables...");
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;`);

  console.log("Reloading PostgREST schema cache...");
  await client.query("NOTIFY pgrst, 'reload schema';");

  await client.end();
  console.log("Permissions granted successfully!");
}

grantPermissions().catch(console.error);
