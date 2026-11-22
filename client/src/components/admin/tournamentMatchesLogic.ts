/**
 * Pure logic behind the admin Matches tab: score entry rules, the schedule
 * status flip, and the bulk order-of-play parser. Kept free of React so it can
 * be tested directly.
 */
import { toLocalDateTimeInput } from "@/lib/umpire/schedule";

/** Sets each side has won in a "21-15, 18-21" string; the side that reached a majority of `bestOfSets`, else null. */
export function autoWinnerFromSets(setsStr: string, bestOfSets: number): 1 | 2 | null {
  const sets = setsStr.split(",").map((s) => s.trim()).filter(Boolean);
  let t1 = 0, t2 = 0;
  for (const s of sets) {
    const [a, b] = s.split("-").map(Number);
    if (!isNaN(a) && !isNaN(b)) { if (a > b) t1++; else if (b > a) t2++; }
  }
  const needed = Math.ceil(bestOfSets / 2);
  if (t1 >= needed) return 1;
  if (t2 >= needed) return 2;
  return null;
}

/**
 * A finished badminton game under the event's rules: won at `pointsToWin`
 * by 2+, or past it by exactly 2 during deuce, or at the `goldenPoint` cap by
 * 1 or 2.
 */
export function isValidBadmintonGame(t1: number, t2: number, pointsToWin: number, goldenPoint: number): boolean {
  const win = Math.max(t1, t2);
  const lose = Math.min(t1, t2);
  if (win === pointsToWin && (win - lose) >= 2) return true;
  if (win > pointsToWin && win < goldenPoint && (win - lose) === 2) return true;
  if (win === goldenPoint && (win - lose) >= 1 && (win - lose) <= 2) return true;
  return false;
}

export interface SetInput {
  t1: string;
  t2: string;
}

export interface ScoreRules {
  bestOfSets: number;
  pointsToWin: number;
  goldenPoint: number;
}

export type EditScoreResult =
  | { ok: true; sets: string[]; score: string }
  | { ok: false; error: string };

/**
 * Validate the admin score editor. Half-filled rows are skipped, a 0-0 row is
 * allowed through, every other game must be a valid badminton score, and no
 * game may be entered after one side has already won the match.
 */
export function validateEditScore(setsData: SetInput[], rules: ScoreRules): EditScoreResult {
  const ptw = rules.pointsToWin;
  const gp = rules.goldenPoint;
  let t1Wins = 0;
  let t2Wins = 0;
  const needed = Math.ceil(rules.bestOfSets / 2);

  for (let i = 0; i < setsData.length; i++) {
    const s = setsData[i];
    if (s.t1 === "" || s.t2 === "") continue;

    if (t1Wins >= needed || t2Wins >= needed) {
      return { ok: false, error: `Invalid score: The match was already won in earlier sets. You cannot enter a score for set ${i + 1}.` };
    }

    const t1 = parseInt(s.t1, 10) || 0;
    const t2 = parseInt(s.t2, 10) || 0;

    const valid = isValidBadmintonGame(t1, t2, ptw, gp);
    if (t1 === 0 && t2 === 0) continue;

    if (!valid) {
      return { ok: false, error: `Invalid score in set ${i + 1}: ${t1}-${t2}. Enter a mathematically valid badminton score.` };
    }

    if (t1 > t2) t1Wins++;
    else if (t2 > t1) t2Wins++;
  }

  const setsArr = setsData
    .filter((s) => s.t1 !== "" && s.t2 !== "")
    .map((s) => `${s.t1}-${s.t2}`);
  if (!setsArr.length) return { ok: false, error: "Enter at least one set score" };
  return { ok: true, sets: setsArr, score: setsArr.join(", ") };
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

    if (existing) {
      if (court) existing.court = court;
      if (at) existing.at = at;
    } else {
      results.push({ matchCode, court, at, found, wrongCategory });
    }
  }
  return results;
}
