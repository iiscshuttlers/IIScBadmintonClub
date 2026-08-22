import { ScoringLogic, type MatchFormat } from "./scoringLogic";
import { seedRightCourts } from "./courtPositions";
import type { BwfMatchState, PointLogEntry } from "@/types/umpire";

export function computeAddPoint(match: BwfMatchState, team: 1 | 2, note?: string): Partial<BwfMatchState> & { _changeEnds?: boolean; _reason?: string; _break?: number; _title?: string } | null {
  if (match.status !== "playing") return null;

  const { t1, t2, serverTeam, serverPlayerIndex, receiverPlayerIndex,
        t1LastServedBy, t2LastServedBy,
        setsHistory, pointsToWin, goldenPoint, bestOfSets, endsSwapped, pointLog } = match;
        
  let newT1 = { ...t1 };
  let newT2 = { ...t2 };
  // A doubles pair entered by name only (partner never linked to a player
  // record) has no p2Id. Keying purely off the id silently demoted such a team
  // to singles, so the server never alternated between the two partners.
  const isT1Doubles = !!newT1.p2Id || !!newT1.p2Name;
  const isT2Doubles = !!newT2.p2Id || !!newT2.p2Name;

  const formatStr = bestOfSets === 3 ? `BestOf3_${pointsToWin}` : `Single_${pointsToWin}`;
  const engine = new ScoringLogic(formatStr as MatchFormat, {
      t1Score: newT1.score,
      t2Score: newT2.score,
      serverTeam,
      serverPlayerIndex,
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
  let newT1LastServedBy = engine.state.t1LastServedBy as 0 | 1;
  let newT2LastServedBy = engine.state.t2LastServedBy as 0 | 1;

  // ── Court positions: the authoritative model for server + receiver ────────
  // BWF 9.1.6 / 9.2: when the serving side wins a rally that same player serves
  // again from the *other* service court — i.e. the serving pair swap courts and
  // the receiving pair stay put. When the receiving side wins, nobody swaps and
  // serve simply passes over. Server and receiver are then whoever is standing
  // in the court matching the serving score's parity (even → right).
  //
  // Seed from the current server/receiver when a match predates these fields.
  const prevServerTeam = serverTeam;
  const prevServerScore = prevServerTeam === 1 ? t1.score : t2.score;

  const seeded = seedRightCourts({
    serverTeam,
    serverPlayerIndex,
    receiverPlayerIndex,
    serverScore: prevServerScore,
    t1RightCourt: match.t1RightCourt,
    t2RightCourt: match.t2RightCourt,
  });
  let t1Right: 0 | 1 = seeded.t1Right;
  let t2Right: 0 | 1 = seeded.t2Right;

  const servingSideWonRally = team === prevServerTeam;
  if (servingSideWonRally) {
    // Only the side that served swaps courts.
    if (team === 1 && isT1Doubles) t1Right = (1 - t1Right) as 0 | 1;
    if (team === 2 && isT2Doubles) t2Right = (1 - t2Right) as 0 | 1;
  }

  const scoringSideScore = team === 1 ? newT1.score : newT2.score;
  const serveFromRight = scoringSideScore % 2 === 0;
  const winnerRight = team === 1 ? t1Right : t2Right;
  const loserRight = team === 1 ? t2Right : t1Right;
  const winnerDoubles = team === 1 ? isT1Doubles : isT2Doubles;
  const loserDoubles = team === 1 ? isT2Doubles : isT1Doubles;

  newServerTeam = team;
  newServerPlayerIndex = winnerDoubles
    ? ((serveFromRight ? winnerRight : 1 - winnerRight) as 0 | 1)
    : 0;
  // Receiver is diagonally opposite: same court designation on the other side.
  let newReceiverPlayerIndex: 0 | 1 = loserDoubles
    ? ((serveFromRight ? loserRight : 1 - loserRight) as 0 | 1)
    : 0;

  if (newServerTeam === 1) newT1LastServedBy = newServerPlayerIndex;
  else newT2LastServedBy = newServerPlayerIndex;

  const currentGameNum = newT1.games + newT2.games + 1;
  const newLog: PointLogEntry = {
    gameNum: currentGameNum,
    team,
    t1Score: newT1.score,
    t2Score: newT2.score,
    serverTeam: newServerTeam,
    ...(note ? { note } : {}),
    ts: Date.now(),
    // Snapshot of serve/receive as it stood BEFORE this rally, so deducting the
    // point restores the serve exactly instead of only rolling back the score.
    prev: {
      serverTeam,
      serverPlayerIndex,
      receiverPlayerIndex,
      t1LastServedBy,
      t2LastServedBy,
      // Seeded rather than copied: a match that predates the court-position
      // fields would otherwise snapshot `undefined` and leave the deduct path
      // with the post-rally positions.
      t1RightCourt: seeded.t1Right,
      t2RightCourt: seeded.t2Right,
    },
  };
  const newPointLog = [...pointLog, newLog];

  const safePointsToWin = pointsToWin || 30;
  const safeBestOfSets = bestOfSets || 1;
  const safeGoldenPoint = goldenPoint || 30;

  const isDeciding = currentGameNum === safeBestOfSets;
  const intervalPoint = Math.ceil(safePointsToWin / 2);

  // `pointLog` here is the log *before* this point, so it must be inspected in
  // full. It previously used `.slice(0, -1)`, which dropped the very entry that
  // recorded the interval being reached — so the next point by the trailing
  // side (e.g. 15-11 → 15-12, where the leader is still sitting on 15) saw a
  // clean log and fired the interval a second time, swapping ends again.
  const alreadyReachedInterval = pointLog.some(
    e => e.gameNum === currentGameNum && (e.t1Score >= intervalPoint || e.t2Score >= intervalPoint)
  );
  const justHitInterval =
    !alreadyReachedInterval &&
    (newT1.score === intervalPoint || newT2.score === intervalPoint);

  let t1WonGame = false, t2WonGame = false;
  if (newT1.score >= safePointsToWin && (newT1.score - newT2.score >= 2 || newT1.score === safeGoldenPoint)) t1WonGame = true;
  else if (newT2.score >= safePointsToWin && (newT2.score - newT1.score >= 2 || newT2.score === safeGoldenPoint)) t2WonGame = true;

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
    const gamesToWin = Math.ceil(safeBestOfSets / 2);
    if (newT1.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 1; }
    else if (newT2.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 2; }
    else {
      newServerTeam = t1WonGame ? 1 : 2;
      newServerPlayerIndex = 0;
      newT1LastServedBy = 1;
      newT2LastServedBy = 0;
      // New game starts 0-0: both sides line up with player 0 on the right,
      // so player 0 serves and player 0 receives.
      newReceiverPlayerIndex = 0;
      t1Right = 0;
      t2Right = 0;
      newEndsSwapped = !newEndsSwapped;
      const gamesPlayed = newT1.games + newT2.games;
      const breakSecs = 60;
      const reason = `End of Game ${gamesPlayed} — Change Ends`;
      specialEvent = { _changeEnds: true, _reason: reason, _break: breakSecs };
    }
  } else if (justHitInterval) {
    // BWF: the 60s interval is taken in *every* game once the leading score
    // reaches the interval point. Ends are additionally changed at that
    // interval only in the deciding game. The interval used to be gated on
    // `isDeciding` entirely, so games 1 and 2 got no break at all.
    if (isDeciding) {
      newEndsSwapped = !newEndsSwapped;
      specialEvent = {
        _changeEnds: true,
        _reason: `Deciding Game — ${intervalPoint} pts Interval (Change Ends)`,
        _break: 60,
        _title: "Change Ends",
      };
    } else {
      specialEvent = {
        _changeEnds: true,
        _reason: `${intervalPoint} pts Interval — 60 second break`,
        _break: 60,
        _title: "Interval",
      };
    }
  }

  return {
    t1: newT1,
    t2: newT2,
    serverTeam: newServerTeam,
    serverPlayerIndex: newServerPlayerIndex,
    receiverPlayerIndex: newReceiverPlayerIndex,
    t1LastServedBy: newT1LastServedBy,
    t2LastServedBy: newT2LastServedBy,
    t1RightCourt: t1Right,
    t2RightCourt: t2Right,
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
  const { t1, t2, bestOfSets, pointsToWin, endsSwapped } = match;
  
  const safePointsToWin = pointsToWin || 30;
  const safeBestOfSets = bestOfSets || 1;
  const intervalPoint = Math.ceil(safePointsToWin / 2);
  const currentGameNum = t1.games + t2.games + 1;
  const isDeciding = currentGameNum === safeBestOfSets;

  // Deducting used to roll back only the score and the log entry, leaving the
  // serve with whoever had just won it — so undoing a point that changed service
  // left the wrong side (and in doubles the wrong partner) serving. Restore the
  // snapshot the point carried, when present.
  const lastEntry = match.pointLog[match.pointLog.length - 1];
  const restoreServe = lastEntry?.prev
    ? {
        serverTeam: lastEntry.prev.serverTeam,
        serverPlayerIndex: lastEntry.prev.serverPlayerIndex,
        receiverPlayerIndex: lastEntry.prev.receiverPlayerIndex,
        t1LastServedBy: lastEntry.prev.t1LastServedBy,
        t2LastServedBy: lastEntry.prev.t2LastServedBy,
        // Entries written before court positions were snapshotted carry no
        // right-court values; seed them from the restored serve instead of
        // leaving the post-rally positions in place.
        ...(() => {
          const prev = lastEntry.prev!;
          // Scores as they stood before the rally being deducted.
          const preT1 = team === 1 ? t1.score - 1 : t1.score;
          const preT2 = team === 2 ? t2.score - 1 : t2.score;
          const { t1Right, t2Right } = seedRightCourts({
            serverTeam: prev.serverTeam,
            serverPlayerIndex: prev.serverPlayerIndex,
            receiverPlayerIndex: prev.receiverPlayerIndex,
            serverScore: prev.serverTeam === 1 ? preT1 : preT2,
            t1RightCourt: prev.t1RightCourt,
            t2RightCourt: prev.t2RightCourt,
          });
          return { t1RightCourt: t1Right, t2RightCourt: t2Right };
        })(),
      }
    : {};

  if (team === 1 && t1.score > 0) {
    const isUndoingInterval = isDeciding && t1.score === intervalPoint && t2.score < intervalPoint;
    return {
      t1: { ...t1, score: t1.score - 1 },
      pointLog: match.pointLog.slice(0, -1),
      ...restoreServe,
      ...(isUndoingInterval ? { endsSwapped: !endsSwapped } : {})
    };
  }
  if (team === 2 && t2.score > 0) {
    const isUndoingInterval = isDeciding && t2.score === intervalPoint && t1.score < intervalPoint;
    return {
      t2: { ...t2, score: t2.score - 1 },
      pointLog: match.pointLog.slice(0, -1),
      ...restoreServe,
      ...(isUndoingInterval ? { endsSwapped: !endsSwapped } : {})
    };
  }
  return null;
}

export function computeForceEndSet(match: BwfMatchState): Partial<BwfMatchState> | null {
  if (match.status !== "playing") return null;
  if (match.t1.score === 0 && match.t2.score === 0) return null;
  if (match.t1.score === match.t2.score) return null; // tied

  let t1Won = match.t1.score > match.t2.score;
  let t2Won = match.t2.score > match.t1.score;

  let { t1, t2, setsHistory, bestOfSets, endsSwapped } = match;
  let newT1 = { ...t1 };
  let newT2 = { ...t2 };

  const safeBestOfSets = bestOfSets || 1;

  const newSetsHistory = [...setsHistory, `${newT1.score}-${newT2.score}`];
  if (t1Won) newT1.games++;
  if (t2Won) newT2.games++;
  newT1.score = 0;
  newT2.score = 0;

  const gamesToWin = Math.ceil(safeBestOfSets / 2);
  let nextStatus: "setup" | "playing" | "finished" = "playing";
  let nextWinner: 1 | 2 | undefined = undefined;

  if (newT1.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 1; }
  else if (newT2.games >= gamesToWin) { nextStatus = "finished"; nextWinner = 2; }

  const matchOver = nextStatus === "finished";

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
    // Force-ending a set used to skip the rest of the new-game reset that the
    // normal game-end path performs, so the next game started with the previous
    // game's court positions and without changing ends — which then picked the
    // wrong partner to serve the very first rally.
    ...(matchOver
      ? {}
      : {
          receiverPlayerIndex: 0 as const,
          t1RightCourt: 0 as const,
          t2RightCourt: 0 as const,
          endsSwapped: !endsSwapped,
        }),
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
