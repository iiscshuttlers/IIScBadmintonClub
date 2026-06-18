import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "client/.env" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokens() {
  const { data, error } = await supabase
    .from("user_push_tokens")
    .select("*");
  if (error) console.error("Error:", error);
  console.log("Tokens:", JSON.stringify(data, null, 2));
}
checkTokens();
