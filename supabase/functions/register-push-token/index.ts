import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function: register-push-token
 *
 * Accepts a push token + platform and saves it to user_push_tokens using
 * SERVICE_ROLE_KEY so RLS never blocks it.
 *
 * The caller passes their own JWT (Authorization header) so we can look up
 * the player by auth.uid(), email, OR player_id — whichever matches.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Two clients:
    // 1. userClient: scoped to the caller's JWT — used to get auth.uid()
    // 2. adminClient: service role — used to bypass RLS on upsert
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Get calling user's auth UID
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
      );
    }

    const authUid = user.id;
    const userEmail = user.email;

    // 2. Parse body
    const body = await req.json();
    const { token, platform } = body;
    if (!token || !platform) {
      return new Response(
        JSON.stringify({ error: "Missing token or platform" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    // 3. Resolve player_id: try auth UID first, then fallback to email match
    let playerId: string | null = null;

    // Try direct id match (standard case: player row id === auth.uid())
    const { data: playerById } = await adminClient
      .from("players")
      .select("id")
      .eq("id", authUid)
      .maybeSingle();

    if (playerById) {
      playerId = playerById.id;
    } else if (userEmail) {
      // Fallback: player added manually — match by email
      const { data: playerByEmail } = await adminClient
        .from("players")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();

      if (playerByEmail) {
        playerId = playerByEmail.id;
        console.log(`[register-push-token] Matched player by email fallback. auth_uid=${authUid} player_id=${playerId}`);
      }
    }

    if (!playerId) {
      console.warn(`[register-push-token] No player record found for auth_uid=${authUid} email=${userEmail}`);
      // Still save with auth UID — at worst the notification won't find the player but token is recorded
      playerId = authUid;
    }

    // 4. Upsert using service role (bypasses RLS)
    const { error: upsertErr } = await adminClient
      .from("user_push_tokens")
      .upsert(
        {
          user_id: playerId,
          token,
          platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );

    if (upsertErr) {
      console.error("[register-push-token] Upsert failed:", upsertErr);
      return new Response(
        JSON.stringify({ error: upsertErr.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
      );
    }

    console.log(`[register-push-token] Token saved. player_id=${playerId} platform=${platform}`);
    return new Response(
      JSON.stringify({ success: true, player_id: playerId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[register-push-token] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
