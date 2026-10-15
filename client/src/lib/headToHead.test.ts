import { describe, it, expect } from "vitest";
import { headToHead, recentForm, type HistMatch } from "./headToHead";

const h = (id: string, p1: string, p2: string, w: 1 | 2, day: number, o: Partial<HistMatch> = {}): HistMatch => ({
  id,
  status: "completed",
  winner_side: w,
  player1_id: p1,
  player2_id: p2,
  player3_id: null,
  player4_id: null,
  ended_at: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`,
  ...o,
});

describe("headToHead", () => {
  const hist = [
    h("1", "a", "b", 1, 1),
    h("2", "b", "a", 1, 2),
    h("3", "a", "b", 1, 3),
    h("4", "a", "c", 2, 4),
    h("5", "a", "b", 1, 5, { status: "scheduled", winner_side: null }),
  ];

  it("counts meetings from both orientations, newest first", () => {
    const r = headToHead(hist, ["a"], ["b"]);
    expect([r.aWins, r.bWins]).toEqual([2, 1]);
    expect(r.meetings.map((m) => m.id)).toEqual(["3", "2", "1"]);
  });

  it("matches doubles pairs by any shared player", () => {
    const r = headToHead([h("d", "a", "b", 2, 1, { player3_id: "x", player4_id: "y" })], ["x", "z"], ["y"]);
    expect([r.aWins, r.bWins]).toEqual([0, 1]);
  });

  it("builds recent form", () => {
    expect(recentForm(hist, ["a"])).toEqual(["L", "W", "L", "W"]);
  });
});
