/**
 * Pure logic behind the admin Matches tab: score entry rules, the schedule
 * status flip, and the bulk order-of-play parser. Kept free of React so it can
 * be tested directly.
 */
import { toLocalDateTimeInput } from "@/lib/umpire/schedule";
import { courtKey } from "@/lib/matchView";
import { checkMatchScore, type Game, type MatchRules } from "@/lib/badmintonScore";

// One rule set for every score screen: game validity comes from lib/badmintonScore.
export { isValidBadmintonGame } from "@/lib/badmintonScore";

/**
 * Winner of a "21-15, 18-21" score under the shared rules (checkMatchScore):
 * the side that took a majority of games, or null while the match is undecided
 * or any game isn't a possible score.
 */
export function autoWinnerFromSets(setsStr: string, rules: MatchRules): 1 | 2 | null {
  const games: Game[] = setsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split("-").map((p) => p.trim());
      return parts.length === 2 && parts[0] !== "" && parts[1] !== ""
        ? [Number(parts[0]), Number(parts[1])]
        : [NaN, NaN];
    });
  const check = checkMatchScore(games, rules);
  return check.ok ? check.winnerSide : null;
}

export interface SetInput {
  t1: string;
  t2: string;
}

export type EditScoreResult =
  | { ok: true; sets: string[]; score: string; winnerSide: 1 | 2 | null }
  | { ok: false; error: string };

/**
 * Validate the admin score editor against the shared rules (checkMatchScore).
 * Rows are read in order. A blank, half-filled or 0-0 row is a game that wasn't
 * played and is skipped, but a played game may not come after one. `winnerSide`
 * is the side the games decide, or null when the score is incomplete; an
 * incomplete score can only be saved as a retirement or concession, with the
 * winning side chosen by hand.
 */
export function validateEditScore(setsData: SetInput[], rules: MatchRules): EditScoreResult {
  const games: [number, number][] = [];
  let firstUnplayed: number | null = null;

  for (let i = 0; i < setsData.length; i++) {
    const a = setsData[i].t1.trim();
    const b = setsData[i].t2.trim();
    const t1 = Number(a);
    const t2 = Number(b);
    if (a === "" || b === "" || (t1 === 0 && t2 === 0)) {
      if (firstUnplayed === null) firstUnplayed = i;
      continue;
    }
    if (firstUnplayed !== null) {
      return { ok: false, error: `Fill in game ${firstUnplayed + 1} before game ${i + 1}.` };
    }
    if (Number.isNaN(t1) || Number.isNaN(t2)) {
      return { ok: false, error: `Game ${i + 1}: enter the points as whole numbers.` };
    }
    games.push([t1, t2]);
  }

  if (!games.length) return { ok: false, error: "Enter at least one set score" };
  const check = checkMatchScore(games, rules);
  if (check.ok === false) return { ok: false, error: check.error };
  const sets = games.map(([t1, t2]) => `${t1}-${t2}`);
  return { ok: true, sets, score: sets.join(", "), winnerSide: check.winnerSide };
}

/** A court as typed or stored: zero-width characters stripped and trimmed ("" when blank). */
export function cleanCourt(court: string | null | undefined): string {
  return (court ?? "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
}

/**
 * A bulk-typed court as stored: numbered courts take the preset form "C<n>"
 * ("3", "Court 3", "c03" -> "C3"), placeholders ("TBD", "Court") are blank and
 * other names pass through. Comparisons elsewhere use courtKey().
 */
export function bulkCourt(raw: string | null | undefined): string {
  const cleaned = cleanCourt(raw);
  const key = courtKey(cleaned);
  if (!key) return "";
  return /^\d+$/.test(key) ? `C${key}` : cleaned;
}

/**
 * Status after editing a match's court/time: a pending match that gets a
 * court or a time becomes scheduled; a scheduled match that loses both goes
 * back to pending; anything else is left alone.
 */
export function statusAfterScheduleEdit<S extends string | undefined>(
  status: S,
  at: string | null | undefined,
  court: string | null | undefined,
): S | "scheduled" | "pending" {
  if (status === "pending" && (at || court)) return "scheduled";
  if (status === "scheduled" && !at && !court) return "pending";
  return status;
}

/** Live first, finished last, everything else in between (keeps the incoming order within a band). */
export function roundListPriority(status: string): number {
  if (status === "in_progress" || status === "IN_PROGRESS") return 0;
  if (status === "completed" || status === "COMPLETED" || status === "walkover") return 2;
  return 1;
}

interface ScheduleMatch {
  match_code: string;
  category: string;
  round: number;
  match_number: number;
  team1_label: string | null;
  team2_label: string | null;
  court_number?: string | null;
  scheduled_at?: string | null;
}

/**
 * Rows (no header) of the CSV schedule template: one per non-bye match of the
 * category, in draw order. Date and time are local, because that is how the
 * upload (parseBulkSchedule) reads them back; slicing the stored UTC string
 * shifted every time by the UTC offset on a download → upload round trip.
 */
export function scheduleTemplateRows(matches: ScheduleMatch[], category: string): string[][] {
  return matches
    .filter((m) => m.category === category && m.team1_label !== "BYE" && m.team2_label !== "BYE")
    .sort((a, b) => a.round - b.round || a.match_number - b.match_number)
    .map((m) => {
      const local = toLocalDateTimeInput(m.scheduled_at); // "YYYY-MM-DDTHH:mm" or ""
      return [
        m.match_code,
        m.court_number ?? "",
        local ? local.slice(0, 10) : "",
        local ? local.slice(11, 16) : "",
      ];
    });
}

/**
 * Turn uploaded CSV rows (MatchCode, Court, Date, Time) into bulk-schedule
 * text lines. A first row that doesn't look like a match code is a header.
 */
export function csvRowsToBulkLines(rows: string[][]): string[] {
  const dataRows = rows[0]?.[0]?.match(/^[A-Z]+_/) ? rows : rows.slice(1);
  return dataRows
    .filter((r) => r[0])
    .map((r) => {
      const code = r[0].toUpperCase();
      const court = r[1] ?? "";
      const date = r[2] ?? "";
      const time = r[3] ?? "";
      const parts = [code];
      if (court) parts.push(`court=${court}`);
      if (date && time) parts.push(`date=${date} time=${time}`);
      else if (date) parts.push(`date=${date}`);
      return parts.join(" ");
    });
}

export interface BulkScheduleRow {
  matchCode: string;
  court: string;
  at: string;
  found: boolean;
  wrongCategory?: boolean;
}

/**
 * Parse the bulk order-of-play text. One match per line, in any of:
 *   MS_QF_01: Court 3, 2026-06-30 10:00
 *   MS_QF_02 court=4 date=2026-06-30 time=11:30
 *   MS_SF_01, Court 1, 30/06/2026 14:00
 * Lines starting with # or // are comments. A repeated code updates the
 * earlier row. Times are local and stored as ISO.
 */
export function parseBulkSchedule(
  text: string,
  matches: Pick<ScheduleMatch, "match_code" | "category">[],
  activeCategory: string,
): BulkScheduleRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: BulkScheduleRow[] = [];
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const matchCode = line.split(/[\s,:,\t]+/)[0].toUpperCase();
    if (!matchCode) continue;

    let court = "";
    let at = "";

    const kvCourt = line.match(/court\s*=\s*([^\s,]+)/i);
    const kvDate = line.match(/date\s*=\s*(\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4})/i);
    const kvTime = line.match(/time\s*=\s*(\d{1,2})(:\d{2})?(:\d{2})?/i);
    if (kvCourt) court = kvCourt[1];
    if (kvDate && kvTime) {
      let d = kvDate[1];
      if (d.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        const dParts = d.split(/[-\/]/);
        d = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
      }
      let t = kvTime[1].padStart(2, "0");
      t += kvTime[2] ? kvTime[2] : ":00";
      try {
        at = new Date(`${d}T${t}`).toISOString();
      } catch {
        /* intentional — fallback to local datetime string */
        at = `${d}T${t}`;
      }
    }

    if (!court || !at) {
      const courtMatch = line.match(/court\s*(\w+)/i);
      if (courtMatch) court = courtMatch[1];

      const isoDate = line.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/i);
      const dmy = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}:\d{2})/i);
      if (isoDate) {
        try { at = new Date(`${isoDate[1]}T${isoDate[2]}`).toISOString(); } catch { /* intentional */ at = `${isoDate[1]}T${isoDate[2]}`; }
      } else if (dmy) {
        try { at = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`).toISOString(); } catch { /* intentional */ at = `${dmy[3]}-${dmy[2]}-${dmy[1]}T${dmy[4]}`; }
      }
    }

    const match = matches.find((m) => m.match_code === matchCode);
    const found = !!match;
    const wrongCategory = match ? match.category !== activeCategory : false;
    const existing = results.find(r => r.matchCode === matchCode);

    court = bulkCourt(court);
    if (existing) {
      if (court) existing.court = court;
      if (at) existing.at = at;
    } else {
      results.push({ matchCode, court, at, found, wrongCategory });
    }
  }
  return results;
}

export interface BulkSchedulePatch {
  court_number?: string;
  scheduled_at?: string;
  status: string;
  reminder_sent: false;
}

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Number.isNaN(ta) || Number.isNaN(tb) ? a === b : ta === tb;
}

/**
 * What one bulk order-of-play row changes on a match, or null when it changes
 * nothing. The bulk formats have no way to clear a slot, so a court-only line
 * keeps the match's time and a time-only line keeps its court. Like the
 * single-match schedule edit, a change resets reminder_sent (so players are
 * reminded about the new slot) and moves the status with statusAfterScheduleEdit.
 * An unchanged row is left alone, so re-uploading the template doesn't re-send
 * reminders for slots that didn't move.
 */
export function bulkSchedulePatch(
  match: { status: string; court_number?: string | null; scheduled_at?: string | null },
  row: Pick<BulkScheduleRow, "court" | "at">,
): BulkSchedulePatch | null {
  const court = cleanCourt(row.court);
  // "1", "C1" and "Court 1" are one court: retyping it is not a change.
  const courtChanged = court !== "" && courtKey(court) !== courtKey(match.court_number);
  const atChanged = row.at !== "" && !sameInstant(row.at, match.scheduled_at);
  if (!courtChanged && !atChanged) return null;
  return {
    ...(courtChanged ? { court_number: court } : {}),
    ...(atChanged ? { scheduled_at: row.at } : {}),
    status: statusAfterScheduleEdit(match.status, row.at || match.scheduled_at, court || cleanCourt(match.court_number)),
    reminder_sent: false,
  };
}
