import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function restore() {
  const client = new Client({ connectionString: newDbUrl });
  try {
    await client.connect();
    console.log("Connected to new database.");
  } catch (e) {
    console.error("Connection failed:", e.message);
    process.exit(1);
  }

  const archiveDir = path.join(__dirname, 'archive');
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

  // 1. Run base schema first
  const baseFiles = [
    'supabase_schema.sql',
    'supabase_auth.sql'
  ];

  for (const file of baseFiles) {
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

  // 2. Run all other archive files
  const allArchive = fs.readdirSync(archiveDir).filter(f => f.endsWith('.sql') && !baseFiles.includes(f)).sort();
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

  // 3. Run all migrations
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

  await client.end();
  console.log("Restore complete!");
}

restore().catch(console.error);
