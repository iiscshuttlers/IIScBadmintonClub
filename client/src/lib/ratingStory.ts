/**
 * Ranking stories from recorded rating history (WP8).
 *
 * Source of truth: `elo_calculation_logs` rows (dated, per player, per match),
 * written by the scoring functions. Nothing here estimates or back-fills
 * history: movement, recent contributions and career best are shown only
 * when logged evidence exists, and a mismatch between the latest logged
 * rating and the current rating (e.g. after an administrator recalculation)
 * is reported instead of hidden.
 *
 * Buckets mirror the database rule (submit_tournament_match):
 *   category ILIKE '%Singles%' or MS/WS/BS/GS/S  → singles_elo
 *   category ILIKE '%Doubles%' or MD/WD/BD/GD/D  → doubles_elo
 *   anything else (XD, Mixed)                    → mixed_elo
 */

export type RatingBucket = "singles" | "doubles" | "mixed";

export function ratingBucket(category: string | null | undefined): RatingBucket {
  const c = (category ?? "").trim();
  const u = c.toUpperCase();
  if (/singles/i.test(c) || ["MS", "WS", "BS", "GS", "S", "SINGLES"].includes(u)) return "singles";
  if (/doubles/i.test(c) || ["MD", "WD", "BD", "GD", "D", "DOUBLES"].includes(u)) return "doubles";
  return "mixed";
}

export const BUCKET_LABEL: Record<RatingBucket, string> = {
  singles: "Singles",
  doubles: "Doubles",
  mixed: "Mixed doubles (XD)",
};

export interface EloLogRow {
  id: string;
  category: string | null;
  created_at: string | null;
  elo_change: number | null;
  new_elo: number | null;
  previous_elo: number | null;
  match_uuid: string | null;
}

export interface RatingContribution {
  id: string;
  date: string;
  change: number;
  newRating: number | null;
  matchId: string | null;
}

export interface BucketStory {
  bucket: RatingBucket;
  current: number | null;
  /** Number of logged rating changes. */
  logged: number;
  historyStart: string | null;
  /** Net change over the window; null when no logged change falls in it. */
  movement: number | null;
  movementWindowDays: number;
  recent: RatingContribution[];
  careerBest: { rating: number; date: string } | null;
  /** Latest logged rating differs from the current rating. */
  outOfStep: boolean;
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.NaN);

export function buildRatingStory(
  logs: EloLogRow[],
  current: Partial<Record<RatingBucket, number | null>>,
  opts: { now?: number; windowDays?: number; recent?: number } = {},
): BucketStory[] {
  const now = opts.now ?? Date.now();
  const windowDays = opts.windowDays ?? 30;
  const since = now - windowDays * 86_400_000;
  const take = opts.recent ?? 5;
  const buckets: RatingBucket[] = ["singles", "doubles", "mixed"];
  return buckets.map((bucket) => {
    const mine = logs
      .filter((l) => ratingBucket(l.category) === bucket && Number.isFinite(time(l.created_at)))
      .sort((a, b) => time(a.created_at) - time(b.created_at));
    const inWindow = mine.filter((l) => time(l.created_at) >= since);
    const movement = inWindow.length > 0 ? inWindow.reduce((s, l) => s + (l.elo_change ?? 0), 0) : null;
    let best: { rating: number; date: string } | null = null;
    for (const l of mine) {
      if (l.new_elo != null && (!best || l.new_elo > best.rating)) best = { rating: l.new_elo, date: l.created_at! };
    }
    const last = mine[mine.length - 1];
    const cur = current[bucket] ?? null;
    return {
      bucket,
      current: cur,
      logged: mine.length,
      historyStart: mine[0]?.created_at ?? null,
      movement,
      movementWindowDays: windowDays,
      recent: mine
        .slice(-take)
        .reverse()
        .map((l) => ({ id: l.id, date: l.created_at!, change: l.elo_change ?? 0, newRating: l.new_elo, matchId: l.match_uuid })),
      careerBest: best,
      outOfStep: !!last && last.new_elo != null && cur != null && Math.round(last.new_elo) !== Math.round(cur),
    };
  });
}

export const RATING_POLICY_TEXT = [
  "Ratings are individual. In doubles, each player's own rating moves by the change for their side; a pair has a won–lost record, not a shared rating.",
  "Singles, doubles and mixed doubles (XD) are rated separately. The overall rating combines them, weighted by matches played.",
  "Only confirmed friendlies and completed results in tournaments that count for club Elo change ratings. Walkovers, pending, disputed and cancelled matches do not.",
  "Badminton matches cannot end level, so there is no tie rule. When a result is corrected, ranked winner changes need an administrator recalculation; until then the rating stays as recorded, and a recalculation can make the latest logged change differ from the current rating.",
];
