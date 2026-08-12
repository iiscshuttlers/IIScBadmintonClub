const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envStr = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envStr.split('\n').forEach(line => {
  if (line.includes('=')) {
    const parts = line.split('=');
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"](.*)['"]$/, '$1');
    envVars[k] = v;
  }
});

const sb = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY);

sb.from('players').select('id, full_name, elo_rating, win_loss_record, stats').limit(5).then(res => {
  console.log(JSON.stringify(res, null, 2));
});
