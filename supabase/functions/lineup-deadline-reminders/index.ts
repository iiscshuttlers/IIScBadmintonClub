import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import { getNotificationTargets } from "../_shared/notifications.ts";
import { isDeadToken, isFatalSendError } from "../_shared/fcm.ts";
import { computeDeadlineAlerts, deadlineText, type DeadlineTie } from "../_shared/lineupDeadline.ts";

/**
 * Team events: remind captains (and vice-captains) who haven't submitted a tie
 * lineup, ~60 and ~15 minutes before it closes. Runs every 5 min via pg_cron
 * (migration 20261015120000_lineup_deadline_reminders.sql). Dedupe table:
 * lineup_deadline_alerts (tie_id, side, threshold).
 */

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const FIREBASE_SERVICE_ACCOUNT = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function fcmToken(sa: { client_email: string; private_key: string }): Promise<string> {
  try {
    const key = await importPKCS8(sa.private_key, "RS256");
    const jwt = await new SignJWT({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    return res.ok ? data.access_token : "";
  } catch {
    return "";
  }
}

Deno.serve(async () => {
  try {
    const now = Date.now();
    // Ties that could have a deadline in the next hour (deadline or start within ~2h).
    const horizon = new Date(now + 2 * 60 * 60_000).toISOString();
    const nowIso = new Date(now).toISOString();
    const { data: ties, error } = await admin
      .from("tournament_ties")
      .select("id, tie_code, state, scheduled_at, lineup_deadline, team_a_id, team_b_id")
      .in("state", ["SCHEDULED", "AWAITING_LINEUPS"])
      .or(
        `and(lineup_deadline.gt.${nowIso},lineup_deadline.lte.${horizon}),` +
          `and(lineup_deadline.is.null,scheduled_at.gt.${nowIso},scheduled_at.lte.${horizon})`,
      );
    if (error) throw error;
    if (!ties?.length) return json({ success: true, sent: 0 });

    const tieIds = ties.map((t) => t.id);
    const [{ data: lineups }, { data: sentRows }] = await Promise.all([
      admin.from("tie_lineups").select("tie_id, side").in("tie_id", tieIds),
      admin.from("lineup_deadline_alerts").select("tie_id, side, threshold").in("tie_id", tieIds),
    ]);
    const submitted = new Set((lineups ?? []).map((l) => `${l.tie_id}:${l.side}`));
    const sent = new Set((sentRows ?? []).map((r) => `${r.tie_id}:${r.side}:${r.threshold}`));
    const alerts = computeDeadlineAlerts(ties as DeadlineTie[], submitted, sent, now);
    if (!alerts.length) return json({ success: true, sent: 0 });

    const teamIds = Array.from(new Set(ties.flatMap((t) => [t.team_a_id, t.team_b_id]).filter(Boolean)));
    const [{ data: teams }, { data: vices }] = await Promise.all([
      admin.from("tournament_teams").select("id, name, short_name, captain_id").in("id", teamIds),
      admin
        .from("tournament_team_members")
        .select("team_id, player_id")
        .in("team_id", teamIds)
        .eq("role", "VICE_CAPTAIN")
        .eq("status", "ACTIVE"),
    ]);
    const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

    let sa: any = null;
    try {
      sa = FIREBASE_SERVICE_ACCOUNT ? JSON.parse(FIREBASE_SERVICE_ACCOUNT) : null;
    } catch {
      sa = null;
    }
    const access = sa ? await fcmToken(sa) : "";
    let pushOk = !!access;
    let sentCount = 0;

    for (const a of alerts) {
      // Claim first; an overlapping run gets nothing back and skips.
      const { data: claimed } = await admin
        .from("lineup_deadline_alerts")
        .upsert({ tie_id: a.tieId, side: a.side, threshold: a.threshold }, { onConflict: "tie_id,side,threshold", ignoreDuplicates: true })
        .select("tie_id");
      if (!claimed?.length) continue;

      const team = teamById.get(a.teamId);
      if (!team) continue;
      const tie = ties.find((t) => t.id === a.tieId)!;
      const oppId = a.side === "A" ? tie.team_b_id : tie.team_a_id;
      const opp = oppId ? teamById.get(oppId)?.short_name || teamById.get(oppId)?.name || null : null;
      const { title, body } = deadlineText(a, tie.tie_code, opp);
      const link = `/team-hub/${team.id}`;
      const recipients = Array.from(
        new Set([team.captain_id, ...(vices ?? []).filter((v) => v.team_id === team.id).map((v) => v.player_id)].filter(Boolean)),
      ) as string[];

      await admin.from("notifications").insert(
        recipients.map((user_id) => ({ user_id, title, message: body, type: "lineup_deadline", link })),
      );
      sentCount += recipients.length;
      if (!pushOk) continue;

      const { pushTokens } = await getNotificationTargets(admin, recipients, "pref_notify_smash");
      for (const { token } of pushTokens) {
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { type: "lineup_deadline", link },
              android: { priority: "high", notification: { channel_id: "notify_point" } },
              webpush: { headers: { Urgency: "high" } },
            },
          }),
        });
        if (res.ok) continue;
        const text = await res.text();
        if (isFatalSendError(res.status)) {
          pushOk = false;
          break;
        }
        if (isDeadToken(res.status, text)) await admin.from("user_push_tokens").delete().eq("token", token);
      }
    }
    return json({ success: true, sent: sentCount });
  } catch (e: any) {
    console.error("lineup-deadline-reminders failed", e);
    return json({ success: false, error: e?.message ?? String(e) }, 500);
  }
});
