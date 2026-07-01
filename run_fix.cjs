const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/20260629193700_fix_admin.sql', 'utf8');
  try {
    await client.query(sql);
    console.log("Fixed match edit functions!");
  } catch(e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
run();
