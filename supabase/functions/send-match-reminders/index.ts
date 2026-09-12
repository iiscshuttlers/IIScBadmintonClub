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
  if (!FIREBASE_SERVICE_ACCOUNT) return "";
  try {
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
      console.error("Firebase auth error", data);
      return "";
    }
    return data.access_token;
  } catch (e) {
    console.error("Firebase Auth Parsing Error", e);
    return "";
  }
}

async function sendFcmNotification(
  token: string,
  title: string,
  body: string,
  projectId: string,
  accessToken: string
) {
  if (!accessToken) return;
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
        data: { type: "match_reminder", action: "view_match" },
        android: {
          priority: "high",
          notification: { channel_id: "notify_point" }
        },
        webpush: {
          headers: { Urgency: "high" },
          notification: {
            icon: "icon-192.png",
            badge: "icon-192.png",
          },
        },
        apns: { headers: { "apns-priority": "10" } },
      },
    }),
  });
}

serve(async () => {
  try {
    const accessToken = await getFirebaseAccessToken();
    let serviceAccount: ServiceAccount | null = null;
    if (FIREBASE_SERVICE_ACCOUNT) {
      try { serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT); } catch(e){}
    }

    // Get all upcoming scheduled/pending matches with scheduled_at in the future (within next 24 hours to limit data)
    const { data: upcomingMatches, error: matchesError } = await supabase
      .from("matches")
      .select("id, scheduled_at, player1_id, player2_id, team1_partner_id, team2_partner_id, category, team1_label, team2_label")
      .in("status", ["scheduled", "pending"])
      .not("scheduled_at", "is", null)
      .gt("scheduled_at", new Date().toISOString())
      .lt("scheduled_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    if (matchesError) throw matchesError;

    let sentCount = 0;

    for (const match of (upcomingMatches || [])) {
      const matchTime = new Date(match.scheduled_at).getTime();
      const now = Date.now();
      
      const players = [match.player1_id, match.player2_id, match.team1_partner_id, match.team2_partner_id].filter(Boolean);

      for (const playerId of players) {
        // Fetch per-match override
        let remindMins: number | null = null;

        const { data: matchReminders } = await supabase
          .from("match_reminders")
          .select("remind_before_mins, sent_at")
          .eq("match_id", match.id)
          .eq("user_id", playerId)
          .maybeSingle();

        if (matchReminders) {
          if (matchReminders.sent_at) continue; // Already sent
          remindMins = matchReminders.remind_before_mins;
        } else {
          // Fetch global default
          const { data: profile } = await supabase
            .from("players")
            .select("default_match_reminder_mins")
            .eq("id", playerId)
            .maybeSingle();
            
          if (profile && profile.default_match_reminder_mins) {
            remindMins = profile.default_match_reminder_mins;
            
            // Check if we already logged this global reminder as sent in match_reminders
            const { data: existingLog } = await supabase
              .from("match_reminders")
              .select("sent_at")
              .eq("match_id", match.id)
              .eq("user_id", playerId)
              .maybeSingle();
              
            if (existingLog && existingLog.sent_at) {
               continue;
            }
          }
        }

        if (remindMins !== null) {
          const triggerTime = matchTime - (remindMins * 60 * 1000);
          
          // If the trigger time is in the past (or within the last 15 minutes), send it!
          if (now >= triggerTime && (now - triggerTime) < 15 * 60 * 1000) {
            
            // Format match time for user explicitly in IST to avoid confusion
            const dateObj = new Date(match.scheduled_at);
            const timeStr = dateObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
            
            const title = "🏸 Upcoming Match Reminder";
            const body = `You have a match scheduled at ${timeStr} IST. Get ready!`;

            // Insert In-App Notification
            await supabase.from("notifications").insert({
              user_id: playerId,
              title: title,
              message: body,
              type: "match_reminder",
              link: "/my-matches"
            });

            // Send Push
            if (accessToken && serviceAccount) {
              const { data: tokens } = await supabase
                .from("user_push_tokens")
                .select("token")
                .eq("user_id", playerId);

              if (tokens && tokens.length > 0) {
                const uniqueTokens = Array.from(new Set(tokens.map((t: any) => t.token)));
                for (const token of uniqueTokens) {
                  await sendFcmNotification(token as string, title, body, serviceAccount.project_id, accessToken);
                }
              }
            }

            // Send Email Notification by triggering existing match-notifier or inserting into queue
            // (Assuming existing logic or email provider setup is handled by another process, 
            // but we'll log it for now as SMTP usually goes through pg_net or another webhook)
            console.log(`Sending email reminder to user ${playerId} about match at ${timeStr} IST`);

            // Mark as sent
            await supabase.from("match_reminders").upsert({
              match_id: match.id,
              user_id: playerId,
              remind_before_mins: remindMins,
              sent_at: new Date().toISOString()
            }, { onConflict: "match_id,user_id" });

            sentCount++;
          }
        }
      }
      
      // Now process "Friends" match notifications from user_match_notifications table
      const { data: friendAlerts } = await supabase
        .from("user_match_notifications")
        .select("user_id, notify_before_mins")
        .eq("match_id", match.id);

      if (friendAlerts && friendAlerts.length > 0) {
        for (const alert of friendAlerts) {
          
          // Check if already sent
          const { data: existingSent } = await supabase
            .from("sent_fan_notifications")
            .select("user_id")
            .eq("match_id", match.id)
            .eq("user_id", alert.user_id)
            .maybeSingle();
            
          if (existingSent) continue;
          
          const triggerTime = matchTime - (alert.notify_before_mins * 60 * 1000);
          
          if (now >= triggerTime && (now - triggerTime) < 15 * 60 * 1000) {
            const dateObj = new Date(match.scheduled_at);
            const timeStr = dateObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
            
            const title = "🏸 Friend's Match Reminder";
            const team1Name = match.team1_label || "Team 1";
            const team2Name = match.team2_label || "Team 2";
            const body = `${team1Name} vs ${team2Name} is starting at ${timeStr} IST!`;

            // Insert In-App Notification
            await supabase.from("notifications").insert({
              user_id: alert.user_id,
              title: title,
              message: body,
              type: "friend_match_reminder",
              link: "/my-matches" // or the appropriate link
            });

            // Send Push
            if (accessToken && serviceAccount) {
              const { data: tokens } = await supabase
                .from("user_push_tokens")
                .select("token")
                .eq("user_id", alert.user_id);

              if (tokens && tokens.length > 0) {
                const uniqueTokens = Array.from(new Set(tokens.map((t: any) => t.token)));
                for (const token of uniqueTokens) {
                  await sendFcmNotification(token as string, title, body, serviceAccount.project_id, accessToken);
                }
              }
            }
            
            // Mark as sent
            await supabase.from("sent_fan_notifications").upsert({
              match_id: match.id,
              user_id: alert.user_id
            }, { onConflict: "user_id,match_id" });
            
            sentCount++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Error in send-match-reminders:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
