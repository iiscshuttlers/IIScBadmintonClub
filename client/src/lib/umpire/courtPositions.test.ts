import { describe, it, expect } from "vitest";
import { isPlayerAtTop, seedRightCourt, seedRightCourts } from "./courtPositions";

describe("isPlayerAtTop", () => {
  // Net runs vertically, viewed from above: the left team's right service court
  // is the bottom row, the right team's right service court is the top row.
  it("puts the left team's right-court player at the bottom", () => {
    expect(isPlayerAtTop(0, 0, true)).toBe(false);
    expect(isPlayerAtTop(1, 0, true)).toBe(true);
  });

  it("puts the right team's right-court player at the top", () => {
    expect(isPlayerAtTop(0, 0, false)).toBe(true);
    expect(isPlayerAtTop(1, 0, false)).toBe(false);
  });

  it("mirrors a pair when they change ends, keeping their service courts", () => {
    // Player 0 holds the right court. On either end they stay in the right
    // court, which is drawn on the opposite row.
    expect(isPlayerAtTop(0, 0, true)).toBe(false);
    expect(isPlayerAtTop(0, 0, false)).toBe(true);
  });

  it("swaps both players when the pair swaps courts", () => {
    expect(isPlayerAtTop(0, 0, true)).toBe(false);
    expect(isPlayerAtTop(0, 1, true)).toBe(true);
  });
});

describe("seedRightCourt", () => {
  it("places the server in their right court at an even score", () => {
    expect(seedRightCourt(1, true)).toBe(1);
  });

  it("places the server in their left court at an odd score", () => {
    expect(seedRightCourt(1, false)).toBe(0);
  });
});

describe("seedRightCourts", () => {
  const base = {
    serverTeam: 1 as const,
    serverPlayerIndex: 0 as const,
    receiverPlayerIndex: 1 as const,
    serverScore: 0,
  };

  it("prefers stored court positions over the seed", () => {
    expect(seedRightCourts({ ...base, t1RightCourt: 1, t2RightCourt: 0 }))
      .toEqual({ t1Right: 1, t2Right: 0 });
  });

  it("seeds server and receiver into their right courts at an even score", () => {
    // The diagonal maps right court to right court across the net.
    expect(seedRightCourts(base)).toEqual({ t1Right: 0, t2Right: 1 });
  });

  it("seeds server and receiver into their left courts at an odd score", () => {
    expect(seedRightCourts({ ...base, serverScore: 7 })).toEqual({ t1Right: 1, t2Right: 0 });
  });

  it("seeds only the side that is missing", () => {
    expect(seedRightCourts({ ...base, t2RightCourt: 0 })).toEqual({ t1Right: 0, t2Right: 0 });
  });
});
