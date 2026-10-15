/** Post-event rating helpers (shared by /rate/:id and the wrap-up report). */

export const FEEDBACK_TAGS = ["Scheduling", "Umpiring", "Courts & venue", "Communication", "Format", "Atmosphere"] as const;

export interface FeedbackRow {
  rating: number;
  tags: string[] | null;
  comment: string | null;
}

export interface FeedbackSummary {
  count: number;
  average: number | null;
  /** index 0 = 1 star … index 4 = 5 stars */
  distribution: number[];
  tags: { tag: string; count: number }[];
  comments: string[];
}

export function summariseFeedback(rows: FeedbackRow[]): FeedbackSummary {
  const distribution = [0, 0, 0, 0, 0];
  const tagCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;
    for (const t of r.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const count = rows.length;
  return {
    count,
    average: count ? rows.reduce((s, r) => s + r.rating, 0) / count : null,
    distribution,
    tags: Array.from(tagCounts, ([tag, c]) => ({ tag, count: c })).sort((a, b) => b.count - a.count),
    comments: rows.map((r) => r.comment?.trim()).filter((c): c is string => !!c),
  };
}
