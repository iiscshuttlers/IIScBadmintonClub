import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1. Ping: can we read from core tables?
  const tables = ["players", "matches", "find_lost_posts"];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) {
      errors.push(`${table}: ${error.message}`);
      results[table] = { ok: false, error: error.message };
    } else {
      results[table] = { ok: true, row_count: count };
    }
  }

  // 2. Check site_data key exists (club config is readable)
  const { data: siteData, error: siteErr } = await supabase
    .from("site_data")
    .select("key")
    .limit(5);
  results["site_data"] = siteErr
    ? { ok: false, error: siteErr.message }
    : { ok: true, keys: siteData?.map((r) => r.key) };

  // 3. Write a canary row to admin_logs and read it back
  const canaryId = `backup_verify_${Date.now()}`;
  const canaryDetail = { canary_id: canaryId };
  
  const { error: insertErr } = await supabase.from("admin_logs").insert({
    admin_email: "system@verify",
    action: "backup_health_check",
    details: canaryDetail,
  });

  if (insertErr) {
    errors.push(`canary_write: ${insertErr.message}`);
    results["canary_write"] = { ok: false, error: insertErr.message };
  } else {
    // We can't easily .eq() on a JSON column without ->> operators in standard PostgREST easily,
    // but PostgREST supports passing JSON directly to eq if it exactly matches.
    // However, to be perfectly safe, we'll use a contains filter.
    const { data: canary, error: readErr } = await supabase
      .from("admin_logs")
      .select("id, details")
      .contains("details", canaryDetail)
      .limit(1)
      .single();
      
    results["canary_read"] = readErr
      ? { ok: false, error: readErr.message }
      : { ok: true, id: canary?.id };
  }

  const allOk = errors.length === 0;
  const payload = {
    ok: allOk,
    checked_at: new Date().toISOString(),
    results,
    errors: errors.length > 0 ? errors : undefined,
  };

  // If any check failed, also log it
  if (!allOk) {
    await supabase.from("admin_logs").insert({
      admin_email: "system@verify",
      action: "backup_health_check_FAILED",
      details: errors.join("; "),
    });
  }

  return new Response(JSON.stringify(payload), {
    status: allOk ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
