import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get token stats
    const { data: tokens, error } = await supabase
      .from("user_push_tokens")
      .select("platform, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    // Group by platform
    const byPlatform: Record<string, any[]> = {};
    tokens?.forEach((t: any) => {
      if (!byPlatform[t.platform]) byPlatform[t.platform] = [];
      byPlatform[t.platform].push(t);
    });

    // Get Firebase project from env. A malformed secret must NOT abort the
    // report — that is precisely the failure this function exists to surface.
    const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    let serviceAccount: { project_id?: string; client_email?: string; private_key?: string } | null = null;
    let serviceAccountError: string | null = null;

    if (!serviceAccountStr) {
      serviceAccountError = "FIREBASE_SERVICE_ACCOUNT is not set";
    } else {
      try {
        serviceAccount = JSON.parse(serviceAccountStr);
      } catch (e: any) {
        serviceAccountError =
          `FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${e.message}. ` +
          `Length=${serviceAccountStr.length}, starts with: ${JSON.stringify(serviceAccountStr.slice(0, 40))}`;
      }
    }

    if (serviceAccount && typeof serviceAccount.private_key === "string") {
      // A private_key pasted through a shell often loses its real newlines.
      if (!serviceAccount.private_key.includes("\n")) {
        serviceAccountError =
          "private_key contains no real newlines (literal \\n was not unescaped) — FCM auth will fail";
      }
    }

    return new Response(JSON.stringify({
      service_account_ok: serviceAccountError === null,
      service_account_error: serviceAccountError,
      total_tokens: tokens?.length || 0,
      by_platform: Object.keys(byPlatform).reduce((acc: Record<string, any>, platform: string) => {
        const platformTokens = byPlatform[platform];
        acc[platform] = {
          count: platformTokens.length,
          oldest: platformTokens[platformTokens.length - 1]?.created_at,
          newest: platformTokens[0]?.updated_at,
        };
        return acc;
      }, {}),
      firebase_project: serviceAccount?.project_id || "NOT CONFIGURED",
      sample_tokens: tokens?.slice(0, 3).map((t: any) => ({
        platform: t.platform,
        created: t.created_at,
        updated: t.updated_at
      }))
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
