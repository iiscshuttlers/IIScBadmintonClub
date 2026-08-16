import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'client/.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Wait, I can't insert unless I have SERVICE_ROLE_KEY or use an Admin user.
// Let me use the edge function trick or login as admin?
// I don't have the SERVICE_ROLE_KEY here.
