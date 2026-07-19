import pg from 'pg';
const { Client } = pg;
const newDbUrl = "postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres";

async function patch() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  console.log("Patching 'matches' table...");
  try {
    await client.query(`
      ALTER TABLE matches
        ADD COLUMN IF NOT EXISTS team1_partner_id TEXT REFERENCES players(id),
        ADD COLUMN IF NOT EXISTS team2_partner_id TEXT REFERENCES players(id),
        ADD COLUMN IF NOT EXISTS submitted_by TEXT REFERENCES players(id),
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed',
        ADD COLUMN IF NOT EXISTS is_friendly BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS elo_change_p1 INTEGER,
        ADD COLUMN IF NOT EXISTS elo_change_p2 INTEGER,
        ADD COLUMN IF NOT EXISTS elo_change_p3 INTEGER,
        ADD COLUMN IF NOT EXISTS elo_change_p4 INTEGER,
        ADD COLUMN IF NOT EXISTS sets_history JSONB,
        ADD COLUMN IF NOT EXISTS confirmed_by TEXT[],
        ADD COLUMN IF NOT EXISTS kudos_count INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS kudos_users TEXT[],
        ADD COLUMN IF NOT EXISTS nudge_sent_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log("Matches table patched successfully!");

    console.log("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Schema cache reloaded!");
  } catch (e) {
    console.error("Patch failed:", e.message);
  }

  await client.end();
}

patch().catch(console.error);
