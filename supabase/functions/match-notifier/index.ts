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
  const playerIds = [match.player1_id, match.player2_id, match.player3_id, match.player4_id, match.umpired_by].filter(Boolean);
  
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
    
  const tokensMap = new Map();
  if (pushTokens) {
    for (const t of pushTokens) {
      if (!tokensMap.has(t.user_id)) tokensMap.set(t.user_id, []);
      tokensMap.get(t.user_id).push(t.token);
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
      const verb = partnerLabel ? `are` : `are`; // "You are" or "You and X are" -> both take "are"
      
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
      const userTokens = tokensMap.get(pId);
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

  // Update reminder_sent
  await supabase.from("tournament_matches").update({ reminder_sent: true }).eq("id", match.id);
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
      // Manual admin trigger
      const { data: match } = await supabase.from("tournament_matches").select("*, tournaments(*)").eq("id", match_id).single();
      if (!match) return new Response(JSON.stringify({ error: "Match not found" }), { headers: corsHeaders, status: 404 });
      
      await dispatchNotifications(supabase, match, match.tournaments);
      
      return new Response(JSON.stringify({ message: "Reminder sent manually!" }), { headers: corsHeaders, status: 200 });
      
    } else {
      // Cron execution (find matches in next 30 mins)
      const { data: tournaments } = await supabase.from("tournaments").select("id, name").eq("auto_reminders_enabled", true);
      if (!tournaments || tournaments.length === 0) {
        return new Response(JSON.stringify({ message: "No active auto-reminder tournaments" }), { headers: corsHeaders });
      }

      const tournamentIds = tournaments.map((t: any) => t.id);
      
      // Calculate 30 mins from now
      const now = new Date();
      const in30Mins = new Date(now.getTime() + 30 * 60000);

      const { data: matches } = await supabase
        .from("tournament_matches")
        .select("*, tournaments(*)")
        .in("tournament_id", tournamentIds)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in30Mins.toISOString())
        .eq("reminder_sent", false);

      if (!matches || matches.length === 0) {
        return new Response(JSON.stringify({ message: "No upcoming matches to remind" }), { headers: corsHeaders });
      }

      for (const match of matches) {
        await dispatchNotifications(supabase, match, match.tournaments);
      }

      return new Response(JSON.stringify({ message: `Sent reminders for ${matches.length} matches` }), { headers: corsHeaders });
    }

  } catch (err: any) {
    console.error("[match-notifier] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
