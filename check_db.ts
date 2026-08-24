import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
  const { data: d1, error: e1 } = await supabase.from("matches").select("updated_at").limit(1);
  console.log("matches updated_at:", d1, e1);
  const { data: d2, error: e2 } = await supabase.from("tournament_matches").select("updated_at").limit(1);
  console.log("tournament_matches updated_at:", d2, e2);
}

checkRpc();
