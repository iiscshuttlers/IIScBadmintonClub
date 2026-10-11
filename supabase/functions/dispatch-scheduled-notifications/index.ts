// ─────────────────────────────────────────────────────────────────────────────
// dispatch-scheduled-notifications
//
// Drains the `scheduled_notifications` queue: every pending row whose
// scheduled_at has passed is fanned out to each requested channel
// (in_app / email / push) for its resolved recipient_ids, then marked sent
// (or failed, with the error recorded). Invoked on a short pg_cron cadence.
//
// Reuses the club's existing conventions:
//   • in-app  → insert rows into `notifications`
//   • email   → nodemailer over SMTP_* env (same transport as match-notifier)
//   • push    → FCM v1 using FIREBASE_SERVICE_ACCOUNT (same as send-announcement)
//   • channel/preference gating → getNotificationTargets(_shared/notifications)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.2.2";
import nodemailer from "npm:nodemailer";
import { getNotificationTargets } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_LIMIT = 50;

async function getFirebaseAccessToken(): Promise<{ token: string; projectId: string } | null> {
  const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountStr) {
    console.warn("[dispatch] FIREBASE_SERVICE_ACCOUNT missing — push skipped");
    return null;
  }
  try {
    const sa = JSON.parse(serviceAccountStr);
    const privateKey = await importPKCS8(sa.private_key, "RS256");
    const jwt = await new SignJWT({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || "OAuth error");
    return { token: data.access_token, projectId: sa.project_id };
  } catch (e) {
    console.error("[dispatch] Firebase token error:", e);
    return null;
  }
}

function createTransporter() {
  const host = Deno.env.get("SMTP_HOST");
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!host || !user || !pass) {
    console.warn("[dispatch] SMTP credentials missing — email skipped");
    return null;
  }
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function emailHtml(title: string, body: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f9fafb; border-radius: 8px;">
      <h2 style="color: #7c3aed;">🏸 IISc Badminton Club</h2>
      <h3 style="color: #1f2937;">${title}</h3>
      <p style="font-size: 16px; color: #1f2937; white-space: pre-wrap;">${body}</p>
      <p style="margin-top: 20px; color: #9ca3af; font-size: 12px;">You're receiving this because you're part of an IISc Badminton Club tournament.</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: due, error: dueErr } = await supabase
    .from("scheduled_notifications")
    .select("id, title, body, channels, recipient_ids, tournament_id")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Lazily initialise the shared push/email transports (only if any row needs them).
  const needsPush = due.some((r: any) => r.channels?.includes("push"));
  const needsEmail = due.some((r: any) => r.channels?.includes("email"));
  const fcm = needsPush ? await getFirebaseAccessToken() : null;
  const transporter = needsEmail ? createTransporter() : null;

  let processed = 0;
  for (const row of due) {
    try {
      const recipients: string[] = Array.from(new Set((row.recipient_ids ?? []).filter(Boolean)));
      const channels: string[] = row.channels ?? [];
      const link = row.tournament_id ? "/pulse" : "/pulse#announcements";

      // ── in-app ──────────────────────────────────────────────────────────
      if (channels.includes("in_app") && recipients.length) {
        const rows = recipients.map((uid) => ({
          user_id: uid,
          title: row.title,
          message: row.body,
          type: "tournament_reminder",
          link,
          is_read: false,
        }));
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) throw new Error(`in_app: ${error.message}`);
      }

      // ── email + push (both gated by player prefs) ───────────────────────
      if ((channels.includes("email") || channels.includes("push")) && recipients.length) {
        const { pushTokens, emails } = await getNotificationTargets(supabase, recipients, "pref_notify_whistle");

        if (channels.includes("email") && transporter) {
          await Promise.allSettled(
            emails.map((e) => {
              const to = e.iisc_email || e.email;
              if (!to) return Promise.resolve();
              return transporter.sendMail({
                from: `"IISc Badminton Club" <${Deno.env.get("SMTP_USER")}>`,
                to,
                subject: row.title,
                html: emailHtml(row.title, row.body),
              }).catch((err: any) => console.error("[dispatch] email failed:", err?.message));
            }),
          );
        }

        if (channels.includes("push") && fcm) {
          const uniqueTokens = [...new Map(pushTokens.map((t) => [t.token, t])).values()];
          await Promise.allSettled(
            uniqueTokens.map((t) =>
              fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcm.token}` },
                body: JSON.stringify({
                  message: {
                    token: t.token,
                    notification: { title: row.title, body: row.body },
                    android: { priority: "high", notification: { channel_id: "notify_whistle" } },
                    webpush: { headers: { Urgency: "high" }, notification: { icon: "icon-192.png", badge: "icon-192.png" } },
                    data: { type: "tournament_reminder", action: "view_announcements" },
                  },
                }),
              }).catch((err) => console.error("[dispatch] push failed:", err)),
            ),
          );
        }
      }

      await supabase
        .from("scheduled_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", row.id);
      processed++;
    } catch (e: any) {
      console.error(`[dispatch] row ${row.id} failed:`, e?.message);
      await supabase
        .from("scheduled_notifications")
        .update({ status: "failed", error: String(e?.message ?? e).slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return new Response(JSON.stringify({ processed, total: due.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
