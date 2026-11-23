import { describe, expect, it } from "vitest";
import { checkMatchScore, defaultCap, gamesToWin, isValidBadmintonGame, matchRules } from "./badmintonScore";

const R21 = { bestOfSets: 3, pointsToWin: 21, cap: 30 };

describe("isValidBadmintonGame", () => {
  it.each([
    [21, 0], [21, 19], [0, 21], [22, 20], [29, 27], [30, 29], [30, 28], [25, 23],
  ])("accepts %i-%i", (a, b) => expect(isValidBadmintonGame(a, b, 21, 30)).toBe(true));

  it.each([
    [5, 3], [21, 20], [22, 19], [23, 20], [30, 27], [31, 29], [50, 2], [21, 21], [-1, 21], [21.5, 10],
  ])("rejects %s-%s", (a, b) => expect(isValidBadmintonGame(a, b, 21, 30)).toBe(false));

  it("follows a 15-point event with its own cap", () => {
    expect(isValidBadmintonGame(15, 13, 15, 21)).toBe(true);
    expect(isValidBadmintonGame(21, 20, 15, 21)).toBe(true);
    expect(isValidBadmintonGame(21, 13, 15, 21)).toBe(false);
  });

  // Most club rounds are 30-point games capped at 30 (301 of 362 prod matches
  // on 23 Nov 2026): no deuce, at 29-29 the next point wins.
  it.each([[30, 0], [30, 28], [30, 29], [29, 30]])("accepts %i-%i in a 30-point game capped at 30", (a, b) =>
    expect(isValidBadmintonGame(a, b, 30, 30)).toBe(true));
  it.each([[29, 27], [31, 29], [30, 30]])("rejects %i-%i in a 30-point game capped at 30", (a, b) =>
    expect(isValidBadmintonGame(a, b, 30, 30)).toBe(false));

  it("accepts sudden death at the game length (21 capped at 21)", () => {
    expect(isValidBadmintonGame(21, 20, 21, 21)).toBe(true);
    expect(isValidBadmintonGame(22, 20, 21, 21)).toBe(false);
  });
});

describe("rules helpers", () => {
  it("needs a majority of games", () => {
    expect(gamesToWin(1)).toBe(1);
    expect(gamesToWin(3)).toBe(2);
    expect(gamesToWin(5)).toBe(3);
  });

  it("falls back to 3 × 21 capped at 30", () => {
    expect(matchRules({})).toEqual({ bestOfSets: 3, pointsToWin: 21, cap: 30 });
    expect(matchRules({ best_of_sets: 1, points_to_win: 15 })).toEqual({ bestOfSets: 1, pointsToWin: 15, cap: defaultCap(15) });
    expect(matchRules({ points_to_win: 21, golden_point: 25 }).cap).toBe(25);
    expect(matchRules({ points_to_win: 30, golden_point: 30 })).toEqual({ bestOfSets: 3, pointsToWin: 30, cap: 30 });
    // Without a golden point the cap is lenient: 30, or the game length if higher.
    expect([defaultCap(15), defaultCap(21), defaultCap(35)]).toEqual([30, 30, 35]);
  });
});

describe("checkMatchScore", () => {
  it("finds the winner of a decided match", () => {
    expect(checkMatchScore([[21, 10], [18, 21], [21, 19]], R21)).toEqual({ ok: true, complete: true, winnerSide: 1, gamesWon: [2, 1] });
    expect(checkMatchScore([[10, 21], [19, 21]], R21)).toMatchObject({ complete: true, winnerSide: 2 });
  });

  it("reports an undecided score as incomplete, not as a win", () => {
    expect(checkMatchScore([[21, 10]], R21)).toMatchObject({ ok: true, complete: false, winnerSide: null });
    expect(checkMatchScore([[21, 10], [10, 21]], R21)).toMatchObject({ ok: true, complete: false, gamesWon: [1, 1] });
    expect(checkMatchScore([[21, 10], [21, 10]], { ...R21, bestOfSets: 5 })).toMatchObject({ complete: false });
  });

  it("refuses impossible games", () => {
    const r = checkMatchScore([[21, 10], [5, 3]], R21);
    expect(r).toMatchObject({ ok: false });
    if (r.ok === false) expect(r.error).toContain("Game 2: 5-3");
  });

  it("refuses games after the match was won", () => {
    const r = checkMatchScore([[21, 10], [21, 10], [10, 21]], R21);
    expect(r).toMatchObject({ ok: false });
    if (r.ok === false) expect(r.error).toContain("already won after game 2");
  });

  it("refuses more games than the format allows", () => {
    expect(checkMatchScore([[21, 10], [21, 10]], { ...R21, bestOfSets: 1 })).toMatchObject({ ok: false });
  });

  it("decides a best-of-1 in one game", () => {
    expect(checkMatchScore([[19, 21]], { ...R21, bestOfSets: 1 })).toMatchObject({ complete: true, winnerSide: 2 });
  });
});
