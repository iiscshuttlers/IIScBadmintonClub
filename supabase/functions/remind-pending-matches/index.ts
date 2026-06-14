import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendFcmNotification(fcmToken: string, title: string, body: string) {
  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${FCM_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: fcmToken,
      notification: { title, body, sound: "default" },
      android: {
        notification: {
          channel_id: "match_alerts_smash",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    }),
  });
}

serve(async () => {
  try {
    // Find pending matches older than 24 hours that haven't been confirmed
    const { data: pendingMatches, error } = await supabase
      .from("matches")
      .select(
        `id, player1_id, player2_id, submitted_by, created_at,
         player1:players!player1_id(full_name, fcm_token),
         player2:players!player2_id(full_name, fcm_token)`
      )
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    let sent = 0;
    for (const match of pendingMatches ?? []) {
      // The confirmer is the player who is NOT the submitter
      const confirmerIsP1 = match.submitted_by !== match.player1_id;
      const confirmer = confirmerIsP1 ? match.player1 : match.player2;
      const submitter = confirmerIsP1 ? match.player2 : match.player1;

      if (confirmer?.fcm_token) {
        await sendFcmNotification(
          confirmer.fcm_token,
          "⏳ Pending Match Reminder",
          `${submitter?.full_name ?? "Your opponent"} is waiting for you to confirm a match. Tap to review it.`
        );
        sent++;
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
