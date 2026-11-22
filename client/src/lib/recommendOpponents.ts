import { parseWinLossRecord } from "@/lib/playerUtils";
import type { PlayerRow } from "@/types";

/**
 * How far (in overall rating points) an opponent may sit from you. If nobody
 * qualifies inside it, the search widens to twice the band, then to anyone.
 */
export const RECOMMEND_RATING_BAND = 150;
/** How many opponents the directory shows. */
export const RECOMMEND_LIMIT = 4;
/**
 * Rated matches needed before a rating says anything about level. Ratings move
 * a few points per match, so most one-match players sit at 1193 or 1207 and
 * would "match" anyone near 1200. Same bar as MIN_MATCHES_FOR_PCT.
 */
export const RECOMMEND_MIN_MATCHES = 3;
/** Rating a player starts on before any rated match. */
const STARTING_RATING = 1200;

type Candidate = Pick<PlayerRow, "id" | "full_name" | "elo_rating" | "win_loss_record" | "status" | "is_retired" | "gender">;

export interface RecommendOptions {
  blockedIds: ReadonlySet<string>;
  /** Players who tapped "I'm available to play now" and haven't expired. */
  availableNowIds: { has(id: string): boolean };
  band?: number;
  limit?: number;
  minMatches?: number;
}

const ratingOf = (p: Pick<PlayerRow, "elo_rating">) => p.elo_rating || STARTING_RATING;

const matchesPlayed = (p: Pick<PlayerRow, "win_loss_record">) => {
  const { wins, losses } = parseWinLossRecord(p.win_loss_record);
  return wins + losses;
};

/**
 * Profile statuses that mean "not up for a game". NULL (not set, the default)
 * isn't one: it says nothing either way, so those players can still be
 * suggested by rating. Only the live toggle claims someone is free now.
 */
const UNAVAILABLE_STATUSES: ReadonlySet<string> = new Set(["playing", "resting", "injured"]);
const notMarkedUnavailable = (p: Pick<PlayerRow, "status">) => !p.status || !UNAVAILABLE_STATUSES.has(p.status);

const genderKey = (g: string | null | undefined) => (g || "").trim().toLowerCase();

/**
 * Picks opponents for "Recommended Opponents" on the players directory.
 *
 * Eligible: not you, not blocked, not retired, the same recorded gender as you
 * (singles opponents; players with no gender recorded are left out, and if
 * yours isn't recorded nobody is filtered), enough rated matches for the
 * rating to mean something, within the rating band, and either available
 * right now (the timed toggle) or not marked unavailable on their profile.
 * When nobody is inside the band, the band steps out (×2, then no limit) so a
 * player with no one near their rating still gets the nearest opponents;
 * `widened` says so, so the UI doesn't call them close.
 *
 * Order: available-right-now first, then the smallest rating gap, then more
 * matches played (a steadier rating), then name — never plain alphabetical.
 */
export function recommendOpponents<P extends Candidate>(
  players: readonly P[],
  me: Pick<PlayerRow, "id" | "elo_rating"> & Partial<Pick<PlayerRow, "gender">>,
  {
    blockedIds,
    availableNowIds,
    band = RECOMMEND_RATING_BAND,
    limit = RECOMMEND_LIMIT,
    minMatches = RECOMMEND_MIN_MATCHES,
  }: RecommendOptions,
): { opponents: P[]; widened: boolean } {
  const myRating = ratingOf(me);
  const myGender = genderKey(me.gender);
  const eligible = players
    .filter((p) => p.id !== me.id && !blockedIds.has(p.id) && !p.is_retired)
    .filter((p) => !myGender || genderKey(p.gender) === myGender)
    .map((p) => ({ p, gap: Math.abs(ratingOf(p) - myRating), played: matchesPlayed(p), now: availableNowIds.has(p.id) }))
    .filter(({ p, played, now }) => played >= minMatches && (now || notMarkedUnavailable(p)));

  for (const reach of [band, band * 2, Infinity]) {
    const inReach = eligible.filter(({ gap }) => gap <= reach);
    if (inReach.length === 0) continue;
    const opponents = inReach
      .sort(
        (a, b) =>
          Number(b.now) - Number(a.now) ||
          a.gap - b.gap ||
          b.played - a.played ||
          (a.p.full_name || "").localeCompare(b.p.full_name || ""),
      )
      .slice(0, limit)
      .map(({ p }) => p);
    return { opponents, widened: reach > band };
  }
  return { opponents: [], widened: false };
}
