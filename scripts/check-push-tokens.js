import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: "client/.env" });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

async function checkPushTokens() {
  // All tokens in the table
  const { data: tokens, error } = await supabase
    .from("user_push_tokens")
    .select("user_id, platform, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log(`Total tokens: ${tokens.length}`);
  console.log("By platform:", tokens.reduce((acc, t) => {
    acc[t.platform] = (acc[t.platform] || 0) + 1;
    return acc;
  }, {}));
  console.log("\nRecent tokens (last 10):");
  tokens.slice(0, 10).forEach((t) => {
    console.log(`  user_id=${t.user_id} platform=${t.platform} created=${t.created_at}`);
  });
}

checkPushTokens();
