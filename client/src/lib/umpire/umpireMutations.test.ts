import { describe, it, expect } from "vitest";
import { computeAddPoint, computeDeductPoint } from "./umpireMutations";
import type { BwfMatchState } from "@/types/umpire";

function createMockMatch(overrides?: Partial<BwfMatchState>): BwfMatchState {
  return {
    id: "test-match",
    t1: { p1Id: "p1", p1Name: "Player 1", p2Id: "p2", p2Name: "Player 2", score: 0, games: 0 },
    t2: { p1Id: "p3", p1Name: "Player 3", p2Id: "p4", p2Name: "Player 4", score: 0, games: 0 },
    bestOfSets: 3,
    pointsToWin: 21,
    goldenPoint: 30,
    status: "playing",
    serverTeam: 1,
    serverPlayerIndex: 0,
    receiverPlayerIndex: 0,
    receiverP0AtTop: true,
    t1LastServedBy: 1,
    t2LastServedBy: 1,
    endsSwapped: false,
    setsHistory: [],
    pointLog: [],
    courtId: "c1",
    eventSlug: null,
    isFriendly: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    umpireId: "ump",
    ...overrides
  } as BwfMatchState;
}

describe("umpireMutations", () => {
  it("should add point and return updated state", () => {
    const match = createMockMatch();
    const result = computeAddPoint(match, 1);
    
    expect(result).not.toBeNull();
    expect(result?.t1.score).toBe(1);
    expect(result?.pointLog?.length).toBe(1);
    expect(result?.pointLog?.[0].t1Score).toBe(1);
  });

  it("should handle game completion", () => {
    const match = createMockMatch({
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 20, games: 0 }
    });
    const result = computeAddPoint(match, 1);
    
    expect(result?.t1.games).toBe(1);
    expect(result?.t1.score).toBe(0); // score resets
    expect(result?.t2.score).toBe(0);
    expect(result?.setsHistory).toEqual(["21-0"]);
    expect(result?._changeEnds).toBe(true);
  });

  it("should handle match completion", () => {
    const match = createMockMatch({
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 20, games: 1 } // T1 already won 1 game
    });
    const result = computeAddPoint(match, 1);
    
    expect(result?.t1.games).toBe(2);
    expect(result?.status).toBe("finished");
    expect(result?.winner).toBe(1);
    expect(result?._changeEnds).toBeUndefined(); // Match over, no change ends
  });

  it("should trigger change ends at 11 points in deciding game", () => {
    const match = createMockMatch({
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 10, games: 1 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 0, games: 1 }, // 1-1 in games, deciding game
    });
    const result = computeAddPoint(match, 1);
    
    expect(result?.t1.score).toBe(11);
    expect(result?._changeEnds).toBe(true);
    expect(result?._reason).toContain("11 pts Interval");
    expect(result?.endsSwapped).toBe(true);
  });
});

// ─── Interval / change-of-ends regression tests ──────────────────────────────
// BWF: the 60s interval fires in EVERY game when the leading score first
// reaches the interval point. Ends are changed at that interval only in the
// deciding game — and only once.

/** Build a point log that plausibly walks up to (t1, t2) within one game. */
function buildLog(gameNum: number, t1: number, t2: number) {
  const log: any[] = [];
  for (let i = 1; i <= t1; i++) log.push({ gameNum, team: 1, t1Score: i, t2Score: 0, ts: 0 });
  for (let i = 1; i <= t2; i++) log.push({ gameNum, team: 2, t1Score: t1, t2Score: i, ts: 0 });
  return log;
}

describe("intervals and change of ends", () => {
  it("does not change ends a second time once the interval has passed (30-pt game)", () => {
    // Single game to 30 → interval at 15.
    const base = createMockMatch({
      bestOfSets: 1,
      pointsToWin: 30,
      goldenPoint: 40,
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 14, games: 0 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 11, games: 0 },
      pointLog: buildLog(1, 14, 11),
      serverTeam: 1,
    });

    // 15-11 → interval fires, ends change.
    const toFifteen = computeAddPoint(base, 1)!;
    expect(toFifteen.t1!.score).toBe(15);
    expect(toFifteen._changeEnds).toBe(true);
    expect(toFifteen.endsSwapped).toBe(true);

    // 15-12 → T1 is still sitting on 15; ends must NOT change again.
    const after = { ...base, ...toFifteen } as any;
    const next = computeAddPoint(after, 2)!;
    expect(next.t2!.score).toBe(12);
    expect(next._changeEnds).toBeFalsy();
    expect(next.endsSwapped).toBe(true); // unchanged from before
  });

  it("gives a 60s interval at 11 in game 1 of a best-of-3, without changing ends", () => {
    const match = createMockMatch({
      bestOfSets: 3,
      pointsToWin: 21,
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 10, games: 0 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 5, games: 0 },
      pointLog: buildLog(1, 10, 5),
    });

    const result = computeAddPoint(match, 1)!;
    expect(result.t1!.score).toBe(11);
    expect(result._break).toBe(60);          // interval must happen
    expect(result.endsSwapped).toBe(false);  // but ends stay put outside the decider
  });

  it("still changes ends at the interval in the deciding game", () => {
    const match = createMockMatch({
      bestOfSets: 3,
      pointsToWin: 21,
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 10, games: 1 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 5, games: 1 },
      pointLog: buildLog(3, 10, 5),
    });

    const result = computeAddPoint(match, 1)!;
    expect(result._break).toBe(60);
    expect(result.endsSwapped).toBe(true);
  });
});

describe("doubles detection", () => {
  it("treats a pair entered by name only (no partner id) as doubles", () => {
    // Partner known by name but never linked to a player record. Player 1 is in
    // the right court, and T1 will score to 2 (even) → serve from the right, so
    // player 1 must serve. A team wrongly treated as singles would return 0.
    const match = createMockMatch({
      t1: { p1Id: "p1", p1Name: "Kriti Kalia", p2Name: "Deepak Kumar", score: 1, games: 0 } as any,
      t2: { p1Id: "p3", p1Name: "Anushka Vashistha", score: 5, games: 0 } as any,
      serverTeam: 2,
      t1RightCourt: 1,
      t2RightCourt: 0,
    });

    const result = computeAddPoint(match, 1)!;
    expect(result.serverTeam).toBe(1);
    expect(result.serverPlayerIndex).toBe(1); // right-court player, doubles-aware
  });

  it("still forces player 0 for a genuine singles side", () => {
    const match = createMockMatch({
      t1: { p1Id: "p1", p1Name: "Solo", score: 1, games: 0 } as any,
      t2: { p1Id: "p3", p1Name: "Other", score: 5, games: 0 } as any,
      serverTeam: 2,
      t1RightCourt: 1,
      t2RightCourt: 0,
    });

    const result = computeAddPoint(match, 1)!;
    expect(result.serverPlayerIndex).toBe(0);
    expect(result.receiverPlayerIndex).toBe(0);
  });
});

describe("undoing the interval point", () => {
  it("reverts the ends swap when the interval point is deducted in the deciding game", () => {
    // Deciding game (1-1 in games), 10-8, T1 about to reach the 11 interval.
    const match = createMockMatch({
      bestOfSets: 3,
      pointsToWin: 21,
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 10, games: 1 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 8, games: 1 },
      pointLog: buildLog(3, 10, 8),
      endsSwapped: false,
    });

    // 11-8 → interval fires and ends swap.
    const toEleven = computeAddPoint(match, 1)!;
    expect(toEleven.endsSwapped).toBe(true);

    // Umpire deducts that point → 10-8, ends must go back.
    const afterInterval = { ...match, ...toEleven } as any;
    const undone = computeDeductPoint(afterInterval, 1)!;
    expect(undone.t1!.score).toBe(10);
    expect(undone.endsSwapped).toBe(false);
  });

  it("does not touch ends when deducting the interval point outside the deciding game", () => {
    // Game 1: the interval happens but ends never changed, so undo must not flip them.
    const match = createMockMatch({
      bestOfSets: 3,
      pointsToWin: 21,
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 10, games: 0 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 8, games: 0 },
      pointLog: buildLog(1, 10, 8),
      endsSwapped: false,
    });

    const toEleven = computeAddPoint(match, 1)!;
    expect(toEleven.endsSwapped).toBe(false); // no swap in game 1

    const afterInterval = { ...match, ...toEleven } as any;
    const undone = computeDeductPoint(afterInterval, 1)!;
    expect(undone.endsSwapped).toBeUndefined(); // untouched
  });
});

// ─── BWF serve / receive model ───────────────────────────────────────────────
describe("doubles serve and receive (BWF 9.1.6)", () => {
  const doublesMatch = (over?: any) => createMockMatch({
    bestOfSets: 1,
    pointsToWin: 21,
    serverTeam: 1,
    serverPlayerIndex: 0,
    receiverPlayerIndex: 0,
    t1RightCourt: 0,
    t2RightCourt: 0,
    ...over,
  });

  it("keeps the same server but swaps the serving pair when the serving side wins", () => {
    const m = doublesMatch(); // 0-0, T1 serving, P0 serving from right
    const r = computeAddPoint(m, 1)!;

    expect(r.serverTeam).toBe(1);
    // 1-0 → odd → serve from left. T1 swapped, so P0 is now on the left.
    expect(r.t1RightCourt).toBe(1);
    expect(r.serverPlayerIndex).toBe(0); // same player serves again
    // Receiving side never moved; server now in left court → receiver is T2's
    // left-court player, i.e. not the one who received at 0-0.
    expect(r.receiverPlayerIndex).toBe(1);
  });

  it("does not move the receiving pair when they win the rally", () => {
    const m = doublesMatch();
    const r = computeAddPoint(m, 2)!; // receiving side wins

    expect(r.serverTeam).toBe(2);
    // Nobody swaps courts on a service change.
    expect(r.t1RightCourt).toBe(0);
    expect(r.t2RightCourt).toBe(0);
    // T2 now on 1 → odd → serves from left → their left-court player serves.
    expect(r.serverPlayerIndex).toBe(1);
  });

  it("gives the same player the serve back after a full rotation", () => {
    let m: any = doublesMatch();
    // T1 wins twice: P0 serves from right, then left, then right again.
    const a = computeAddPoint(m, 1)!; m = { ...m, ...a };
    const b = computeAddPoint(m, 1)!;
    expect(b.t1RightCourt).toBe(0);       // swapped back
    expect(b.serverPlayerIndex).toBe(0);  // still the same server
  });
});

describe("deducting a point restores the serve", () => {
  it("puts the serve back with the side that had it before the rally", () => {
    const m = createMockMatch({
      serverTeam: 1,
      serverPlayerIndex: 0,
      receiverPlayerIndex: 0,
      t1RightCourt: 0,
      t2RightCourt: 0,
    });

    // T2 wins the rally and takes the serve.
    const scored = computeAddPoint(m, 2)!;
    expect(scored.serverTeam).toBe(2);

    // Umpire deducts it — serve must go back to T1's original server.
    const after = { ...m, ...scored } as any;
    const undone = computeDeductPoint(after, 2)!;
    expect(undone.t2!.score).toBe(0);
    expect(undone.serverTeam).toBe(1);
    expect(undone.serverPlayerIndex).toBe(0);
    expect(undone.receiverPlayerIndex).toBe(0);
    expect(undone.t1RightCourt).toBe(0);
    expect(undone.t2RightCourt).toBe(0);
  });

  it("falls back to score-only rollback for logs without a snapshot", () => {
    // A match already in progress, logged before `prev` existed.
    const m = createMockMatch({
      t1: { p1Id: "p1", p1Name: "P1", p2Id: "p2", p2Name: "P2", score: 5, games: 0 },
      t2: { p1Id: "p3", p1Name: "P3", p2Id: "p4", p2Name: "P4", score: 3, games: 0 },
      serverTeam: 1,
      pointLog: [{ gameNum: 1, team: 1, t1Score: 5, t2Score: 3, serverTeam: 1, ts: 0 }] as any,
    });
    const undone = computeDeductPoint(m, 1)!;
    expect(undone.t1!.score).toBe(4);
    expect(undone.serverTeam).toBeUndefined(); // nothing to restore, left alone
  });
});
