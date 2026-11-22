import { playerWon, sideOf, type ResultRow } from "@/lib/matchResult";
import { parseGames } from "@/lib/matchView";

/**
 * Form and clutch numbers for a player's profile Stats tab, from the rows of
 * fetchPlayerMatches (raw tournament_matches). Results go by winner_side, as
 * every W/L record does; walkovers count as results but have no games, so
 * they never count as sweeps or deciders.
 */

export type FormRow = ResultRow & {
  status?: string | null;
  score?: string | null;
  match_score?: string | null;
  sets_history?: unknown;
  ended_at?: string | null;
  scheduled_at?: string | null;
  created_at?: string | null;
};

export interface ProfileForm {
  /** Decided matches (a result is recorded and the player was in it). */
  decided: number;
  /** Up to the last 10 results, oldest first. */
  recent: Array<"W" | "L">;
  /** The run of identical results ending with the latest match. */
  streak: { result: "W" | "L"; count: number } | null;
  /** Longest run of wins ever. */
  bestWinStreak: number;
  /** Decided in the last 7 days. */
  thisWeek: { played: number; won: number };
  /** Wins without dropping a game, out of wins over two or more games. */
  sweeps: { won: number; of: number };
  /** Matches that went to a third game. */
  deciders: { played: number; won: number };
}

const DECIDED = new Set(["completed", "walkover", "confirmed"]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const timeOf = (m: FormRow) => {
  for (const iso of [m.ended_at, m.scheduled_at, m.created_at]) {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isNaN(t)) return t;
  }
  return 0;
};

const gamesOf = (m: FormRow) =>
  parseGames(
    Array.isArray(m.sets_history) ? (m.sets_history as string[]) : null,
    m.score ?? m.match_score ?? null,
  );

export function computeProfileForm(rows: readonly FormRow[], playerId: string, now = Date.now()): ProfileForm {
  const decided = rows
    .filter((m) => DECIDED.has((m.status ?? "").toLowerCase()))
    .map((m) => ({ m, won: playerWon(m, playerId), at: timeOf(m) }))
    .filter((r): r is { m: FormRow; won: boolean; at: number } => r.won !== null)
    .sort((a, b) => b.at - a.at);

  const week = decided.filter((r) => r.at > 0 && now - r.at <= WEEK_MS && r.at <= now);
  const sweeps = { won: 0, of: 0 };
  const deciders = { played: 0, won: 0 };

  for (const { m, won } of decided) {
    const games = gamesOf(m);
    if (games.length === 0) continue;
    const side = sideOf(m, playerId);
    // One-game rounds (early rounds to 30) can't be straight-game wins, so
    // they stay out of both counts.
    if (won && side && games.length >= 2) {
      sweeps.of++;
      const lostAGame = games.some((g) => (side === 1 ? g.side1 < g.side2 : g.side2 < g.side1));
      if (!lostAGame) sweeps.won++;
    }
    if (games.length >= 3) {
      deciders.played++;
      if (won) deciders.won++;
    }
  }

  let streak: ProfileForm["streak"] = null;
  if (decided.length > 0) {
    const latest = decided[0].won;
    let count = 0;
    while (count < decided.length && decided[count].won === latest) count++;
    streak = { result: latest ? "W" : "L", count };
  }
  let bestWinStreak = 0;
  let run = 0;
  for (const r of decided) {
    run = r.won ? run + 1 : 0;
    if (run > bestWinStreak) bestWinStreak = run;
  }

  return {
    decided: decided.length,
    recent: decided.slice(0, 10).map((r) => (r.won ? "W" : "L") as "W" | "L").reverse(),
    streak,
    bestWinStreak,
    thisWeek: { played: week.length, won: week.filter((r) => r.won).length },
    sweeps,
    deciders,
  };
}
