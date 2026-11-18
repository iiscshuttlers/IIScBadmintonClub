import { describe, expect, it } from "vitest";
import { canonicalSideIds, compareSides, eligibilityOf, pairKey, relation, rowDiscipline, sampleNote, sideKind, type ComparisonRow } from "./comparison";

let n = 0;
const row = (side1: string[], side2: string[], o: Partial<ComparisonRow> = {}): ComparisonRow => ({
  id: `m${++n}`,
  source: "tournament",
  status: "completed",
  winnerSide: 1,
  winnerId: null,
  side1,
  side2,
  category: side1.length > 1 ? "MD" : "MS",
  date: `2026-10-${String(10 + (n % 20)).padStart(2, "0")}T10:00:00Z`,
  score: "21-10, 21-12",
  round: "QF",
  event: "Open",
  ...o,
});

describe("pair identity", () => {
  it("A+B equals B+A, A+C is different", () => {
    expect(pairKey(["a", "b"])).toBe(pairKey(["b", "a"]));
    expect(pairKey(["a", "b"])).not.toBe(pairKey(["a", "c"]));
  });

  it("normalizes case and rejects duplicate members as a pair identity", () => {
    expect(canonicalSideIds([" B ", "a", "A"])).toEqual(["a", "b"]);
    expect(sideKind({ ids: ["a", "A"] })).toBe("player");
  });

  it("pair-vs-pair ignores partner order but not partner identity", () => {
    const rows = [
      row(["b", "a"], ["d", "c"], { winnerSide: 1 }),
      row(["c", "d"], ["a", "b"], { winnerSide: 2 }),
      row(["a", "x"], ["c", "d"], { winnerSide: 1 }), // A with a different partner
    ];
    const r = compareSides(rows, { ids: ["a", "b"] }, { ids: ["c", "d"] });
    expect([r.aWins, r.bWins, r.sample]).toEqual([2, 0, 2]);
  });
});

describe("player comparisons", () => {
  it("keeps head-to-head and played-together separate", () => {
    const rows = [
      row(["a"], ["b"], { winnerSide: 2 }),
      row(["a", "b"], ["c", "d"], { winnerSide: 1 }), // partners
      row(["a", "c"], ["b", "d"], { winnerSide: 1 }), // opponents in doubles
    ];
    const r = compareSides(rows, { ids: ["a"] }, { ids: ["b"] });
    expect([r.aWins, r.bWins]).toEqual([1, 1]);
    expect(r.together).toMatchObject({ played: 1, won: 1, lost: 0 });
    expect(relation(rows[1], { ids: ["a"] }, { ids: ["b"] })).toEqual({ kind: "together" });
  });

  it("applies one policy for walkovers, unfinished and winnerless rows; totals reconcile", () => {
    const rows = [
      row(["a"], ["b"], { winnerSide: 1 }),
      row(["a"], ["b"], { status: "walkover", winnerSide: 2 }),
      row(["a"], ["b"], { status: "scheduled", winnerSide: null }),
      row(["a"], ["b"], { status: "completed", winnerSide: null }),
      row(["a"], ["b"], { source: "friendly", status: "pending", winnerSide: null, winnerId: "a" }),
      row(["b"], ["a"], { source: "friendly", status: "confirmed", winnerSide: null, winnerId: "a" }),
    ];
    const r = compareSides(rows, { ids: ["a"] }, { ids: ["b"] });
    expect([r.aWins, r.bWins, r.sample]).toEqual([2, 0, 2]);
    expect(r.walkovers).toEqual({ aWon: 0, bWon: 1 });
    expect(r.excluded).toBe(3);
    expect(r.aWins + r.bWins + r.walkovers.aWon + r.walkovers.bWon + r.excluded).toBe(r.meetings.length);
    expect(eligibilityOf(rows[3]).reason).toBe("No winner recorded");
  });

  it("filters by discipline, with XD independent of MD/WD", () => {
    const g = { a: "male", b: "female", c: "female", d: "male" };
    const rows = [
      row(["a", "c"], ["d", "b"], { category: "XD", winnerSide: 1 }),
      row(["a"], ["d"], { category: "MS", winnerSide: 1 }),
      row(["a", "c"], ["b", "d"], { source: "friendly", status: "confirmed", category: "Doubles", genders: g, winnerSide: null, winnerId: "a" }),
    ];
    expect(rowDiscipline(rows[2])).toBe("XD");
    const xd = compareSides(rows, { ids: ["a"] }, { ids: ["d"] }, { discipline: "XD" });
    expect(xd.sample).toBe(2);
    const ms = compareSides(rows, { ids: ["a"] }, { ids: ["d"] }, { discipline: "MS" });
    expect(ms.sample).toBe(1);
    expect(compareSides(rows, { ids: ["a"] }, { ids: ["d"] }, { discipline: "MD" }).sample).toBe(0);
  });

  it("does not double count a row seen twice", () => {
    const r1 = row(["a"], ["b"]);
    expect(compareSides([r1, { ...r1 }], { ids: ["a"] }, { ids: ["b"] }).sample).toBe(1);
  });

  it("applies an inclusive date range and excludes undated rows from a dated sample", () => {
    const rows = [
      row(["a"], ["b"], { date: "2025-12-31T23:59:59Z" }),
      row(["a"], ["b"], { date: "2026-01-01T00:00:00Z" }),
      row(["a"], ["b"], { date: "2026-12-31T23:59:59Z" }),
      row(["a"], ["b"], { date: null }),
    ];
    const result = compareSides(rows, { ids: ["a"] }, { ids: ["b"] }, {
      dateFrom: "2026-01-01T00:00:00Z",
      dateTo: "2026-12-31T23:59:59Z",
    });
    expect(result.sample).toBe(2);
  });

  it("explains small samples", () => {
    expect(sampleNote(0)).toMatch(/No counted/);
    expect(sampleNote(2)).toMatch(/only 2/);
    expect(sampleNote(5)).toBeNull();
  });
});
