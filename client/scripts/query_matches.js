import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
sb.from('matches').select('id, scheduled_at, status').then(res => {
  const data = res.data || [];
  console.log('Total matches:', data.length);
  const augMatches = data.filter(m => m.scheduled_at && m.scheduled_at.includes('2026-08'));
  console.log('August 2026 matches:');
  console.log(augMatches);
});
