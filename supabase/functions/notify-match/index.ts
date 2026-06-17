import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
// JWT generation for Firebase
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getFirebaseAccessToken(): Promise<string> {
  const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountStr) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  }

  const serviceAccount = JSON.parse(serviceAccountStr);
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");

  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(
      `Failed to get Google OAuth token: ${data.error_description}`,
    );
  }

  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch (e) {
      console.error("[notify-match] Failed to read request body:", e);
      return new Response(
        JSON.stringify({ error: "Could not read request body" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Strip BOM if present (PowerShell / some clients add this)
    const cleanBody = rawBody.replace(/^\uFEFF/, "").trim();
    console.log(
      "[notify-match] Raw body (first 300 chars):",
      cleanBody.slice(0, 300),
    );

    let outerPayload: any;
    try {
      outerPayload = JSON.parse(cleanBody);
    } catch (e) {
      console.error(
        "[notify-match] JSON parse error:",
        e,
        "Body was:",
        cleanBody.slice(0, 200),
      );
      return new Response(
        JSON.stringify({ error: `JSON parse error: ${e.message}` }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Supabase Edge Function webhooks wrap the payload in { "type": "...", "record": {...} }
    // But when called as "Supabase Edge Functions" type they may send the record directly
    // Handle both formats:
    let payload = outerPayload;
    // If the payload itself is the record (no type/table fields), wrap it
    if (!payload.type && !payload.table && payload.id) {
      payload = { type: "INSERT", table: "matches", record: payload };
    }

    console.log(
      "[notify-match] Parsed payload type:",
      payload.type,
      "table:",
      payload.table,
    );

    // 1. Validate payload comes from our webhook
    if (payload.type !== "INSERT" || payload.table !== "matches") {
      return new Response(
        JSON.stringify({
          error: `Invalid webhook payload: type=${payload.type} table=${payload.table}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    const matchRecord = payload.record;

    const isFriendly = !!matchRecord.is_friendly;

    // For tournament matches, only notify on pending (challenge sent).
    // Friendly matches are logged directly as confirmed — notify immediately.
    if (!isFriendly && matchRecord.status !== "pending") {
      console.log(
        "[notify-match] Tournament match not pending, skipping. Status:",
        matchRecord.status,
      );
      return new Response(
        JSON.stringify({ message: "Not a pending tournament match, skipped" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const player1Id = matchRecord.player1_id;
    const player2Id = matchRecord.player2_id;
    const partnerIds = [
      matchRecord.team1_partner_id,
      matchRecord.team2_partner_id,
    ].filter(Boolean);

    // All player IDs involved in the match
    const matchPlayerIds = [player1Id, player2Id, ...partnerIds].filter(Boolean);

    console.log(`[notify-match] Match players: ${matchPlayerIds.join(", ")} friendly=${isFriendly}`);

    // 2. Fetch all players involved to get names + buddies + followers
    const { data: playerRows } = await supabaseClient
      .from("players")
      .select("id, full_name, buddies, following")
      .in("id", matchPlayerIds);

    const playerMap = new Map((playerRows ?? []).map((p: any) => [p.id, p]));
    const challenger = playerMap.get(player1Id);
    const challengerName = challenger?.full_name || "Someone";

    // 3. Collect recipient user IDs
    //    - For tournament matches: just player2 + partners (player1 is the challenger)
    //    - For friendly matches: both players + partners + their buddies + their followers
    let recipientIds: Set<string>;

    if (!isFriendly) {
      // Tournament challenge: notify the challenged player(s) only
      recipientIds = new Set([player2Id, ...partnerIds].filter((id) => id && id !== player1Id));
    } else {
      // Friendly: notify both players/partners + buddies + followers of all involved players
      recipientIds = new Set<string>();

      for (const playerId of matchPlayerIds) {
        const player = playerMap.get(playerId);
        if (!player) continue;

        // Buddies (stored as array of player IDs)
        if (Array.isArray(player.buddies)) {
          for (const buddyId of player.buddies) recipientIds.add(buddyId);
        }
        // Followers (people who follow this player — stored as array on the follower's row,
        // so we need to query who has this player in their following list)
      }

      // Fetch players who follow any of the match participants
      const { data: followers } = await supabaseClient
        .from("players")
        .select("id")
        .overlaps("following", matchPlayerIds);

      if (followers) {
        for (const f of followers) recipientIds.add(f.id);
      }

      // Also notify both players themselves (except player1 who logged it)
      for (const id of matchPlayerIds) recipientIds.add(id);
      // Don't notify the logger (player1) about their own match
      recipientIds.delete(player1Id);
    }

    console.log(`[notify-match] Recipients: ${recipientIds.size}`);

    // 4. Fetch push tokens for all recipients
    const recipientArr = [...recipientIds];
    let allTokensToSend: { token: string }[] = [];

    if (recipientArr.length > 0) {
      const { data: tokenRows } = await supabaseClient
        .from("user_push_tokens")
        .select("token")
        .in("user_id", recipientArr);
      if (tokenRows) allTokensToSend = tokenRows as { token: string }[];
    }

    console.log(`[notify-match] Found ${allTokensToSend.length} tokens`);

    if (allTokensToSend.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push tokens found for any recipient" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Deduplicate tokens
    const uniqueTokens = [
      ...new Map(allTokensToSend.map((t) => [t.token, t])).values(),
    ];

    const fcmAccessToken = await getFirebaseAccessToken();
    const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;
    const projectId = JSON.parse(serviceAccountStr).project_id;

    const notificationTitle = isFriendly
      ? "🏸 Friendly Match Logged!"
      : "🏸 New Tournament Match!";
    const notificationBody = isFriendly
      ? `${challengerName} just played a friendly match. Tap to view.`
      : `${challengerName} logged a tournament match against you. Open the app to confirm.`;

    console.log(
      `[notify-match] Sending ${uniqueTokens.length} FCM notifications`,
    );

    const results = await Promise.allSettled(
      uniqueTokens.map(async (t) => {
        const fcmPayload = {
          message: {
            token: t.token,
            notification: {
              title: notificationTitle,
              body: notificationBody,
            },
            android: {
              priority: "high",
              notification: {
                sound: "smash",
                channelId: isFriendly ? "notify_friendly" : "notify_tournament",
              },
            },
            webpush: { headers: { Urgency: "high" } },
            apns: { headers: { "apns-priority": "10" } },
            data: {
              matchId: matchRecord.id,
              action: "view_match",
            },
          },
        };

        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${fcmAccessToken}`,
            },
            body: JSON.stringify(fcmPayload),
          },
        );

        const resBody = await res.text();

        if (!res.ok) {
          console.error(
            `[notify-match] FCM error for token ${t.token.slice(0, 20)}...:`,
            resBody,
          );

          // If token is invalid/expired, remove it from the DB
          if (res.status === 404 || res.status === 400) {
            console.log(
              `[notify-match] Removing stale token ${t.token.slice(0, 20)}...`,
            );
            await supabaseClient
              .from("user_push_tokens")
              .delete()
              .eq("token", t.token);
          }

          throw new Error(`FCM ${res.status}: ${resBody}`);
        }

        return resBody;
      }),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`[notify-match] Done. Sent: ${succeeded}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({
        message: `Sent ${succeeded}/${uniqueTokens.length} notifications`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("[notify-match] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
