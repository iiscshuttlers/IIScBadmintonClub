import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokens() {
  const { data: users, error: err1 } = await supabase.from('players').select('id, email, full_name').ilike('email', '%janmejay%');
  console.log('User:', users);
  if (users && users.length > 0) {
    const { data: tokens, error: err2 } = await supabase.from('user_push_tokens').select('*').eq('user_id', users[0].id);
    console.log('Tokens:', tokens);
  }
}

checkTokens();
