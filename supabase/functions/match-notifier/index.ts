import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import nodemailer from "npm:nodemailer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
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
    throw new Error(`Failed to get Google OAuth token: ${data.error_description}`);
  }

  return data.access_token;
}

// Nodemailer transport setup
function createTransporter() {
  const host = Deno.env.get("SMTP_HOST");
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");

  if (!host || !user || !pass) {
    console.warn("[match-notifier] SMTP credentials missing. Email sending will be skipped.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function dispatchNotifications(supabase: any, match: any, tournament: any) {
  // Mark reminder_sent immediately to prevent concurrent duplicate invocations
  await supabase.from("tournament_matches").update({ reminder_sent: true }).eq("id", match.id);

  const rawPlayerIds = [match.player1_id, match.player2_id, match.player3_id, match.player4_id, match.umpired_by].filter(Boolean);
  const playerIds = Array.from(new Set(rawPlayerIds));
  
  if (playerIds.length === 0) return;

  const { data: players } = await supabase
    .from("players")
    .select("id, full_name, email, iisc_email")
    .in("id", playerIds);
    
  if (!players || players.length === 0) return;

  const playerMap = new Map(players.map((p: any) => [p.id, p]));

  // Fetch Push Tokens
  const { data: pushTokens } = await supabase
    .from("user_push_tokens")
    .select("user_id, token")
    .in("user_id", playerIds);
    
  const tokensMap = new Map<string, string[]>();
  if (pushTokens) {
    for (const t of pushTokens) {
      if (!tokensMap.has(t.user_id)) tokensMap.set(t.user_id, []);
      const existing = tokensMap.get(t.user_id)!;
      if (!existing.includes(t.token)) {
        existing.push(t.token);
      }
    }
  }

  const fcmAccessToken = await getFirebaseAccessToken().catch(e => {
    console.warn("Could not get FCM token. Push notifications will be skipped.", e);
    return null;
  });
  const projectId = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ? JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!).project_id : null;

  const transporter = createTransporter();
  const matchDate = new Date(match.scheduled_at);
  const now = new Date();
  const opts = { timeZone: "Asia/Kolkata", year: 'numeric', month: 'numeric', day: 'numeric' } as const;
  const matchDateString = matchDate.toLocaleDateString("en-IN", opts);
  const nowDateString = now.toLocaleDateString("en-IN", opts);
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowDateString = tomorrow.toLocaleDateString("en-IN", opts);

  let dateLabel = "";
  if (matchDateString === nowDateString) dateLabel = "Today";
  else if (matchDateString === tomorrowDateString) dateLabel = "Tomorrow";
  else dateLabel = matchDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: 'short', month: 'short', day: 'numeric' });

  const timeString = matchDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' });
  const dateTimeStr = `${dateLabel} at ${timeString}`;

  for (const pId of playerIds) {
    const player = playerMap.get(pId);
    if (!player) continue;

    const isUmpire = pId === match.umpired_by;
    const role = isUmpire ? "Umpire" : "Player";
    
    const isTeam1 = pId === match.player1_id || pId === match.player3_id;
    const isTeam2 = pId === match.player2_id || pId === match.player4_id;
    const opponentLabel = isTeam1 ? match.team2_label : isTeam2 ? match.team1_label : "TBD";
    
    let partnerLabel = "";
    if (isTeam1 && match.player1_id && match.player3_id) {
      const partnerId = pId === match.player1_id ? match.player3_id : match.player1_id;
      const pObj = playerMap.get(partnerId);
      if (pObj) partnerLabel = pObj.full_name;
    } else if (isTeam2 && match.player2_id && match.player4_id) {
      const partnerId = pId === match.player2_id ? match.player4_id : match.player2_id;
      const pObj = playerMap.get(partnerId);
      if (pObj) partnerLabel = pObj.full_name;
    }
    
    const roundStr = match.round_name ? ` - ${match.round_name}` : "";
    
    let title = `🏸 Match Starting Soon!`;
    let body = "";
    
    if (isUmpire) {
      title = `🏸 Umpiring Duty: Match ${match.match_code} (${match.category}${roundStr})`;
      body = `You are scheduled to umpire match ${match.match_code} (${match.category}) ${dateTimeStr} on ${match.court_number ? 'Court ' + match.court_number : 'a TBA court'}.`;
    } else {
      title = `🏸 Match ${match.match_code} Starting Soon: ${match.category}${roundStr}`;
      const partnerText = partnerLabel ? `You and ${partnerLabel}` : `You`;
      const verb = partnerLabel ? `are` : `are`;
      
      body = opponentLabel && opponentLabel !== "TBD" && opponentLabel !== "BYE" 
        ? `${partnerText} ${verb} up against ${opponentLabel} ${dateTimeStr} on ${match.court_number ? 'Court ' + match.court_number : 'a TBA court'}.`
        : `Your ${match.category} match is scheduled for ${dateTimeStr} on ${match.court_number ? 'Court ' + match.court_number : 'a TBA court'}.`;
    }

    // 1. Send Email
    const targetEmail = player.iisc_email || player.email;
    if (transporter && targetEmail) {
      const mailOptions = {
        from: `"IISc Badminton Club" <${Deno.env.get("SMTP_USER")}>`,
        to: targetEmail,
        subject: title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
            <h2 style="color: #3b82f6;">🏸 ${tournament.name}</h2>
            <p>Hi ${player.full_name},</p>
            <p style="font-size: 16px; color: #1f2937;">${body}</p>
            <div style="margin-top: 20px; padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb;">
              <table style="width: 100%; font-size: 14px;">
                <tr><td style="padding: 4px 0; color: #6b7280;">Match Number:</td><td style="font-weight: bold; text-align: right;">${match.match_code}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Category:</td><td style="font-weight: bold; text-align: right;">${match.category}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Round:</td><td style="font-weight: bold; text-align: right;">${match.round_name || 'N/A'}</td></tr>
                ${!isUmpire ? `<tr><td style="padding: 4px 0; color: #6b7280;">Opponent:</td><td style="font-weight: bold; text-align: right;">${opponentLabel || 'TBD'}</td></tr>` : ''}
                <tr><td style="padding: 4px 0; color: #6b7280;">Court:</td><td style="font-weight: bold; text-align: right;">${match.court_number ? 'Court ' + match.court_number : 'TBA'}</td></tr>
                <tr><td style="padding: 4px 0; color: #6b7280;">Time:</td><td style="font-weight: bold; color: #3b82f6; text-align: right;">${dateTimeStr}</td></tr>
              </table>
            </div>
            <p style="margin-top: 20px; color: #6b7280; font-size: 12px; font-weight: bold;">Please report to the desk 10 minutes early. Good luck!</p>
          </div>
        `
      };
      await transporter.sendMail(mailOptions).catch((e: any) => console.error("Email failed:", e));
    }

    // 2. Send Push
    if (fcmAccessToken && projectId && tokensMap.has(pId)) {
      const userTokens = tokensMap.get(pId)!;
      for (const token of userTokens) {
        const fcmPayload = {
          message: {
            token,
            notification: { title, body },
            android: { priority: "high" },
            data: { matchId: match.id, type: "match_reminder", action: "view_match" }
          }
        };
        await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcmAccessToken}` },
          body: JSON.stringify(fcmPayload),
        }).catch(e => console.error("Push failed:", e));
      }
    }
  }
}

async function dispatchFanNotifications(supabase: any, tournamentIds: string[], fcmAccessToken: string | null, projectId: string | null) {
  if (!fcmAccessToken || !projectId) return;

  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60000);

  const { data: futureMatches } = await supabase
    .from("tournament_matches")
    .select("id, match_code, category, scheduled_at, team1_label, team2_label, player1_id, player2_id, player3_id, player4_id")
    .in("tournament_id", tournamentIds)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", in24Hours.toISOString());

  if (!futureMatches || futureMatches.length === 0) return;

  const matchIds = futureMatches.map((m: any) => m.id);
  const playerIds = new Set<string>();
  futureMatches.forEach((m: any) => {
    if (m.player1_id) playerIds.add(m.player1_id);
    if (m.player2_id) playerIds.add(m.player2_id);
    if (m.player3_id) playerIds.add(m.player3_id);
    if (m.player4_id) playerIds.add(m.player4_id);
  });

  const { data: matchSubs } = await supabase.from("user_match_notifications").select("*").in("match_id", matchIds);
  const { data: playerSubs } = await supabase.from("user_player_subscriptions").select("*").in("player_id", Array.from(playerIds));
  const { data: sentNotifs } = await supabase.from("sent_fan_notifications").select("*").in("match_id", matchIds);

  const sentSet = new Set(sentNotifs?.map((s: any) => `${s.user_id}_${s.match_id}`) || []);
  const notificationsToSend: { user_id: string, match_id: string, match: any, minsBefore: number }[] = [];

  for (const match of futureMatches) {
    if (!match.scheduled_at) continue;
    const matchTime = new Date(match.scheduled_at).getTime();
    const minsUntilMatch = Math.floor((matchTime - now.getTime()) / 60000);

    const usersToNotify = new Map<string, number>();

    const mSubs = matchSubs?.filter((s: any) => s.match_id === match.id) || [];
    for (const sub of mSubs) {
      if (minsUntilMatch <= sub.notify_before_mins && minsUntilMatch >= 0) {
        usersToNotify.set(sub.user_id, sub.notify_before_mins);
      }
    }

    const mPlayerIds = [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean);
    const pSubs = playerSubs?.filter((s: any) => mPlayerIds.includes(s.player_id)) || [];
    for (const sub of pSubs) {
      if (minsUntilMatch <= sub.notify_before_mins && minsUntilMatch >= 0) {
        if (!usersToNotify.has(sub.user_id) || usersToNotify.get(sub.user_id)! < sub.notify_before_mins) {
          usersToNotify.set(sub.user_id, sub.notify_before_mins);
        }
      }
    }

    for (const [userId, minsBefore] of usersToNotify.entries()) {
      if (!sentSet.has(`${userId}_${match.id}`)) {
        notificationsToSend.push({ user_id: userId, match_id: match.id, match, minsBefore });
        sentSet.add(`${userId}_${match.id}`);
      }
    }
  }

  if (notificationsToSend.length === 0) return;

  const userIdsToNotify = Array.from(new Set(notificationsToSend.map(n => n.user_id)));
  const { data: pushTokens } = await supabase.from("user_push_tokens").select("user_id, token").in("user_id", userIdsToNotify);
  
  const tokensMap = new Map();
  if (pushTokens) {
    for (const t of pushTokens) {
      if (!tokensMap.has(t.user_id)) tokensMap.set(t.user_id, []);
      tokensMap.get(t.user_id).push(t.token);
    }
  }

  const sentRecords: any[] = [];

  for (const notif of notificationsToSend) {
    const tokens = tokensMap.get(notif.user_id);
    if (!tokens || tokens.length === 0) continue;

    const m = notif.match;
    const title = `🏸 Match starting in ${notif.minsBefore} min${notif.minsBefore === 1 ? '' : 's'}`;
    const body = `${m.team1_label || 'TBD'} vs ${m.team2_label || 'TBD'} (${m.category})`;

    for (const token of tokens) {
      const fcmPayload = {
        message: {
          token,
          notification: { title, body },
          android: { priority: "high" },
          data: { matchId: m.id, type: "fan_reminder", action: "view_match" }
        }
      };
      await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcmAccessToken}` },
        body: JSON.stringify(fcmPayload),
      }).catch(e => console.error("Fan push failed:", e));
    }
    sentRecords.push({ user_id: notif.user_id, match_id: notif.match_id });
  }

  if (sentRecords.length > 0) {
    await supabase.from("sent_fan_notifications").insert(sentRecords).catch((e:any) => console.error("Failed to insert sent fan notifs", e));
  }
}

async function runAutoReminders(supabase: any) {
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name")
    .or("auto_reminders_enabled.eq.true,auto_reminders_enabled.is.null")
    .neq("status", "draft")
    .neq("status", "completed")
    .neq("status", "deleted");

  if (!tournaments || tournaments.length === 0) {
    return "No active auto-reminder tournaments";
  }

  const tournamentIds = tournaments.map((t: any) => t.id);
  
  const now = new Date();
  const in30Mins = new Date(now.getTime() + 30 * 60000);

  const { data: matches } = await supabase
    .from("tournament_matches")
    .select("*, tournaments(*)")
    .in("tournament_id", tournamentIds)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", in30Mins.toISOString())
    .eq("reminder_sent", false);

  if (matches && matches.length > 0) {
    for (const match of matches) {
      await dispatchNotifications(supabase, match, match.tournaments);
    }
  }
  
  const fcmAccessToken = await getFirebaseAccessToken().catch(e => null);
  const projectId = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ? JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!).project_id : null;
  await dispatchFanNotifications(supabase, tournamentIds, fcmAccessToken, projectId);

  return `Sent reminders for ${matches ? matches.length : 0} matches`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      rawBody = {};
    }

    const { type, match_id } = rawBody;

    if (type === "manual" && match_id) {
      const { data: match } = await supabase.from("tournament_matches").select("*, tournaments(*)").eq("id", match_id).single();
      if (!match) return new Response(JSON.stringify({ error: "Match not found" }), { headers: corsHeaders, status: 404 });
      
      await dispatchNotifications(supabase, match, match.tournaments);
      
      return new Response(JSON.stringify({ message: "Reminder sent manually!" }), { headers: corsHeaders, status: 200 });
      
    } else {
      const message = await runAutoReminders(supabase);
      return new Response(JSON.stringify({ message }), { headers: corsHeaders });
    }

  } catch (err: any) {
    console.error("[match-notifier] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

Deno.cron("Match Notifier Cron", "*/5 * * * *", async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const message = await runAutoReminders(supabase);
    console.log(`[match-notifier-cron] ${message}`);
  } catch (err: any) {
    console.error("[match-notifier-cron] Error:", err);
  }
});
