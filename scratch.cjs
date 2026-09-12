const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://postgres.hzyxikdngfuzjlsgqqas:sb_publishable_dWERfMPzKYO5Cxyj35vsUg_xnjwzdNx@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' });
client.connect()
  .then(() => client.query("SELECT full_name, elo_rating, singles_elo, singles_record, doubles_elo, doubles_record, mixed_elo, mixed_record FROM players WHERE full_name ILIKE '%Piyush%' OR full_name ILIKE '%Abhisek K%'"))
  .then(res => console.log(JSON.stringify(res.rows, null, 2)))
  .catch(err => console.error(err))
  .finally(() => client.end());
