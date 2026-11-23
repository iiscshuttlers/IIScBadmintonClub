/**
 * Every text of in-app tournament registration, in one place.
 *
 * Pure module (no Deno imports), so it runs in the dispatcher
 * (dispatch-scheduled-notifications), in the client previews (reminder sheet,
 * share kit) and in vitest (test/lib/registrationMessages.test.ts).
 *
 * SQL only queues `kind` + `payload` (enqueue_registration_notice); the
 * dispatcher calls buildRegistrationNotice(payload) to get the real title and
 * body. All times are shown in India time (Asia/Kolkata).
 */

export const REGISTRATION_KINDS = [
  "entered_as_partner",
  "partner_left",
  "partner_request",
  "partner_request_accepted",
  "partner_request_declined",
  "partner_request_stale",
  "waitlist_promoted",
  "entry_changed_by_organiser",
  "incomplete_entry_auto",
  "incomplete_entry_manual",
  "withdrawal_requested",
  "withdrawal_done",
  "duplicate_found",
  "daily_summary",
] as const;
export type RegistrationKind = (typeof REGISTRATION_KINDS)[number];

/** What SQL puts in scheduled_notifications.payload (snake_case, all optional but kind). */
export interface RegistrationPayload {
  kind: RegistrationKind | string;
  tournament_name?: string | null;
  category?: string | null;
  /** Who did it (registrant, organiser, requester). */
  actor_name?: string | null;
  /** The recipient's partner (or the pair's other member). */
  partner_name?: string | null;
  /** A third player (the one C is entered with, the new partner, ...). */
  other_name?: string | null;
  /** Category deadline, ISO. */
  deadline?: string | null;
  /** Organiser note (manual reminder), up to 200 characters. */
  note?: string | null;
  /** incomplete_entry_*: no_partner | shared_player | shared_pair */
  reason?: string | null;
  /** incomplete_entry_*: already looking for a partner. */
  looking?: boolean | null;
  /** shared_player: the names of the two (or more) partners. */
  pair_names?: string[] | null;
  /** entry_changed_by_organiser: added | changed | removed */
  action?: string | null;
  /** withdrawal_requested: optional reason. */
  withdraw_reason?: string | null;
  /** partner_request_stale: why it went stale. */
  stale_reason?: string | null;
  /** daily_summary counts. */
  summary?: { entries?: number; new_entries?: number; no_partner?: number; shared?: number; categories_open?: number } | null;
}

export interface Notice { title: string; body: string }

const CATEGORY_LABELS: Record<string, string> = {
  MS: "Men's Singles",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

export function categoryLabel(category: string | null | undefined): string {
  const c = (category ?? "").trim();
  return CATEGORY_LABELS[c.toUpperCase()] ?? (c || "the category");
}

const IST = "Asia/Kolkata";

/** "Fri 28 Nov, 6 PM" (or "6:30 PM") in India time; "" for no/invalid date. */
export function formatIST(iso: string | Date | null | undefined, opts: { withYear?: boolean } = {}): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: opts.withYear ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const minute = get("minute");
  const time = `${get("hour")}${minute && minute !== "00" ? `:${minute}` : ""} ${get("dayPeriod").toUpperCase()}`;
  const year = opts.withYear ? ` ${get("year")}` : "";
  return `${get("weekday")} ${get("day")} ${get("month")}${year}, ${time}`;
}

function name(v: string | null | undefined, fallback = "A player"): string {
  const s = (v ?? "").trim();
  return s || fallback;
}

function joinNames(names: (string | null | undefined)[]): string {
  const list = names.map((n) => (n ?? "").trim()).filter(Boolean);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function withNote(body: string, note: string | null | undefined): string {
  const n = (note ?? "").trim().slice(0, 200);
  return n ? `${body}\n\nNote from the organiser: ${n}` : body;
}

/** Manual and automatic "incomplete entry" texts. */
export function incompleteEntryText(p: RegistrationPayload): string {
  const cat = categoryLabel(p.category);
  const by = p.deadline ? ` before ${formatIST(p.deadline)}` : "";
  switch (p.reason) {
    case "shared_player":
      return `You're entered in two ${cat} pairs (with ${joinNames(p.pair_names ?? []) || "two partners"}). Open My entry and leave the pair you're not playing in.`;
    case "shared_pair":
      return `Your partner ${name(p.partner_name, "your partner")} is also entered with ${name(p.other_name, "another player")} in ${cat}. Check with ${name(p.partner_name, "them")}, or pick another partner.`;
    case "open_request":
      return `You have a partner request waiting in ${cat}. Answer it${by} so your entry is complete.`;
    default:
      return p.looking
        ? `You're entered in ${cat} without a partner. You're on the list of players looking for one: open My entry to see the others looking${by}.`
        : `You're entered in ${cat} without a partner. Pick a partner${by}, or turn on 'Looking for a partner'.`;
  }
}

export function buildRegistrationNotice(p: RegistrationPayload): Notice {
  const t = name(p.tournament_name, "the tournament");
  const cat = categoryLabel(p.category);
  const actor = name(p.actor_name);
  switch (p.kind) {
    case "entered_as_partner":
      return { title: `You're entered in ${cat}`, body: `${actor} entered you as their partner in ${cat} at ${t}. Open My entry to see or change it.` };
    case "partner_left":
      return { title: `Your partner left your ${cat} pair`, body: `${actor} is no longer your partner in ${cat} at ${t}. You're still entered on your own: pick a new partner or turn on 'Looking for a partner'.` };
    case "partner_request":
      return { title: `${actor} asked you to partner in ${cat}`, body: `${actor} would like to play ${cat} with you at ${t}. Open My entry to switch or stay with your current entry.` };
    case "partner_request_accepted":
      return { title: `${actor} is now your partner`, body: `${actor} accepted your request. You're entered together in ${cat} at ${t}.` };
    case "partner_request_declined":
      return { title: `${actor} stayed with their entry`, body: `${actor} declined your partner request in ${cat} at ${t}. You can pick someone else in My entry.` };
    case "partner_request_stale":
      return { title: `A partner request in ${cat} no longer applies`, body: `The request between you and ${actor} in ${cat} at ${t} no longer applies${p.stale_reason ? ` (${p.stale_reason})` : ""}. Nothing changed; open My entry to check your entry.` };
    case "waitlist_promoted":
      return { title: `You're in: ${cat}`, body: `A place opened up in ${cat} at ${t}, so your entry moved up from the waitlist.` };
    case "entry_changed_by_organiser": {
      const what = p.action === "removed" ? "removed your entry from" : p.action === "added" ? "entered you in" : "changed your entry in";
      return { title: `Your ${cat} entry was updated`, body: `The organiser ${what} ${cat} at ${t}${p.partner_name ? ` (partner: ${p.partner_name})` : ""}. Open My entry to see it.` };
    }
    case "incomplete_entry_auto":
    case "incomplete_entry_manual":
      return { title: `Your ${cat} entry is incomplete`, body: withNote(incompleteEntryText(p), p.kind === "incomplete_entry_manual" ? p.note : null) };
    case "withdrawal_requested":
      return { title: `${actor} can't play ${cat}`, body: `${actor} asked to withdraw from ${cat} at ${t}${p.withdraw_reason ? `: "${p.withdraw_reason.slice(0, 200)}"` : ""}. The organiser will decide.` };
    case "withdrawal_done":
      return { title: `Withdrawn from ${cat}`, body: `Your pair is withdrawn from ${cat} at ${t}${p.action === "walkover" ? "; your next match was given as a walkover" : ""}.` };
    case "duplicate_found":
      return { title: `${name(p.other_name)} is in two ${cat} pairs`, body: `${name(p.other_name)} is entered in more than one ${cat} pair at ${t} (with ${joinNames(p.pair_names ?? []) || "two partners"}). Open the Registration view to fix it.` };
    case "daily_summary": {
      const s = p.summary ?? {};
      const bits = [
        `${s.entries ?? 0} entries`,
        `${s.new_entries ?? 0} new today`,
        s.no_partner ? `${s.no_partner} without a partner` : "",
        s.shared ? `${s.shared} shared partner${s.shared === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return { title: `Registration today: ${t}`, body: `${bits.join(" · ")}.` };
    }
    default:
      return { title: `Registration update: ${t}`, body: `There's an update to your entry at ${t}.` };
  }
}

/** Email for a registration notice: subject + plain text (the dispatcher wraps it in its HTML shell). */
export function registrationEmail(p: RegistrationPayload, link: string | null | undefined): { subject: string; text: string } {
  const n = buildRegistrationNotice(p);
  const url = link ? `\n\nOpen: ${link}` : "";
  return { subject: `[${name(p.tournament_name, "IISc Shuttlers")}] ${n.title}`, text: `${n.body}${url}\n\nIISc Shuttlers` };
}

// ------------------------------------------------------------- share kit --

export interface ShareCategory { category: string; closesAt?: string | null; state?: string | null }

export function shareText(tournamentName: string, categories: ShareCategory[], link: string): string {
  const lines = categories
    .filter((c) => c.state !== "locked" && c.state !== "hidden")
    .map((c) => `• ${categoryLabel(c.category)}${c.closesAt ? ` (closes ${formatIST(c.closesAt)})` : ""}`);
  return [
    `🏸 Entries are open for ${tournamentName}!`,
    ...lines,
    "",
    `Enter in the app (sign in, pick your partner): ${link}`,
  ].join("\n");
}

export function closingTomorrowText(tournamentName: string, categories: ShareCategory[], link: string): string {
  const open = categories.filter((c) => c.state === "open" || c.state === "closing_soon");
  const lines = open.map((c) => `• ${categoryLabel(c.category)}${c.closesAt ? `: closes ${formatIST(c.closesAt)}` : ""}`);
  return [`⏰ Last call for ${tournamentName}: entries close soon.`, ...lines, "", `Enter now: ${link}`].join("\n");
}

/** WhatsApp text an organiser copies for a player who isn't on the app. */
export function notOnAppMessage(p: RegistrationPayload, link: string): string {
  return `${incompleteEntryText(p)}\n\n${link}`;
}

// ---------------------------------------------------------------- backup --

export type BackupAction = "entered" | "changed" | "left" | "withdrawn";

export function backupEmailSubject(tournamentName: string, playerName: string, action: BackupAction | string): string {
  return `[Registration] ${name(tournamentName, "Tournament")} — ${name(playerName)} — ${action}`;
}

/** "Field: value" lines, one per field, for Power Automate to parse. */
export function backupEmailBody(fields: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${v == null ? "" : String(v).replace(/[\r\n]+/g, " ")}`)
    .join("\n");
}

export const BACKUP_CSV_HEADER = [
  "Time (IST)", "Tournament", "Category", "Action", "Player", "Player email", "Player phone", "Partner", "Partner phone", "Source", "By",
];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

// ---------------------------------------------------------------- digest --

/** One backed-up entry change, with contacts looked up by the dispatcher. */
export interface DigestEvent {
  created_at: string;
  tournament: string | null;
  category: string | null;
  action: string;
  after?: { player_name?: string | null; partner_name?: string | null; by?: string | null; source?: string | null } | null;
  before?: { player_name?: string | null; partner_name?: string | null } | null;
  player_email?: string | null;
  player_phone?: string | null;
  partner_phone?: string | null;
}

export function backupAction(action: string): BackupAction {
  if (action === "entered" || action === "waitlisted" || action === "promoted") return "entered";
  if (action === "left") return "left";
  if (action === "withdrawn") return "withdrawn";
  return "changed";
}

/** The day's CSV (header + one row per change, oldest first, CRLF line ends). */
export function digestCsv(events: DigestEvent[]): string {
  const rows = [...events]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => csvRow([
      formatIST(e.created_at, { withYear: true }),
      e.tournament ?? "",
      e.category ? `${e.category} (${categoryLabel(e.category)})` : "",
      backupAction(e.action),
      e.after?.player_name ?? e.before?.player_name ?? "",
      e.player_email ?? "",
      e.player_phone ?? "",
      e.after?.partner_name ?? "",
      e.partner_phone ?? "",
      e.after?.source ?? (e.after?.by === "organiser" ? "organiser" : "app"),
      e.after?.by === "organiser" ? "organiser" : "player",
    ]));
  return [csvRow(BACKUP_CSV_HEADER), ...rows].join("\r\n") + "\r\n";
}

export function digestSubject(isoDate: string, count: number): string {
  return `[Registration digest] ${isoDate} — ${count} change${count === 1 ? "" : "s"}`;
}

export function digestBody(isoDate: string, perTournament: Record<string, number>): string {
  const lines = Object.entries(perTournament).sort(([a], [b]) => a.localeCompare(b)).map(([t, n]) => `${t}: ${n}`);
  return [`All registration changes in the 24 hours up to 8 PM IST on ${isoDate} are in the attached CSV.`, "", ...lines].join("\n");
}
