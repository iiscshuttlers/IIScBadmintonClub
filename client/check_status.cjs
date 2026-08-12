const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const { data } = await supabase
    .from('tournaments')
    .select('id, name, status, form_status, form_url, form_close_date')
    .neq('status', 'deleted')
    .neq('status', 'draft')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(3);
  console.log(JSON.stringify(data, null, 2));
})();
