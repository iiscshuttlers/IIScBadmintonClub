import { describe, it, expect } from "vitest";
import { computeAddPoint } from "./umpireMutations";
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
