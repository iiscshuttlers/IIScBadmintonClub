/**
 * Pure logic behind useUmpireState: building the starting match (edit mode,
 * resumed live match, tournament pre-fill or a blank friendly), set history
 * edits, score-tap feedback and the start-match error messages. Kept free of
 * React and Supabase so it can be tested directly.
 */
import type { TournamentMatchForUmpire } from "@/components/umpire/UmpireTournamentTab";
import type { BwfMatchState, MatchEditState } from "@/types/umpire";

/** Tournament category code → scoring format. Unknown codes score as singles. */
export const FORMAT_BY_CATEGORY: Record<string, string> = {
  MS: "Singles", WS: "Singles", MD: "Doubles", WD: "Doubles", XD: "Doubles",
};

/**
 * A bracket team label is a single string like "Kriti Kalia & Deepak Kumar".
 * It used to be assigned wholesale to p1Name with p2Name hardcoded to "", so a
 * doubles pair rendered as one long truncated line and the second player was
 * invisible everywhere downstream.
 */
export function splitTeamLabel(label: string | null | undefined): [string, string] {
  const parts = (label ?? "").split(/\s*[&,]\s*/).map((s) => s.trim()).filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
}

/** Games stored for a match being edited: sets_history, else parsed from the display score. */
export function editModeSets(editState: Pick<MatchEditState, "sets_history" | "score" | "match_score">): string[] {
  // Prefer structured sets_history stored in DB; fall back to parsing the
  // display string only for matches saved before this column existed.
  if (editState.sets_history && editState.sets_history.length > 0) {
    return editState.sets_history;
  }
  const rawScore = editState.score || editState.match_score || "";
  const setsPartMatch = rawScore.match(/^([\d-]+(?:, [\d-]+)*)/);
  return setsPartMatch ? setsPartMatch[1].split(", ") : [];
}

export interface InitialMatchInput {
  initialMatchState?: BwfMatchState | MatchEditState | null;
  tournamentMatch?: TournamentMatchForUmpire | null;
  userId: string;
  userName: string;
  /** Id for a match that has none yet. */
  newId?: () => string;
}

/** The match the umpire screen starts on when the store has none. */
export function buildInitialUmpireMatch({
  initialMatchState,
  tournamentMatch,
  userId,
  userName,
  newId = () => crypto.randomUUID(),
}: InitialMatchInput): BwfMatchState {
  if (initialMatchState && 'is_edit_mode' in initialMatchState && initialMatchState.is_edit_mode) {
    const editState = initialMatchState as MatchEditState;
    const setsHistory = editModeSets(editState);

    // Count actual set wins from setsHistory rather than hardcoding 2
    const t1GamesWon = setsHistory.filter(s => {
      const [a, b] = s.split("-").map(Number);
      return a > b;
    }).length;
    const t2GamesWon = setsHistory.filter(s => {
      const [a, b] = s.split("-").map(Number);
      return b > a;
    }).length;
    const t1Names = (editState.team1_label || "").split(" & ");
    const t2Names = (editState.team2_label || "").split(" & ");

    return {
      id: editState.id || newId(),
      dbId: editState.id,
      umpireId: userId,
      umpireName: userName,
      isFriendly: editState.is_friendly ?? true,
      isTournamentMatch: editState.is_tournament_match,
      matchNumber: editState.round ?? "",
      category: editState.category ?? "Singles",
      pointsToWin: 21,
      bestOfSets: 3,
      goldenPoint: 30,
      t1: {
        p1Id: editState.player1_id,
        p1Name: editState.player1?.full_name || t1Names[0] || "Team 1",
        p2Id: editState.team1_partner_id ?? undefined,
        p2Name: editState.partner1?.full_name || t1Names[1] || "",
        score: 0,
        games: t1GamesWon
      },
      t2: {
        p1Id: editState.player2_id,
        p1Name: editState.player2?.full_name || t2Names[0] || "Team 2",
        p2Id: editState.team2_partner_id ?? undefined,
        p2Name: editState.partner2?.full_name || t2Names[1] || "",
        score: 0,
        games: t2GamesWon
      },
      serverTeam: 1,
      serverPlayerIndex: 0,
      receiverPlayerIndex: 0,
      t1LastServedBy: 1,
      t2LastServedBy: 1,
      endsSwapped: false,
      pointLog: [],
      status: "finished",
      winner: t1GamesWon > t2GamesWon ? 1 : t2GamesWon > t1GamesWon ? 2 : undefined,
      setsHistory: setsHistory,
    } as BwfMatchState;
  }
  // Resume / take over a full live match (BwfMatchState saved in site_data).
  // Keep its own `id` (the persistence key) so updates write back to the same broadcast.
  if (initialMatchState && 'status' in initialMatchState && initialMatchState.status && 't1' in initialMatchState) {
    const liveState = initialMatchState as BwfMatchState;
    return {
      ...liveState,
      id: liveState.id || userId,
      umpireId: liveState.umpireId || userId,
      umpireName: liveState.umpireName || userName,
    } as BwfMatchState;
  }
  // Tournament match pre-fill — skip player-search setup, go straight to server selection
  if (tournamentMatch) {
    const isT1Bye = (tournamentMatch.team1_label || "").toUpperCase().includes("BYE");
    const isT2Bye = (tournamentMatch.team2_label || "").toUpperCase().includes("BYE");
    const isByeMatch = isT1Bye || isT2Bye;
    const byeWinner: 1 | 2 = isT1Bye ? 2 : 1;

    const isDoublesCat = (FORMAT_BY_CATEGORY[tournamentMatch.category] ?? "Singles") === "Doubles";
    const [t1n1, t1n2] = splitTeamLabel(tournamentMatch.team1_label);
    const [t2n1, t2n2] = splitTeamLabel(tournamentMatch.team2_label);

    return {
      id: tournamentMatch.id || newId(),
      umpireId: userId,
      umpireName: userName,
      isFriendly: false,
      isTournamentMatch: true,
      tournamentId: tournamentMatch.tournament_id,
      matchNumber: tournamentMatch.match_code,
      category: FORMAT_BY_CATEGORY[tournamentMatch.category] ?? "Singles",
      pointsToWin: tournamentMatch.points_to_win,
      bestOfSets: tournamentMatch.best_of_sets,
      goldenPoint: tournamentMatch.golden_point,
      t1: {
        p1Id: tournamentMatch.player1_id ?? "",
        p1Name: t1n1 || tournamentMatch.team1_label || "Team 1",
        p2Id: tournamentMatch.player3_id ?? undefined,
        p2Name: isDoublesCat ? t1n2 : "",
        score: 0,
        games: isByeMatch && byeWinner === 1 ? 2 : 0,
      },
      t2: {
        p1Id: tournamentMatch.player2_id ?? "",
        p1Name: t2n1 || tournamentMatch.team2_label || "Team 2",
        p2Id: tournamentMatch.player4_id ?? undefined,
        p2Name: isDoublesCat ? t2n2 : "",
        score: 0,
        games: isByeMatch && byeWinner === 2 ? 2 : 0,
      },
      serverTeam: 1,
      serverPlayerIndex: 0,
      receiverPlayerIndex: 0,
      t1LastServedBy: 1,
      t2LastServedBy: 1,
      endsSwapped: false,
      pointLog: [],
      status: isByeMatch ? "finished" : "setup",
      winner: isByeMatch ? byeWinner : undefined,
      setsHistory: isByeMatch ? ["BYE"] : [],
    };
  }

  return {
    id: newId(),
    umpireId: userId,
    umpireName: userName,
    isFriendly: true,
    matchNumber: "",
    category: "Singles",
    pointsToWin: 21,
    bestOfSets: 3,
    goldenPoint: 30,
    t1: { p1Id: "", p1Name: "", score: 0, games: 0 },
    t2: { p1Id: "", p1Name: "", score: 0, games: 0 },
    serverTeam: 1,
    serverPlayerIndex: 0,
    receiverPlayerIndex: 0,
    t1LastServedBy: 1,
    t2LastServedBy: 1,
    endsSwapped: false,
    pointLog: [],
    status: "setup",
    setsHistory: [],
  };
}

/**
 * At 0-0 the server stands in the right service court, and the chosen
 * receiver stands in theirs. Seed court positions from that so serve and
 * receive stay correct for the rest of the game.
 */
export function startingRightCourts(match: Pick<BwfMatchState, "serverTeam" | "serverPlayerIndex" | "receiverPlayerIndex">): { t1RightCourt: 0 | 1; t2RightCourt: 0 | 1 } {
  return {
    t1RightCourt: (match.serverTeam === 1 ? match.serverPlayerIndex : match.receiverPlayerIndex) as 0 | 1,
    t2RightCourt: (match.serverTeam === 2 ? match.serverPlayerIndex : match.receiverPlayerIndex) as 0 | 1,
  };
}

type SetsMatch = Pick<BwfMatchState, "setsHistory" | "t1" | "t2">;

/** Games each side keeps after removing one finished game. */
function gamesWithout(match: SetsMatch, removedSet: string): { t1Games: number; t2Games: number; s1: number; s2: number } {
  const [s1, s2] = removedSet.split("-").map(Number);
  let t1Games = match.t1.games;
  let t2Games = match.t2.games;
  if (s1 > s2) t1Games = Math.max(0, t1Games - 1);
  else if (s2 > s1) t2Games = Math.max(0, t2Games - 1);
  return { t1Games, t2Games, s1, s2 };
}

/** Undo the last game's finish: back into play at that game's final score. Null when no game has finished. */
export function undoLastSetUpdates(match: SetsMatch): Partial<BwfMatchState> | null {
  if (match.setsHistory.length === 0) return null;
  const history = [...match.setsHistory];
  const lastSet = history.pop()!;
  const { t1Games, t2Games, s1, s2 } = gamesWithout(match, lastSet);
  return {
    status: "playing",
    winner: undefined,
    retiredTeam: undefined,
    setsHistory: history,
    t1: { ...match.t1, score: s1, games: t1Games },
    t2: { ...match.t2, score: s2, games: t2Games },
  };
}

/** Remove one finished game; the current game's score is untouched. Null for an index out of range. */
export function deleteSetUpdates(match: SetsMatch, index: number): Partial<BwfMatchState> | null {
  if (index < 0 || index >= match.setsHistory.length) return null;
  const history = [...match.setsHistory];
  const removedSet = history.splice(index, 1)[0];
  const { t1Games, t2Games } = gamesWithout(match, removedSet);
  return {
    setsHistory: history,
    t1: { ...match.t1, games: t1Games },
    t2: { ...match.t2, games: t2Games },
    status: "playing",
    winner: undefined,
    retiredTeam: undefined,
  };
}

/**
 * Reopen game `index` at its final score; every later game is dropped and
 * games won are recounted from the ones before it. Null for an index out of range.
 */
export function reopenSetUpdates(match: SetsMatch, index: number): Partial<BwfMatchState> | null {
  if (index < 0 || index >= match.setsHistory.length) return null;
  const history = [...match.setsHistory];
  const setToReopen = history[index];
  const [s1, s2] = setToReopen.split("-").map(Number);

  const newHistory = history.slice(0, index);

  let newT1Games = 0;
  let newT2Games = 0;
  newHistory.forEach(setStr => {
    const [gs1, gs2] = setStr.split("-").map(Number);
    if (gs1 > gs2) newT1Games++;
    else if (gs2 > gs1) newT2Games++;
  });

  return {
    status: "playing",
    winner: undefined,
    retiredTeam: undefined,
    setsHistory: newHistory,
    t1: { ...match.t1, score: s1, games: newT1Games },
    t2: { ...match.t2, score: s2, games: newT2Games },
  };
}

type ScoreMatch = Pick<BwfMatchState, "t1" | "t2" | "pointsToWin" | "category">;
type ScoreUpdates = Partial<Pick<BwfMatchState, "t1" | "t2" | "status" | "winner">>;

/** First to reach half the game's points (11 in a 21-point game) while the other side is below it. */
function reachedHalf(match: ScoreMatch, updates: ScoreUpdates): boolean {
  const half = Math.ceil((match.pointsToWin || 30) / 2);
  const newT1 = updates.t1?.score ?? match.t1.score;
  const newT2 = updates.t2?.score ?? match.t2.score;
  return ((newT1 === half && newT2 < half) || (newT2 === half && newT1 < half)) &&
    match.t1.score < half && match.t2.score < half;
}

const gameJustWon = (match: ScoreMatch, updates: ScoreUpdates) =>
  (updates.t1?.games ?? match.t1.games) > match.t1.games ||
  (updates.t2?.games ?? match.t2.games) > match.t2.games;

/** Which sound/haptic a scored rally gets. */
export function pointFeedback(match: ScoreMatch, updates: ScoreUpdates): "matchWon" | "milestone" | "point" {
  if (updates.status === "finished" || !!updates.winner) return "matchWon";
  if (gameJustWon(match, updates) || reachedHalf(match, updates)) return "milestone";
  return "point";
}

/** The club-wide alert pushed at the half-time interval or when a game is won; null otherwise. */
export function scoreAlertMessage(match: ScoreMatch, updates: ScoreUpdates): string | null {
  const isSetWon = gameJustWon(match, updates);
  if (!reachedHalf(match, updates) && !isSetWon) return null;

  const newT1Score = updates.t1?.score ?? match.t1.score;
  const newT2Score = updates.t2?.score ?? match.t2.score;
  const t1Games = updates.t1?.games ?? match.t1.games;
  const t1Name = match.t1.p2Name ? `${match.t1.p1Name} & ${match.t1.p2Name}` : match.t1.p1Name;
  const t2Name = match.t2.p2Name ? `${match.t2.p1Name} & ${match.t2.p2Name}` : match.t2.p1Name;
  const scoreStr = isSetWon
    ? `Set won by ${t1Games > match.t1.games ? t1Name : t2Name}!`
    : `Half-time interval!`;
  const fullScore = `${t1Name} [${newT1Score} - ${newT2Score}] ${t2Name}`;
  return `🏆 ${match.category} Match: ${scoreStr} ${fullScore}`;
}

/** Toast for a refused tournament start, from the RPC's "code: detail" error. */
export function startErrorToast(message: string): { title: string; description?: string } {
  const detail = () => message.split(":").slice(1).join(":").trim();
  if (message.includes("court_in_use:") || message.includes("court_conflict:")) {
    return { title: "Court is not available", description: detail() };
  }
  if (message.includes("player_in_use:")) return { title: "A player is already on court", description: detail() };
  if (message.includes("player_rest_conflict:")) return { title: "Minimum rest has not elapsed", description: detail() };
  if (message.includes("match_schedule_changed:")) return { title: "Schedule changed", description: "Refresh the match list before starting." };
  if (message.includes("scorer_locked:")) {
    return { title: "Another scorer is active", description: "Ask the referee to review the assignment before taking over." };
  }
  return { title: message };
}

/** Who serves and receives right now, and the score from the server's side. */
export function serveInfo(match: Pick<BwfMatchState, "t1" | "t2" | "serverTeam" | "serverPlayerIndex" | "receiverPlayerIndex">) {
  const currentGameNum = match.t1.games + match.t2.games + 1;
  const serverScore = match.serverTeam === 1 ? match.t1.score : match.t2.score;
  const receiverScore = match.serverTeam === 1 ? match.t2.score : match.t1.score;
  const serverName = match.serverTeam === 1
    ? (match.t1.p2Name && match.serverPlayerIndex === 1 ? match.t1.p2Name : match.t1.p1Name)
    : (match.t2.p2Name && match.serverPlayerIndex === 1 ? match.t2.p2Name : match.t2.p1Name);
  const receiverName = match.serverTeam === 1
    ? (match.t2.p2Name && match.receiverPlayerIndex === 1 ? match.t2.p2Name : match.t2.p1Name)
    : (match.t1.p2Name && match.receiverPlayerIndex === 1 ? match.t1.p2Name : match.t1.p1Name);
  // A tournament pair often has only a name for the partner (never linked to
  // a player record), so p2Id alone reports doubles as singles.
  const isDoubles = !!(match.t1.p2Id || match.t1.p2Name || match.t2.p2Id || match.t2.p2Name);
  return { currentGameNum, serverScore, receiverScore, serverName, receiverName, isDoubles };
}
