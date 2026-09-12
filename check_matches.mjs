import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return acc;
  const idx = trimmed.indexOf('=');
  if (idx === -1) return acc;
  acc[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', URL);

// Query all matches - look at scheduled_at distribution
const res = await fetch(`${URL}/rest/v1/matches?select=id,scheduled_at,status,tournament_id&order=scheduled_at.asc`, {
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
});

const data = await res.json();
console.log('\nHTTP status:', res.status);

if (!Array.isArray(data)) {
  console.log('Response:', JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log('Total matches in DB:', data.length);

// Group by month
const byMonth = {};
for (const m of data) {
  const key = m.scheduled_at ? m.scheduled_at.slice(0, 7) : 'null';
  byMonth[key] = (byMonth[key] || 0) + 1;
}
console.log('\nMatches by month:');
for (const [k, v] of Object.entries(byMonth).sort()) console.log(`  ${k}: ${v}`);

// Show August 2026 matches in detail
const aug = data.filter(m => m.scheduled_at && m.scheduled_at.startsWith('2026-08'));
console.log(`\nAugust 2026 matches (${aug.length}):`);
for (const m of aug) {
  console.log(`  id=${m.id.slice(0,8)} status=${m.status} scheduled_at=${m.scheduled_at} tournament=${m.tournament_id?.slice(0,8)}`);
}
