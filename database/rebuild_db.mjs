import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function rebuild() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  console.log("Dropping and recreating public schema...");
  await client.query("DROP SCHEMA public CASCADE;");
  await client.query("CREATE SCHEMA public;");
  await client.query("GRANT ALL ON SCHEMA public TO postgres;");
  await client.query("GRANT ALL ON SCHEMA public TO public;");

  const archiveDir = path.join(__dirname, 'archive');
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  const skipFiles = [
    'supabase_seed.sql',
    'uuid_consolidation_migration.sql'
  ];

  // 1. Run supabase_schema.sql FIRST
  try {
    console.log(`Running supabase_schema.sql...`);
    const sql = fs.readFileSync(path.join(archiveDir, 'supabase_schema.sql'), 'utf8');
    await client.query(sql);
    console.log(`  Success: supabase_schema.sql`);
  } catch (e) {
    console.error(`  Error in supabase_schema.sql:`, e.message);
    try { await client.query('ROLLBACK'); } catch(e2){}
  }

  // 2. Run all other archive files
  const allArchive = fs.readdirSync(archiveDir).filter(f => f.endsWith('.sql') && f !== 'supabase_schema.sql' && !skipFiles.includes(f)).sort();
  for (const file of allArchive) {
    try {
      console.log(`Running ${file}...`);
      const sql = fs.readFileSync(path.join(archiveDir, file), 'utf8');
      await client.query(sql);
      console.log(`  Success: ${file}`);
    } catch (e) {
      console.error(`  Error in ${file}:`, e.message);
      try { await client.query('ROLLBACK'); } catch(e2){}
    }
  }

  const allMigrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of allMigrations) {
    try {
      console.log(`Running migration ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`  Success: ${file}`);
    } catch (e) {
      console.error(`  Error in ${file}:`, e.message);
      try { await client.query('ROLLBACK'); } catch(e2){}
    }
  }

  console.log("Reloading schema cache...");
  await client.query("NOTIFY pgrst, 'reload schema';");

  await client.end();
  console.log("Database rebuilt successfully!");
}

rebuild().catch(console.error);
