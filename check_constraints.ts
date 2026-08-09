import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data, error } = await supabase.rpc("execute_sql", { sql: "SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE contype = 'u' AND n.nspname = 'public';" });
  if (error) {
    console.error("RPC failed, trying raw query via players insert", error.message);
  } else {
    console.log("Constraints:", data);
  }
}

check();
