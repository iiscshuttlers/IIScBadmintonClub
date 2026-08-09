import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

async function getFirebaseAccessToken(): Promise<string> {
  const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
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
    throw new Error(`Failed to get Google OAuth token: ${data.error_description}`);
  }

  return data.access_token;
}

async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string
) {
  await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { type: "match_confirmation", action: "view_match" },
        android: {
          priority: "high",
          notification: { channel_id: "notify_point" }
        },
        webpush: { headers: { Urgency: "high" } },
        apns: { headers: { "apns-priority": "10" } },
      },
    }),
  });
}

serve(async () => {
  try {
    const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getFirebaseAccessToken();

    // Find pending matches older than 24 hours that haven't been confirmed
    const { data: pendingMatches, error } = await supabase
      .from("matches")
      .select(
        `id, player1_id, player2_id, submitted_by, created_at,
         player1:players!player1_id(full_name),
         player2:players!player2_id(full_name)`
      )
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    let sent = 0;
    for (const match of pendingMatches ?? []) {
      // The confirmer is the player who is NOT the submitter
      const confirmerIsP1 = match.submitted_by !== match.player1_id;
      const confirmerId = confirmerIsP1 ? match.player1_id : match.player2_id;
      const confirmer = confirmerIsP1 ? match.player1 : match.player2;
      const submitter = confirmerIsP1 ? match.player2 : match.player1;

      const notifTitle = "⏳ Pending Match Reminder";
      const notifBody = `${submitter?.full_name ?? "Your opponent"} is waiting for you to confirm a match. Tap to review it.`;

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: confirmerId,
        title: notifTitle,
        message: notifBody,
        type: "match_confirmation",
        link: "/my-matches#pending"
      });

      // Get confirmer's push tokens from user_push_tokens table
      const { data: tokens } = await supabase
        .from("user_push_tokens")
        .select("token")
        .eq("user_id", confirmerId);

      if (tokens && tokens.length > 0) {
        const uniqueTokens = Array.from(new Set(tokens.map((t: any) => t.token)));
        for (const token of uniqueTokens) {
          await sendFcmNotification(
            token as string,
            notifTitle,
            notifBody,
            serviceAccount.project_id,
            accessToken
          );
          sent++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("remind-pending-matches error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
