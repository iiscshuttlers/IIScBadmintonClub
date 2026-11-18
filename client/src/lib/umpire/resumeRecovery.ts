import type { BwfMatchState, PointLogEntry } from "@/types/umpire";

const CAT_MAP: Record<string, string> = {
  MS: "Singles", WS: "Singles", MD: "Doubles", WD: "Doubles", XD: "Doubles",
};

/** A bracket label is one string: "Kriti Kalia & Deepak Kumar". */
function splitLabel(label: string | null | undefined): [string, string] {
  const parts = (label ?? "").split(/\s*[&,]\s*/).map(s => s.trim()).filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
}

export type TournamentScoreRow = {
  score: string | null;
  sets_history: string[] | null;
};

export type TournamentRowForRecovery = {
  id: string;
  category: string;
  match_code: string;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  team1_label: string | null;
  team2_label: string | null;
};

/**
 * Split a tournament row's stored score into completed games and the game in
 * progress. `sets_history` is written as the completed sets plus the running
 * score, so its last entry is the current game unless the game is at 0-0.
 */
export function splitSets(row: TournamentScoreRow): { completed: string[]; current: [number, number] } {
  const sets = row.sets_history ?? [];
  const current = row.score ?? "0-0";
  const [a, b] = current.split("-").map(Number);
  const currentPair: [number, number] = [
    Number.isFinite(a) ? a : 0,
    Number.isFinite(b) ? b : 0,
  ];
  const hasRunningGame = currentPair[0] !== 0 || currentPair[1] !== 0;
  const completed = hasRunningGame && sets[sets.length - 1] === current ? sets.slice(0, -1) : sets;
  return { completed, current: currentPair };
}

/**
 * Restore the point log from the server copy (tournament_match_point_logs,
 * compact `[game, side, t1, t2, server, ts]` entries) — but only when it
 * agrees with the tournament row: same number of completed games and the
 * same running score at its last entry. Otherwise null (partial recovery).
 * Entries carry no `prev` serve snapshot, so undo falls back to score-only.
 */
export function restorePointLog(
  stored: unknown,
  completedGames: number,
  current: [number, number],
): { pointLog: PointLogEntry[]; serverTeam: 1 | 2 } | null {
  if (!Array.isArray(stored) || stored.length === 0) return null;
  const log: PointLogEntry[] = [];
  for (const e of stored) {
    if (!Array.isArray(e) || e.length < 5) return null;
    const [game, side, t1, t2, server, ts] = e.map(Number);
    if (![game, side, t1, t2, server].every(Number.isFinite)) return null;
    log.push({
      gameNum: game,
      team: side === 1 ? 1 : side === 2 ? 2 : "let",
      t1Score: t1,
      t2Score: t2,
      serverTeam: server === 2 ? 2 : 1,
      ts: Number.isFinite(ts) ? ts : 0,
    });
  }
  const last = log[log.length - 1];
  if (last.gameNum !== completedGames + 1) return null;
  if (last.t1Score !== current[0] || last.t2Score !== current[1]) return null;
  return { pointLog: log, serverTeam: last.serverTeam };
}

/**
 * Rebuild a playable match from what the tournament row still records, for a
 * match whose live snapshot is gone. Scores and games survive in the row;
 * the point log and serve state do not, so the serve is reset and the umpire
 * has to confirm it.
 */
export function recoverMatchFromTournamentRow(
  row: TournamentRowForRecovery,
  scores: TournamentScoreRow,
  umpire: { id: string; name: string },
  storedPoints?: unknown,
): BwfMatchState {
  const { completed, current } = splitSets(scores);
  const restored = restorePointLog(storedPoints, completed.length, current);

  const gamesOf = (side: 0 | 1) =>
    completed.filter(s => {
      const [x, y] = s.split("-").map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      return side === 0 ? x > y : y > x;
    }).length;

  const category = CAT_MAP[row.category] ?? "Singles";
  const isDoubles = category === "Doubles";
  const [t1n1, t1n2] = splitLabel(row.team1_label);
  const [t2n1, t2n2] = splitLabel(row.team2_label);

  return {
    id: row.id,
    umpireId: umpire.id,
    umpireName: umpire.name,
    isFriendly: false,
    isTournamentMatch: true,
    matchNumber: row.match_code,
    category,
    pointsToWin: row.points_to_win,
    bestOfSets: row.best_of_sets,
    goldenPoint: row.golden_point,
    t1: {
      p1Id: row.player1_id ?? "",
      p1Name: t1n1 || row.team1_label || "Team 1",
      p2Id: row.player3_id ?? undefined,
      p2Name: isDoubles ? t1n2 : "",
      score: current[0],
      games: gamesOf(0),
    },
    t2: {
      p1Id: row.player2_id ?? "",
      p1Name: t2n1 || row.team2_label || "Team 2",
      p2Id: row.player4_id ?? undefined,
      p2Name: isDoubles ? t2n2 : "",
      score: current[1],
      games: gamesOf(1),
    },
    // Serve state is not stored on the tournament row. Start from the standard
    // opening line-up; the umpire corrects it from Settings if it is wrong.
    // The stored log knows which side served last; the player index is not stored.
    serverTeam: restored?.serverTeam ?? 1,
    serverPlayerIndex: 0,
    receiverPlayerIndex: 0,
    t1RightCourt: 0,
    t2RightCourt: 0,
    t1LastServedBy: 1,
    t2LastServedBy: 1,
    // Ends change after every completed game.
    endsSwapped: completed.length % 2 === 1,
    pointLog: restored?.pointLog ?? [],
    status: "playing",
    setsHistory: completed,
  } as BwfMatchState;
}
