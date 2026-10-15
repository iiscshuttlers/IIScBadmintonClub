import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * "Add to calendar" — builds an RFC 5545 .ics file from tournament matches and
 * hands it to the OS (share sheet on Android, download on web). No email, no
 * server: the calendar app imports the file directly.
 */

export interface CalendarEvent {
  uid: string;
  start: Date;
  /** Minutes. Defaults to 45 (a typical best-of-3 slot). */
  durationMins?: number;
  /** All-day event spanning start..end (inclusive), e.g. a tournament. */
  allDay?: { end: Date };
  summary: string;
  description?: string;
  url?: string;
  /** Minutes before start to fire a calendar alarm. Omit for none. */
  alarmMins?: number;
}

const PRODID = "-//IIScShuttlers//Match Calendar//EN";

/** Escape TEXT values per RFC 5545 §3.3.11. */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

/** Fold content lines longer than 75 octets (RFC 5545 §3.1). */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    // First line holds 75 octets; continuation lines start with a space, so 74.
    const limit = out.length === 0 ? 75 : 74;
    if (curLen + len > limit) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC date-time, e.g. 20261015T093000Z. */
export function icsDateTime(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Floating DATE value (local calendar day), e.g. 20261015. */
function icsDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function buildIcs(events: CalendarEvent[], calName = "IISc Shuttlers", now = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${icsDateTime(now)}`);
    if (e.allDay) {
      const endExclusive = new Date(e.allDay.end);
      endExclusive.setDate(endExclusive.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start)}`, `DTEND;VALUE=DATE:${icsDate(endExclusive)}`);
    } else {
      const end = new Date(e.start.getTime() + (e.durationMins ?? 45) * 60_000);
      lines.push(`DTSTART:${icsDateTime(e.start)}`, `DTEND:${icsDateTime(end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.alarmMins != null && e.alarmMins > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcsText(e.summary)}`,
        `TRIGGER:-PT${Math.round(e.alarmMins)}M`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

const SITE = "https://iiscshuttlers.github.io/IIScBadmintonClub";

/** "C1" / "court 1" / "1" → "Court 1". Mirrors supabase/functions/_shared/courtQueue.ts. */
function courtLabel(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(?:c(?:ourt)?\s*)?(\d+)$/i);
  return m ? `Court ${m[1]}` : t;
}
const UPCOMING = new Set(["scheduled", "pending", "upcoming"]);

/** Minimal shape of a tournament_matches row needed for a calendar entry. */
export interface MatchLike {
  id: string;
  category?: string | null;
  round_name?: string | null;
  team1_label?: string | null;
  team2_label?: string | null;
  court_number?: string | number | null;
  scheduled_at?: string | null;
  status?: string | null;
  tournament_id?: string | null;
  tournaments?: { name?: string | null } | null;
}

/** Upcoming, timed matches only — completed or unscheduled ones can't go on a calendar. */
export function matchesToEvents(matches: MatchLike[], alarmMins = 30, now = new Date()): CalendarEvent[] {
  return matches
    .filter((m) => m.scheduled_at && UPCOMING.has((m.status || "scheduled").toLowerCase()))
    .filter((m) => new Date(m.scheduled_at!).getTime() > now.getTime() - 60 * 60_000)
    .map((m) => {
      const vs = `${m.team1_label || "TBD"} vs ${m.team2_label || "TBD"}`;
      const where = m.court_number ? ` · ${courtLabel(String(m.court_number))}` : "";
      const tName = m.tournaments?.name;
      return {
        uid: `match-${m.id}@iiscshuttlers`,
        start: new Date(m.scheduled_at!),
        summary: `🏸 ${m.category ? m.category + " · " : ""}${vs}${where}`,
        description: [tName, m.round_name, "Times can shift on the day — check the app for live updates."]
          .filter(Boolean)
          .join("\n"),
        url: m.tournament_id ? `${SITE}/tournaments/${m.tournament_id}` : undefined,
        alarmMins,
      };
    });
}

export function tournamentToEvent(t: {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
}): CalendarEvent | null {
  if (!t.start_date) return null;
  // DATE columns arrive as "YYYY-MM-DD"; parse as local midnight, not UTC.
  const parse = (s: string) => {
    const [y, mo, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y, mo - 1, d);
  };
  const start = parse(t.start_date);
  return {
    uid: `tournament-${t.id}@iiscshuttlers`,
    start,
    allDay: { end: t.end_date ? parse(t.end_date) : start },
    summary: `🏆 ${t.name}`,
    url: `${SITE}/tournaments/${t.id}`,
  };
}

/** Save the .ics and hand it to the OS. Returns false if there was nothing to export. */
export async function shareIcs(events: CalendarEvent[], fileBase: string, calName?: string): Promise<boolean> {
  if (events.length === 0) return false;
  const ics = buildIcs(events, calName);
  const fileName = `${fileBase.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "matches"}.ics`;

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: ics,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: "Add to calendar", files: [uri], dialogTitle: "Open with your calendar" });
    return true;
  }

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
