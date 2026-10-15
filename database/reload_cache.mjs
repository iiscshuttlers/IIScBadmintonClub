import pg from 'pg';
const { Client } = pg;
const newDbUrl = process.env.DATABASE_URL;

async function reload() {
  const client = new Client({ connectionString: newDbUrl });
  await client.connect();

  console.log("Reloading PostgREST schema cache...");
  await client.query("NOTIFY pgrst, 'reload schema';");

  console.log("Schema cache reloaded!");
  await client.end();
}

reload().catch(console.error);
