import { compareSides, rowDiscipline, type ComparisonResult, type ComparisonRow, type ComparisonSide } from "@/lib/comparison";
import type { Discipline } from "@/lib/tournamentRoutes";

/**
 * Format-level head-to-head for the players directory: one comparison per
 * format (Singles = MS+WS, Doubles = MD+WD, Mixed = XD) on top of the shared
 * WP8 rules in lib/comparison, so totals match /h2h and the profile widget.
 */

export const H2H_FORMATS = ["All", "Singles", "Doubles", "Mixed"] as const;
export type H2HFormat = (typeof H2H_FORMATS)[number];

export function formatOfDiscipline(d: Discipline | null): Exclude<H2HFormat, "All"> | null {
  if (d === "MS" || d === "WS") return "Singles";
  if (d === "MD" || d === "WD") return "Doubles";
  if (d === "XD") return "Mixed";
  return null;
}

export const formatOfRow = (row: ComparisonRow) => formatOfDiscipline(rowDiscipline(row));

export function rowsInFormat(rows: readonly ComparisonRow[], format: H2HFormat): ComparisonRow[] {
  return format === "All" ? [...rows] : rows.filter((r) => formatOfRow(r) === format);
}

/** compareSides for every format at once. */
export function compareByFormat(rows: readonly ComparisonRow[], a: ComparisonSide, b: ComparisonSide): Record<H2HFormat, ComparisonResult> {
  const out = {} as Record<H2HFormat, ComparisonResult>;
  for (const f of H2H_FORMATS) out[f] = compareSides(rowsInFormat(rows, f), a, b);
  return out;
}

/**
 * Partners of players `a` and `b` the last time they met on opposite sides of
 * a doubles match (within `format`), to prefill a pair comparison. With
 * `withAPartner`, only meetings where `a` played alongside that partner.
 */
export function latestPartners(
  rows: readonly ComparisonRow[],
  a: string,
  b: string,
  format: H2HFormat,
  withAPartner?: string,
): { aPartner: string; bPartner: string } | null {
  const { meetings } = compareSides(rowsInFormat(rows, format), { ids: [a] }, { ids: [b] });
  for (const m of meetings) {
    if (m.eligibility === "excluded") continue;
    const aIds = m.aSide === 1 ? m.row.side1 : m.row.side2;
    const bIds = m.aSide === 1 ? m.row.side2 : m.row.side1;
    const aPartner = aIds.find((id) => id !== a);
    const bPartner = bIds.find((id) => id !== b);
    if (withAPartner && aPartner !== withAPartner) continue;
    if (aPartner && bPartner) return { aPartner, bPartner };
  }
  return null;
}

type Rated = {
  elo_rating?: number | null;
  singles_elo?: number | null;
  doubles_elo?: number | null;
  mixed_elo?: number | null;
};

const FORMAT_RATING: Record<H2HFormat, keyof Rated> = {
  All: "elo_rating",
  Singles: "singles_elo",
  Doubles: "doubles_elo",
  Mixed: "mixed_elo",
};

/** A side's rating for the format: the mean over its players, 1200 when unknown. */
export function sideRating(players: readonly (Rated | null | undefined)[], format: H2HFormat): number {
  const known = players.filter((p): p is Rated => !!p);
  if (!known.length) return 1200;
  const key = FORMAT_RATING[format];
  const sum = known.reduce((s, p) => s + (p[key] ?? p.elo_rating ?? 1200), 0);
  return sum / known.length;
}

/** Elo expected score of A against B, as a whole percentage. */
export function winChancePct(ratingA: number, ratingB: number): number {
  return Math.round((1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))) * 100);
}

/** Points scored and longest winning runs over the counted meetings. */
export function pointsAndStreaks(result: ComparisonResult): { aPoints: number; bPoints: number; aBestRun: number; bBestRun: number } {
  let aPoints = 0;
  let bPoints = 0;
  let aRun = 0;
  let bRun = 0;
  let aBestRun = 0;
  let bBestRun = 0;
  const oldestFirst = result.meetings.filter((m) => m.eligibility === "counted").reverse();
  for (const m of oldestFirst) {
    if (m.aWon) {
      aRun++;
      bRun = 0;
      aBestRun = Math.max(aBestRun, aRun);
    } else {
      bRun++;
      aRun = 0;
      bBestRun = Math.max(bBestRun, bRun);
    }
    for (const game of (m.row.score ?? "").split(",")) {
      const [x, y] = game.split("-").map((n) => parseInt(n.trim(), 10));
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      if (m.aSide === 1) {
        aPoints += x;
        bPoints += y;
      } else {
        aPoints += y;
        bPoints += x;
      }
    }
  }
  return { aPoints, bPoints, aBestRun, bBestRun };
}
