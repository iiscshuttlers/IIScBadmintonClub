import { ScoringLogic, type MatchFormat } from "./scoringLogic";
import type { BwfMatchState, PointLogEntry } from "@/types/umpire";

export function computeAddPoint(match: BwfMatchState, team: 1 | 2, note?: string): Partial<BwfMatchState> & { _changeEnds?: boolean; _reason?: string; _break?: number } | null {
  if (match.status !== "playing") return null;

  const { t1, t2, serverTeam, serverPlayerIndex, receiverPlayerIndex, receiverP0AtTop,
        t1LastServedBy, t2LastServedBy,
        setsHistory, pointsToWin, goldenPoint, bestOfSets, endsSwapped, pointLog } = match;
        
  let newT1 = { ...t1 };
  let newT2 = { ...t2 };
  const isT1Doubles = !!newT1.p2Id;
  const isT2Doubles = !!newT2.p2Id;

  const formatStr = bestOfSets === 3 ? `BestOf3_${pointsToWin}` : `Single_${pointsToWin}`;
  const engine = new ScoringLogic(formatStr as MatchFormat, {
      t1Score: newT1.score,
      t2Score: newT2.score,
      serverTeam,
      serverPlayerIndex,
      receiverP0AtTop,
      t1LastServedBy,
      t2LastServedBy,
      t1GamesWon: newT1.games,
      t2GamesWon: newT2.games,
      endsSwapped
  });

  if (team === 1) engine.addT1Score(isT1Doubles);
  else engine.addT2Score(isT2Doubles);

  newT1.score = engine.state.t1Score;
  newT2.score = engine.state.t2Score;
  let newServerTeam = engine.state.serverTeam;
  let newServerPlayerIndex = engine.state.serverPlayerIndex as 0 | 1;
  let newReceiverP0AtTop = engine.state.receiverP0AtTop;
  let newT1LastServedBy = engine.state.t1LastServedBy as 0 | 1;
  let newT2LastServedBy = engine.state.t2LastServedBy as 0 | 1;

  const currentGameNum = newT1.games + newT2.games + 1;
  const newLog: PointLogEntry = {
    gameNum: currentGameNum,
    team,
    t1Score: newT1.score,
    t2Score: newT2.score,
    serverTeam: newServerTeam,
    ...(note ? { note } : {}),
    ts: Date.now(),
  };
  const newPointLog = [...pointLog, newLog];

  const isDeciding = currentGameNum === bestOfSets;
  const justHit11 =
    isDeciding &&
    !pointLog.slice(0, -1).some(e => e.gameNum === currentGameNum && (e.t1Score + e.t2Score) >= 11) &&
    (newT1.score + newT2.score) === 11;

  let t1WonGame = false, t2WonGame = false;
  if (newT1.score >= pointsToWin && (newT1.score - newT2.score >= 2 || newT1.score === goldenPoint)) t1WonGame = true;
  else if (newT2.score >= pointsToWin && (newT2.score - newT1.score >= 2 || newT2.score === goldenPoint)) t2WonGame = true;

  let nextStatus: "setup" | "playing" | "finished" = match.status;
  let nextWinner: 1 | 2 | undefined = match.winner;
  let newEndsSwapped = endsSwapped;
  let newSetsHistory = [...setsHistory];

  let specialEvent: any = {};

  if (t1WonGame || t2WonGame) {
    newSetsHistory.push(`${newT1.score}-${newT2.score}`);
    if (t1WonGame) newT1.games++;
    if (t2WonGame) newT2.games++;
    newT1.score = 0;
    newT2.score = 0;
    const gamesToWin = Math.ceil(bestOfSets / 2);
    if (newT1.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 1; }
    else if (newT2.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 2; }
    else {
      newServerTeam = t1WonGame ? 1 : 2;
      newServerPlayerIndex = 0;
      newT1LastServedBy = 1;
      newT2LastServedBy = 0;
      newReceiverP0AtTop = true;
      newEndsSwapped = !newEndsSwapped;
      const gamesPlayed = newT1.games + newT2.games;
      const breakSecs = 60;
      const reason = `End of Game ${gamesPlayed} — Change Ends`;
      specialEvent = { _changeEnds: true, _reason: reason, _break: breakSecs };
    }
  } else if (justHit11) {
    newEndsSwapped = !newEndsSwapped;
    specialEvent = { _changeEnds: true, _reason: "Deciding Game — 11 pts Interval (Change Ends)", _break: 60 };
  }

  return {
    t1: newT1,
    t2: newT2,
    serverTeam: newServerTeam,
    serverPlayerIndex: newServerPlayerIndex,
    receiverP0AtTop: newReceiverP0AtTop,
    t1LastServedBy: newT1LastServedBy,
    t2LastServedBy: newT2LastServedBy,
    endsSwapped: newEndsSwapped,
    pointLog: newPointLog,
    setsHistory: newSetsHistory,
    status: nextStatus,
    winner: nextWinner,
    ...specialEvent
  };
}

export function computeDeductPoint(match: BwfMatchState, team: 1 | 2): Partial<BwfMatchState> | null {
  if (match.status !== "playing") return null;
  const { t1, t2 } = match;
  if (team === 1 && t1.score > 0) {
    return { t1: { ...t1, score: t1.score - 1 }, pointLog: match.pointLog.slice(0, -1) };
  }
  if (team === 2 && t2.score > 0) {
    return { t2: { ...t2, score: t2.score - 1 }, pointLog: match.pointLog.slice(0, -1) };
  }
  return null;
}

export function computeForceEndSet(match: BwfMatchState): Partial<BwfMatchState> | null {
  if (match.status !== "playing") return null;
  if (match.t1.score === 0 && match.t2.score === 0) return null;
  if (match.t1.score === match.t2.score) return null; // tied

  let t1Won = match.t1.score > match.t2.score;
  let t2Won = match.t2.score > match.t1.score;

  let { t1, t2, setsHistory, bestOfSets } = match;
  let newT1 = { ...t1 };
  let newT2 = { ...t2 };

  const newSetsHistory = [...setsHistory, `${newT1.score}-${newT2.score}`];
  if (t1Won) newT1.games++;
  if (t2Won) newT2.games++;
  newT1.score = 0;
  newT2.score = 0;

  const gamesToWin = Math.ceil(bestOfSets / 2);
  let nextStatus: "setup" | "playing" | "finished" = match.status;
  let nextWinner = match.winner;

  if (newT1.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 1; }
  else if (newT2.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 2; }

  return {
    setsHistory: newSetsHistory,
    t1: newT1,
    t2: newT2,
    status: nextStatus,
    winner: nextWinner,
    serverTeam: t1Won ? 1 : 2,
    serverPlayerIndex: 0,
    t1LastServedBy: 1,
    t2LastServedBy: 0,
  };
}

export function computeEditSet(match: BwfMatchState, index: number, newT1Str: string, newT2Str: string): Partial<BwfMatchState> {
  const newSetsHistory = [...match.setsHistory];
  newSetsHistory[index] = `${newT1Str}-${newT2Str}`;

  let t1Games = 0;
  let t2Games = 0;
  newSetsHistory.forEach(s => {
    const [s1, s2] = s.split("-").map(Number);
    if (!isNaN(s1) && !isNaN(s2)) {
        if (s1 > s2) t1Games++;
        else if (s2 > s1) t2Games++;
    }
  });

  let nextWinner = match.winner;
  if (match.status === "finished" || nextWinner) {
    if (t1Games > t2Games) nextWinner = 1;
    else if (t2Games > t1Games) nextWinner = 2;
    else nextWinner = undefined;
  }

  return {
    setsHistory: newSetsHistory,
    t1: { ...match.t1, games: t1Games },
    t2: { ...match.t2, games: t2Games },
    ...(nextWinner !== match.winner ? { winner: nextWinner } : {})
  };
}
