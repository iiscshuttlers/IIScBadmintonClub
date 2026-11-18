/**
 * Player / pair comparison (WP8).
 *
 * Identity rules
 *  - A side is one player or one pair. A pair is identified by its two player
 *    IDs regardless of order (A+B = B+A); A+C is a different pair.
 *  - "Against" (head-to-head) and "together" (partners) are separate.
 *  - For a pair, only matches where exactly that pair formed one side count.
 *
 * Result policy (one rule for every surface)
 *  - Counted: friendly `confirmed`, tournament `completed`, with a winner.
 *  - Walkovers: listed and counted separately, never in won–lost.
 *  - Excluded (listed with the reason): pending/scheduled/in progress, disputed,
 *    cancelled/void, or a finished row with no recorded winner.
 *  - There is no retirement status in the data; a retirement recorded as a
 *    completed result with score text counts like any completed result.
 */

import { disciplineOf } from "@/lib/matchView";
import type { Discipline } from "@/lib/tournamentRoutes";

export interface ComparisonSide {
  /** 1 id = player, 2 ids = pair. */
  ids: string[];
}

export function canonicalSideIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((x): x is string => !!x).map((x) => x.trim().toLowerCase()).filter(Boolean))].sort();
}

export function pairKey(ids: Array<string | null | undefined>): string {
  return canonicalSideIds(ids).join("+");
}

export function sideKind(s: ComparisonSide): "player" | "pair" {
  return canonicalSideIds(s.ids).length >= 2 ? "pair" : "player";
}

export interface ComparisonRow {
  id: string;
  source: "friendly" | "tournament";
  status: string;
  /** 1/2 when known. */
  winnerSide: 1 | 2 | null;
  /** Fallback for friendly rows without winner_side. */
  winnerId: string | null;
  side1: string[];
  side2: string[];
  category: string | null;
  matchCode?: string | null;
  /** Genders by player ID, used to place friendly rows in a discipline. */
  genders?: Record<string, string | null | undefined>;
  date: string | null;
  score: string | null;
  round: string | null;
  event: string | null;
  tournamentId?: string | null;
}

export type Eligibility = "counted" | "walkover" | "excluded";

export interface ComparisonMeeting {
  row: ComparisonRow;
  /** Which match side side A was on. */
  aSide: 1 | 2;
  eligibility: Eligibility;
  /** Present when eligibility is counted/walkover. */
  aWon: boolean | null;
  excludedReason: string | null;
  discipline: Discipline | null;
}

export function winnerOf(row: ComparisonRow): 1 | 2 | null {
  if (row.winnerSide === 1 || row.winnerSide === 2) return row.winnerSide;
  if (row.winnerId) {
    if (row.side1.includes(row.winnerId)) return 1;
    if (row.side2.includes(row.winnerId)) return 2;
  }
  return null;
}

export function eligibilityOf(row: ComparisonRow): { eligibility: Eligibility; reason: string | null } {
  const s = (row.status ?? "").toLowerCase();
  if (s === "walkover") return { eligibility: "walkover", reason: null };
  const finished = row.source === "friendly" ? s === "confirmed" : s === "completed";
  if (!finished) {
    const reason =
      s === "disputed"
        ? "Disputed"
        : s === "cancelled" || s === "void" || s === "voided"
          ? "Cancelled"
          : "Not finished or not yet confirmed";
    return { eligibility: "excluded", reason };
  }
  if (winnerOf(row) == null) return { eligibility: "excluded", reason: "No winner recorded" };
  return { eligibility: "counted", reason: null };
}

/** Discipline of a row; friendly rows are placed by participant genders when known. */
export function rowDiscipline(row: ComparisonRow): Discipline | null {
  const direct = disciplineOf(row.category, row.matchCode ?? null);
  if (direct) return direct;
  const c = (row.category ?? "").toLowerCase();
  const players = [...row.side1, ...row.side2];
  const genders = players.map((id) => (row.genders?.[id] ?? "").toLowerCase());
  const known = genders.every((g) => g === "male" || g === "female");
  const allMale = known && genders.every((g) => g === "male");
  const allFemale = known && genders.every((g) => g === "female");
  const doubles = row.side1.length > 1 || row.side2.length > 1 || c.includes("double") || c.includes("mix");
  if (c.includes("mix")) return "XD";
  if (!doubles) return allMale ? "MS" : allFemale ? "WS" : null;
  if (allMale) return "MD";
  if (allFemale) return "WD";
  if (known) return "XD";
  return null;
}

function sideMatches(side: string[], target: ComparisonSide): boolean {
  const ids = canonicalSideIds(target.ids);
  const s = canonicalSideIds(side);
  if (ids.length >= 2) return pairKey(s) === pairKey(ids);
  return s.includes(ids[0]);
}

/** Where A and B appear in a row: against (with A's side), together, or not related. */
export function relation(row: ComparisonRow, a: ComparisonSide, b: ComparisonSide): { kind: "against"; aSide: 1 | 2 } | { kind: "together" } | null {
  if (sideMatches(row.side1, a) && sideMatches(row.side2, b)) return { kind: "against", aSide: 1 };
  if (sideMatches(row.side2, a) && sideMatches(row.side1, b)) return { kind: "against", aSide: 2 };
  if (sideKind(a) === "player" && sideKind(b) === "player") {
    for (const s of [row.side1, row.side2]) if (sideMatches(s, a) && sideMatches(s, b)) return { kind: "together" };
  }
  return null;
}

export interface ComparisonResult {
  meetings: ComparisonMeeting[];
  aWins: number;
  bWins: number;
  /** Counted results only — the sample size behind the won–lost figures. */
  sample: number;
  walkovers: { aWon: number; bWon: number };
  excluded: number;
  /** Last five counted meetings from A's point of view, newest first. */
  formA: ("W" | "L")[];
  together: { played: number; won: number; lost: number; meetings: ComparisonMeeting[] } | null;
}

const byDateDesc = (x: ComparisonMeeting, y: ComparisonMeeting) => (y.row.date ?? "").localeCompare(x.row.date ?? "");

export function compareSides(
  rows: ComparisonRow[],
  a: ComparisonSide,
  b: ComparisonSide,
  opts: { discipline?: Discipline | null; dateFrom?: string | null; dateTo?: string | null } = {},
): ComparisonResult {
  const seen = new Set<string>();
  const against: ComparisonMeeting[] = [];
  const together: ComparisonMeeting[] = [];
  for (const row of rows) {
    const key = `${row.source}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (opts.dateFrom && (!row.date || row.date < opts.dateFrom)) continue;
    if (opts.dateTo && (!row.date || row.date > opts.dateTo)) continue;
    const discipline = rowDiscipline(row);
    if (opts.discipline && discipline !== opts.discipline) continue;
    const rel = relation(row, a, b);
    if (!rel) continue;
    const { eligibility, reason } = eligibilityOf(row);
    const w = winnerOf(row);
    if (rel.kind === "against") {
      against.push({
        row,
        aSide: rel.aSide,
        eligibility,
        aWon: eligibility === "excluded" || w == null ? null : w === rel.aSide,
        excludedReason: reason,
        discipline,
      });
    } else {
      const aSide = sideMatches(row.side1, a) ? 1 : 2;
      together.push({
        row,
        aSide,
        eligibility,
        aWon: eligibility === "excluded" || w == null ? null : w === aSide,
        excludedReason: reason,
        discipline,
      });
    }
  }
  against.sort(byDateDesc);
  together.sort(byDateDesc);
  const counted = against.filter((m) => m.eligibility === "counted");
  const wo = against.filter((m) => m.eligibility === "walkover");
  const togetherCounted = together.filter((m) => m.eligibility === "counted");
  return {
    meetings: against,
    aWins: counted.filter((m) => m.aWon).length,
    bWins: counted.filter((m) => m.aWon === false).length,
    sample: counted.length,
    walkovers: { aWon: wo.filter((m) => m.aWon).length, bWon: wo.filter((m) => m.aWon === false).length },
    excluded: against.filter((m) => m.eligibility === "excluded").length,
    formA: counted.slice(0, 5).map((m) => (m.aWon ? "W" : "L")),
    together:
      sideKind(a) === "player" && sideKind(b) === "player"
        ? {
            played: togetherCounted.length,
            won: togetherCounted.filter((m) => m.aWon).length,
            lost: togetherCounted.filter((m) => m.aWon === false).length,
            meetings: together,
          }
        : null,
  };
}

/** Plain-language sample-size note; null when the sample is reasonable. */
export function sampleNote(sample: number): string | null {
  if (sample === 0) return "No counted meetings yet.";
  if (sample < 3) return `Based on only ${sample} counted ${sample === 1 ? "meeting" : "meetings"} — too few to read much into.`;
  return null;
}

export const RESULT_POLICY_TEXT =
  "Won–lost counts confirmed friendly results and completed tournament results that have a recorded winner. Walkovers are shown separately and never counted as wins or losses. Pending, in-progress, disputed and cancelled matches are listed but not counted. Retirements are counted as the result that was recorded.";
