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
import { getNotificationTargets, type PreferenceColumn } from "../_shared/notifications.ts";
import { isDeadToken } from "../_shared/fcm.ts";
import { emailOutcome, escapeHtml, rejectionMessage } from "../_shared/emailOutcome.ts";
import {
  backupRetryAt, channelsToSend, dueFilter, isGroupKeyCollision, isStuck, retryDecision, STUCK_AFTER_MS,
} from "../_shared/dispatchRules.ts";
import {
  backupAction, backupEmailBody, backupEmailSubject, buildRegistrationNotice, categoryLabel, digestBody, digestCsv,
  digestSubject, formatIST, registrationEmail, type DigestEvent,
} from "../_shared/registrationMessages.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_LIMIT = 50;

interface DeliveryRule {
  /** `notifications.type` for the in-app row (drives the icon in the bell menu). */
  inAppType: string;
  /** Player preference that gates push (and email). */
  pref: PreferenceColumn;
  /**
   * In-app is the delivery of record and push is a bonus: a recipient list with
   * no registered devices, or a failed device, does not fail the row.
   */
  pushOptional: boolean;
  action?: string;
  /** Registration notices: email ignores pref_receive_email and the category pref. */
  emailIgnoresPrefs?: boolean;
  /** Text built from payload (registrationMessages.ts) instead of title/body. */
  registrationText?: boolean;
}

// Organiser-sent rows (no event_type) keep the original behaviour.
const DEFAULT_RULE: DeliveryRule = { inAppType: "tournament_reminder", pref: "pref_notify_whistle", pushOptional: false };

const EVENT_RULES: Record<string, DeliveryRule> = {
  // Queued by the site_data trigger in migration 20261121150000_gallery_album_alerts.
  gallery_photos: { inAppType: "gallery_photos", pref: "pref_notify_gallery", pushOptional: true, action: "view_gallery" },
  // Queued by enqueue_registration_notice (migration 20261123150100): in-app, push AND email.
  registration: {
    inAppType: "tournament_registration", pref: "pref_notify_whistle", pushOptional: true,
    action: "view_tournament", emailIgnoresPrefs: true, registrationText: true,
  },
};

// Absolute links in registration emails.
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://iiscshuttlers.github.io/IIScBadmintonClub").replace(/\/$/, "");

/**
 * Copy registration events to the club inbox (REGISTRATION_BACKUP_EMAIL, a
 * function secret; never stored in the database). Power Automate turns these
 * "Field: value" emails into an Excel sheet. Retries with backoff.
 */
async function drainBackupOutbox(supabase: any): Promise<{ sent: number; failed: number } | null> {
  const to = Deno.env.get("REGISTRATION_BACKUP_EMAIL");
  if (!to) return null;
  const nowIso = new Date().toISOString();
  const { data: rows } = await supabase
    .from("tournament_backup_outbox")
    .select("id, attempts, event:event_id (id, category, action, created_at, player_ids, before, after, participant_id, actor_id), tournament:tournament_id (name)")
    .is("sent_at", null)
    .lt("attempts", 3)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(20);
  if (!rows?.length) return { sent: 0, failed: 0 };
  const transporter = createTransporter();
  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    const ev = r.event ?? {};
    const after = ev.after ?? {};
    const before = ev.before ?? {};
    const name = after.player_name ?? before.player_name ?? "Player";
    const action = backupAction(ev.action);
    let phone: string | null = null;
    if (ev.participant_id) {
      const { data: c } = await supabase.from("tournament_entry_contacts").select("partner_guest_phone").eq("participant_id", ev.participant_id).maybeSingle();
      phone = c?.partner_guest_phone ?? null;
    }
    const body = backupEmailBody({
      "Time (IST)": formatIST(ev.created_at, { withYear: true }),
      Tournament: r.tournament?.name,
      Category: ev.category ? `${ev.category} (${categoryLabel(ev.category)})` : "",
      Action: action,
      Player: after.player_name ?? before.player_name,
      Partner: after.partner_name ?? "",
      "Previous partner": before.partner_name ?? "",
      "Guest partner phone": phone ?? "",
      By: after.by === "organiser" ? "organiser" : "player",
    });
    try {
      if (!transporter) throw new Error("SMTP credentials unavailable");
      await transporter.sendMail({
        from: `"IISc Badminton Club" <${Deno.env.get("SMTP_USER")}>`,
        to,
        subject: backupEmailSubject(r.tournament?.name ?? "Tournament", name, action),
        text: body,
      });
      await supabase.from("tournament_backup_outbox").update({ sent_at: new Date().toISOString(), last_error: null }).eq("id", r.id);
      sent++;
    } catch (e: any) {
      const attempts = (r.attempts ?? 0) + 1;
      await supabase.from("tournament_backup_outbox")
        .update({ attempts, next_attempt_at: backupRetryAt(attempts), last_error: String(e?.message ?? e).slice(0, 300) })
        .eq("id", r.id);
      failed++;
    }
  }
  return { sent, failed };
}

/**
 * Daily CSV digest (queued by cron at 20:05 IST into tournament_backup_digests):
 * every backed-up entry change of the previous 24 h as one attachment to the
 * club inbox. Same retry rule as the per-entry copies. Returns null when the
 * inbox secret isn't set.
 */
async function drainBackupDigest(supabase: any): Promise<{ sent: number; failed: number } | null> {
  const to = Deno.env.get("REGISTRATION_BACKUP_EMAIL");
  if (!to) return null;
  const nowIso = new Date().toISOString();
  const { data: digests } = await supabase
    .from("tournament_backup_digests")
    .select("digest_date, created_at, attempts")
    .is("sent_at", null)
    .lt("attempts", 3)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .order("digest_date", { ascending: true })
    .limit(2);
  if (!digests?.length) return { sent: 0, failed: 0 };
  const transporter = createTransporter();
  let sent = 0;
  let failed = 0;
  for (const d of digests) {
    try {
      const until = new Date(d.created_at);
      const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
      const { data: rows, error } = await supabase
        .from("tournament_backup_outbox")
        .select("event:event_id (created_at, category, action, participant_id, before, after), tournament:tournament_id (name)")
        .gt("created_at", since.toISOString())
        .lte("created_at", until.toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw new Error(error.message);
      const evs = (rows ?? []).filter((r: any) => r.event);
      const ids = new Set<string>();
      for (const r of evs) {
        for (const side of [r.event.after, r.event.before]) {
          if (side?.player_id) ids.add(side.player_id);
          if (side?.partner_id) ids.add(side.partner_id);
        }
      }
      const people = new Map<string, any>();
      const idList = [...ids];
      for (let i = 0; i < idList.length; i += 200) {
        const { data: ps } = await supabase.from("players")
          .select("id, email, iisc_email, contact_number").in("id", idList.slice(i, i + 200));
        for (const p of ps ?? []) people.set(p.id, p);
      }
      const pIds = evs.map((r: any) => r.event.participant_id).filter(Boolean);
      const guestPhone = new Map<string, string>();
      for (let i = 0; i < pIds.length; i += 200) {
        const { data: cs } = await supabase.from("tournament_entry_contacts")
          .select("participant_id, partner_guest_phone").in("participant_id", pIds.slice(i, i + 200));
        for (const c of cs ?? []) if (c.partner_guest_phone) guestPhone.set(c.participant_id, c.partner_guest_phone);
      }
      const perTournament: Record<string, number> = {};
      const events: DigestEvent[] = evs.map((r: any) => {
        const ev = r.event;
        const side = ev.after ?? ev.before ?? {};
        const player = side.player_id ? people.get(side.player_id) : null;
        const partner = ev.after?.partner_id ? people.get(ev.after.partner_id) : null;
        const tName = r.tournament?.name ?? "Tournament";
        perTournament[tName] = (perTournament[tName] ?? 0) + 1;
        return {
          created_at: ev.created_at, tournament: tName, category: ev.category, action: ev.action,
          after: ev.after, before: ev.before,
          player_email: player?.email ?? player?.iisc_email ?? null,
          player_phone: player?.contact_number ?? null,
          partner_phone: partner?.contact_number ?? guestPhone.get(ev.participant_id) ?? null,
        };
      });
      if (!transporter) throw new Error("SMTP credentials unavailable");
      await transporter.sendMail({
        from: `"IISc Badminton Club" <${Deno.env.get("SMTP_USER")}>`,
        to,
        subject: digestSubject(d.digest_date, events.length),
        text: digestBody(d.digest_date, perTournament),
        attachments: [{ filename: `registrations-${d.digest_date}.csv`, content: digestCsv(events), contentType: "text/csv; charset=utf-8" }],
      });
      await supabase.from("tournament_backup_digests").update({ sent_at: new Date().toISOString(), last_error: null }).eq("digest_date", d.digest_date);
      sent++;
    } catch (e: any) {
      const attempts = (d.attempts ?? 0) + 1;
      await supabase.from("tournament_backup_digests")
        .update({ attempts, next_attempt_at: backupRetryAt(attempts), last_error: String(e?.message ?? e).slice(0, 300) })
        .eq("digest_date", d.digest_date);
      failed++;
    }
  }
  return { sent, failed };
}

function httpsImage(payload: unknown): string | null {
  const image = (payload as { image?: unknown } | null)?.image;
  return typeof image === "string" && image.startsWith("https://") ? image : null;
}

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
      <h3 style="color: #1f2937;">${escapeHtml(title)}</h3>
      <p style="font-size: 16px; color: #1f2937; white-space: pre-wrap;">${escapeHtml(body)}</p>
      <p style="margin-top: 20px; color: #9ca3af; font-size: 12px;">You're receiving this because you're part of an IISc Badminton Club tournament.</p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const now = new Date().toISOString();
  // Expired/superseded rows are terminal and must never reach a provider.
  await supabase
    .from("scheduled_notifications")
    .update({ status: "cancelled", error: "Expired before provider dispatch" })
    .eq("status", "pending")
    .not("expires_at", "is", null)
    .lte("expires_at", now);

  // Rows a crashed run left in "sending" for over 10 minutes go back to pending.
  const { data: stuck } = await supabase
    .from("scheduled_notifications")
    .select("id, attempts, sent_at")
    .eq("status", "sending")
    .lt("sent_at", new Date(Date.now() - STUCK_AFTER_MS).toISOString())
    .limit(BATCH_LIMIT);
  for (const r of stuck ?? []) {
    if (!isStuck(r.sent_at)) continue;
    const { error } = await supabase
      .from("scheduled_notifications")
      .update({ status: "pending", sent_at: null, attempts: (r.attempts ?? 0) + 1 })
      .eq("id", r.id)
      .eq("status", "sending");
    if (isGroupKeyCollision(error)) {
      await supabase.from("scheduled_notifications").update({ status: "cancelled", error: "Superseded by a newer reminder" }).eq("id", r.id);
    }
  }

  const { data: candidates, error: dueErr } = await supabase
    .from("scheduled_notifications")
    .select("id")
    .eq("status", "pending")
    .or(dueFilter(now))
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_LIMIT);

  // Claim: only the run that flips pending -> sending owns a row, so two
  // overlapping runs can never send it twice. sent_at holds the claim time.
  const ids = (candidates ?? []).map((r: { id: string }) => r.id);
  const { data: due } = ids.length
    ? await supabase
      .from("scheduled_notifications")
      .update({ status: "sending", sent_at: now })
      .in("id", ids)
      .eq("status", "pending")
      .select("id, title, body, channels, recipient_ids, tournament_id, match_id, event_type, event_version, link, expires_at, payload, attempts, delivered_channels, group_key")
    : { data: [] as any[] };

  if (dueErr) {
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const backup = await drainBackupOutbox(supabase);
  const digest = await drainBackupDigest(supabase);
  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ processed: 0, backup, digest }), {
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
    // Email failures used to be logged only, leaving the row "sent". Kept
    // outside the try so a push failure's error text can mention them too.
    let emailNote: string | null = null;
    let emailAllFailed = false;
    const rule = (row.event_type && EVENT_RULES[row.event_type]) || DEFAULT_RULE;
    // Registration rows record each delivered channel so a retry never repeats one.
    const delivered: string[] = [...(row.delivered_channels ?? [])];
    try {
      const recipients: string[] = Array.from(new Set((row.recipient_ids ?? []).filter(Boolean)));
      const channels: string[] = rule.registrationText ? channelsToSend(row.channels, delivered) : (row.channels ?? []);
      const link = row.link ?? (row.tournament_id ? `/tournaments/${encodeURIComponent(row.tournament_id)}` : "/club?tab=news");
      const image = httpsImage(row.payload);
      if (rule.registrationText && row.payload) {
        const n = buildRegistrationNotice(row.payload);
        row.title = n.title;
        row.body = n.body;
      }
      const markDelivered = async (ch: string) => {
        if (!rule.registrationText || delivered.includes(ch)) return;
        delivered.push(ch);
        await supabase.from("scheduled_notifications").update({ delivered_channels: delivered }).eq("id", row.id);
      };

      // ── in-app ──────────────────────────────────────────────────────────
      if (channels.includes("in_app") && recipients.length) {
        const rows = recipients.map((uid) => ({
          user_id: uid,
          title: row.title,
          message: row.body,
          type: rule.inAppType,
          link,
          is_read: false,
        }));
        const { error } = await supabase.from("notifications").insert(rows);
        if (error) throw new Error(`in_app: ${error.message}`);
        await markDelivered("in_app");
      }

      // ── email + push (both gated by player prefs) ───────────────────────
      if ((channels.includes("email") || channels.includes("push")) && recipients.length) {
        const { pushTokens, emails } = await getNotificationTargets(supabase, recipients, rule.pref, { emailIgnoresPrefs: rule.emailIgnoresPrefs });
        const mail = rule.registrationText && row.payload
          ? registrationEmail(row.payload, `${SITE_URL}${link}`)
          : null;

        if (channels.includes("email")) {
          const addresses = emails
            .map((e) => e.iisc_email || e.email)
            .filter((to): to is string => !!to);
          const failures: string[] = [];
          if (transporter && addresses.length) {
            const results = await Promise.allSettled(
              addresses.map((to) =>
                transporter.sendMail({
                  from: `"IISc Badminton Club" <${Deno.env.get("SMTP_USER")}>`,
                  to,
                  subject: mail?.subject ?? row.title,
                  html: emailHtml(row.title, mail?.text ?? row.body),
                })
              ),
            );
            for (const r of results) {
              if (r.status === "rejected") failures.push(rejectionMessage(r.reason));
            }
          }
          const outcome = emailOutcome(addresses.length, failures, !!transporter);
          emailNote = outcome.note;
          emailAllFailed = outcome.allFailed;
          if (emailNote) console.error(`[dispatch] row ${row.id}: ${emailNote}`);
          if (!emailAllFailed) await markDelivered("email");
        }

        if (channels.includes("push") && fcm) {
          const uniqueTokens = [...new Map(pushTokens.map((t) => [t.token, t])).values()];
          if (uniqueTokens.length === 0 && !rule.pushOptional) {
            throw new Error("push: no eligible device tokens");
          }
          const sends = uniqueTokens.map(async (t) => {
              const response = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcm.token}` },
                body: JSON.stringify({
                  message: {
                    token: t.token,
                    notification: { title: row.title, body: row.body, ...(image ? { image } : {}) },
                    android: { priority: "high", notification: { channel_id: "notify_whistle" } },
                    webpush: { headers: { Urgency: "high" }, notification: { icon: "icon-192.png", badge: "icon-192.png" } },
                    data: {
                      type: row.event_type ?? "tournament_reminder",
                      action: row.match_id ? "view_match" : "view_announcements",
                      ...(rule.action ? { action: rule.action } : {}),
                      link,
                      ...(row.tournament_id ? { tournament_id: String(row.tournament_id) } : {}),
                      ...(row.match_id ? { match_id: String(row.match_id) } : {}),
                      ...(row.event_version != null ? { event_version: String(row.event_version) } : {}),
                    },
                  },
                }),
              });
              if (!response.ok) {
                const responseText = await response.text();
                if (isDeadToken(response.status, responseText)) {
                  await supabase.from("user_push_tokens").delete().eq("token", t.token);
                }
                throw new Error(`push: FCM ${response.status}: ${responseText.slice(0, 200)}`);
              }
            });
          if (rule.pushOptional) {
            // Best effort: in-app already delivered; log device failures, keep the row "sent".
            const failed = (await Promise.allSettled(sends)).filter((s): s is PromiseRejectedResult => s.status === "rejected");
            if (failed.length) {
              console.warn(`[dispatch] row ${row.id}: ${failed.length}/${sends.length} pushes failed:`, failed[0].reason?.message);
            }
            await markDelivered("push");
          } else {
            // Only record delivery after FCM accepts every request.
            await Promise.all(sends);
          }
        } else if (channels.includes("push") && recipients.length && !rule.pushOptional) {
          throw new Error("push: Firebase credentials unavailable");
        }
      }

      // The mail server rejected every email (or SMTP is missing): the row failed,
      // even though in-app and push may have gone out above.
      if (emailAllFailed) throw new Error(emailNote ?? "email: all sends failed");

      // Some emails failed: the row went out, but keeps the note so the admin
      // Delivery panel lists it as partly sent.
      await supabase
        .from("scheduled_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: emailNote })
        .eq("id", row.id);
      processed++;
    } catch (e: any) {
      const message = String(e?.message ?? e);
      const error = emailNote && !message.startsWith("email:") ? `${message} · ${emailNote}` : message;
      console.error(`[dispatch] row ${row.id} failed:`, error);
      // Registration rows retry with backoff (only the missing channels);
      // every other kind fails at once, as before.
      const next = retryDecision(row.event_type, row.attempts ?? 0);
      const { error: updErr } = await supabase
        .from("scheduled_notifications")
        .update(next.status === "pending"
          ? { status: "pending", sent_at: null, attempts: next.attempts, next_attempt_at: next.nextAttemptAt, error: error.slice(0, 500) }
          : { status: "failed", attempts: next.attempts, error: error.slice(0, 500) })
        .eq("id", row.id);
      if (isGroupKeyCollision(updErr)) {
        // A newer pending reminder with the same group key exists: drop this older one.
        await supabase.from("scheduled_notifications")
          .update({ status: "cancelled", error: "Superseded by a newer reminder" })
          .eq("id", row.id);
      }
    }
  }

  return new Response(JSON.stringify({ processed, total: due.length, backup, digest }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
