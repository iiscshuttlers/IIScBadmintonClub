import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "client/.env" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRoles() {
  const { data } = await supabase
    .from("site_data")
    .select("*")
    .eq("key", "roles")
    .single();
  console.log("Roles:", JSON.stringify(data, null, 2));

}
checkRoles();
