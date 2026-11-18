/**
 * BWF-style rank movement (plan item 10) from `ranking_movement(list)`:
 * current club rank against the latest weekly snapshot at least 6 days old.
 */

export type RankList = "overall" | "singles" | "doubles" | "mixed";

export interface RankMovement {
  rank: number;
  previousRank: number | null;
  /** Positive = moved up. */
  delta: number | null;
  /** none = no comparison snapshot yet; new = first time ranked; re = re-entry. */
  status: "none" | "moved" | "new" | "re";
  since: string | null;
  peakRank: number | null;
}

export interface MovementLabel {
  text: string; // "▲3", "▼1", "–", "NEW", "RE"
  /** Full wording for screen readers and tooltips. */
  long: string;
  tone: "up" | "down" | "same" | "new" | "none";
}

function sinceText(since: string | null): string {
  if (!since) return "";
  const d = new Date(`${since}T12:00:00`);
  return ` since ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export function movementLabel(m: RankMovement | undefined | null): MovementLabel | null {
  if (!m || m.status === "none") return null;
  if (m.status === "new") return { text: "NEW", long: `New in the rankings${sinceText(m.since)}`, tone: "new" };
  if (m.status === "re") return { text: "RE", long: `Back in the rankings${sinceText(m.since)}`, tone: "new" };
  const d = m.delta ?? 0;
  if (d > 0) return { text: `▲${d}`, long: `Up ${d} ${d === 1 ? "place" : "places"}${sinceText(m.since)} (was ${m.previousRank})`, tone: "up" };
  if (d < 0) return { text: `▼${-d}`, long: `Down ${-d} ${d === -1 ? "place" : "places"}${sinceText(m.since)} (was ${m.previousRank})`, tone: "down" };
  return { text: "–", long: `No change${sinceText(m.since)}`, tone: "same" };
}

export function toMovementMap(
  rows: Array<{ player_id: string; rank: number; previous_rank: number | null; delta: number | null; status: string; since: string | null; peak_rank: number | null }>,
): Record<string, RankMovement> {
  const out: Record<string, RankMovement> = {};
  for (const r of rows) {
    const status = (["none", "moved", "new", "re"] as const).includes(r.status as RankMovement["status"]) ? (r.status as RankMovement["status"]) : "none";
    out[r.player_id] = {
      rank: r.rank,
      previousRank: r.previous_rank,
      delta: r.delta,
      status,
      since: r.since,
      peakRank: r.peak_rank,
    };
  }
  return out;
}
