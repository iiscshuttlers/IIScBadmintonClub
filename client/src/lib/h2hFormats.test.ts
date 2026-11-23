import { describe, expect, it } from "vitest";
import type { ComparisonRow } from "@/lib/comparison";
import { compareByFormat, currentRun, formatOfDiscipline, gamesFromA, latestPartners, pointsAndStreaks, sideRating, winChancePct } from "@/lib/h2hFormats";

let n = 0;
const row = (o: Partial<ComparisonRow>): ComparisonRow => ({
  id: `m${++n}`,
  source: "tournament",
  status: "completed",
  winnerSide: 1,
  winnerId: null,
  side1: ["a"],
  side2: ["b"],
  category: "MS",
  date: "2026-08-01T10:00:00Z",
  score: null,
  round: null,
  event: null,
  ...o,
});

describe("formatOfDiscipline", () => {
  it("groups disciplines into formats", () => {
    expect(["MS", "WS", "MD", "WD", "XD"].map((d) => formatOfDiscipline(d as never))).toEqual(["Singles", "Singles", "Doubles", "Doubles", "Mixed"]);
    expect(formatOfDiscipline(null)).toBeNull();
  });
});

describe("compareByFormat", () => {
  const rows = [
    row({ category: "MS", winnerSide: 1 }),
    row({ category: "MS", winnerSide: 1, side1: ["b"], side2: ["a"] }),
    row({ category: "MD", side1: ["a", "c"], side2: ["b", "d"], winnerSide: 2 }),
    row({ category: "XD", side1: ["b", "e"], side2: ["a", "f"], winnerSide: 2 }),
    row({ category: "XD", side1: ["a", "f"], side2: ["b", "e"], status: "walkover", winnerSide: 1 }),
  ];

  it("splits player-vs-player meetings by format", () => {
    const r = compareByFormat(rows, { ids: ["a"] }, { ids: ["b"] });
    expect([r.All.aWins, r.All.bWins]).toEqual([2, 2]);
    expect([r.Singles.aWins, r.Singles.bWins]).toEqual([1, 1]);
    expect([r.Doubles.aWins, r.Doubles.bWins]).toEqual([0, 1]);
    expect([r.Mixed.aWins, r.Mixed.bWins, r.Mixed.walkovers.aWon]).toEqual([1, 0, 1]);
  });

  it("compares exact pairs only", () => {
    const r = compareByFormat(rows, { ids: ["f", "a"] }, { ids: ["b", "e"] });
    expect([r.Mixed.aWins, r.Mixed.bWins, r.Mixed.sample]).toEqual([1, 0, 1]);
    expect(r.Doubles.sample).toBe(0);
    expect(compareByFormat(rows, { ids: ["a", "c"] }, { ids: ["b", "e"] }).All.sample).toBe(0);
  });
});

describe("latestPartners", () => {
  const rows = [
    row({ category: "XD", side1: ["a", "f"], side2: ["b", "e"], date: "2026-08-01T00:00:00Z" }),
    row({ category: "XD", side1: ["b", "g"], side2: ["a", "h"], date: "2026-08-20T00:00:00Z" }),
    row({ category: "MD", side1: ["a", "c"], side2: ["b", "d"], date: "2026-08-10T00:00:00Z" }),
    row({ category: "MS", date: "2026-09-01T00:00:00Z" }),
  ];

  it("takes the most recent doubles meeting in the format", () => {
    expect(latestPartners(rows, "a", "b", "Mixed")).toEqual({ aPartner: "h", bPartner: "g" });
    expect(latestPartners(rows, "a", "b", "Doubles")).toEqual({ aPartner: "c", bPartner: "d" });
    expect(latestPartners(rows, "a", "b", "All")).toEqual({ aPartner: "h", bPartner: "g" });
  });

  it("keeps to a partner already chosen for the first player", () => {
    expect(latestPartners(rows, "a", "b", "All", "c")).toEqual({ aPartner: "c", bPartner: "d" });
    expect(latestPartners(rows, "a", "b", "All", "z")).toBeNull();
  });

  it("returns null when they never met in doubles", () => {
    expect(latestPartners(rows, "a", "b", "Singles")).toBeNull();
    expect(latestPartners(rows, "a", "z", "All")).toBeNull();
  });
});

describe("ratings", () => {
  it("averages a pair's format rating, falling back to overall then 1200", () => {
    const p = { elo_rating: 1250, doubles_elo: 1300, mixed_elo: null };
    const q = { elo_rating: 1150, doubles_elo: 1200, mixed_elo: 1180 };
    expect(sideRating([p, q], "Doubles")).toBe(1250);
    expect(sideRating([p, q], "Mixed")).toBe((1250 + 1180) / 2);
    expect(sideRating([], "All")).toBe(1200);
  });

  it("gives an even chance for equal ratings", () => {
    expect(winChancePct(1200, 1200)).toBe(50);
    expect(winChancePct(1400, 1200)).toBe(76);
  });
});

describe("pointsAndStreaks", () => {
  it("orients points to side A and finds the longest runs, oldest first", () => {
    const rows = [
      row({ date: "2026-08-01T00:00:00Z", score: "21-15, 21-18", winnerSide: 1 }),
      row({ date: "2026-08-02T00:00:00Z", side1: ["b"], side2: ["a"], score: "21-19, 21-10", winnerSide: 2 }),
      row({ date: "2026-08-03T00:00:00Z", score: "10-21, 15-21", winnerSide: 2 }),
    ];
    const r = compareByFormat(rows, { ids: ["a"] }, { ids: ["b"] }).All;
    expect(pointsAndStreaks(r)).toEqual({ aPoints: 21 + 21 + 19 + 10 + 10 + 15, bPoints: 15 + 18 + 21 + 21 + 21 + 21, aBestRun: 2, bBestRun: 1 });
  });
});

describe("gamesFromA", () => {
  it("turns games to side A and skips notes and junk", () => {
    expect(gamesFromA("21-19, 18-21", 1)).toEqual([{ a: 21, b: 19 }, { a: 18, b: 21 }]);
    expect(gamesFromA("21-19, 18-21 [Mixed Doubles: x-y]", 2)).toEqual([{ a: 19, b: 21 }, { a: 21, b: 18 }]);
    expect(gamesFromA("W/O", 1)).toEqual([]);
    expect(gamesFromA(null, 1)).toEqual([]);
  });
});

describe("currentRun", () => {
  it("counts the newest unbroken run of wins for one side", () => {
    const rows = [
      row({ date: "2026-08-01T00:00:00Z", winnerSide: 1 }),
      row({ date: "2026-08-02T00:00:00Z", winnerSide: 2 }),
      row({ date: "2026-08-03T00:00:00Z", winnerSide: 2 }),
      row({ date: "2026-08-04T00:00:00Z", status: "walkover", winnerSide: 1 }),
    ];
    expect(currentRun(compareByFormat(rows, { ids: ["a"] }, { ids: ["b"] }).All)).toEqual({ aWon: false, length: 2 });
    expect(currentRun(compareByFormat([], { ids: ["a"] }, { ids: ["b"] }).All)).toBeNull();
  });
});
