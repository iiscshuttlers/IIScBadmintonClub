import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function patch() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  console.log("Patching 'players' table to add 'role'...");
  try {
    await client.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'player';`);
  } catch (e) { console.error(e.message); }

  console.log("Patching 'tournaments' table...");
  try {
    await client.query(`
      ALTER TABLE tournaments
        ADD COLUMN IF NOT EXISTS tournament_type TEXT NOT NULL DEFAULT 'open',
        ADD COLUMN IF NOT EXISTS bracket_format TEXT NOT NULL DEFAULT 'single_elim',
        ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
        ADD COLUMN IF NOT EXISTS venue TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS eligibility TEXT,
        ADD COLUMN IF NOT EXISTS form_url TEXT,
        ADD COLUMN IF NOT EXISTS form_status TEXT DEFAULT 'disabled',
        ADD COLUMN IF NOT EXISTS form_close_date DATE,
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES players(id);
    `);
    console.log("Tournaments table patched successfully!");
  } catch (e) {
    console.error("Patch failed:", e.message);
    await client.query('ROLLBACK');
  }

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
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

  console.log("Reloading PostgREST schema cache...");
  await client.query("NOTIFY pgrst, 'reload schema';");

  await client.end();
  console.log("Done!");
}

patch().catch(console.error);
