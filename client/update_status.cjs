const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const id = '62c5341c-df12-4511-9253-a9a0e9546667';
  console.log("Updating to closing_soon...");
  const { data, error } = await supabase.from('tournaments').update({ form_status: 'closing_soon' }).eq('id', id).select();
  console.log("Result:", data);
  console.log("Error:", error);
})();
