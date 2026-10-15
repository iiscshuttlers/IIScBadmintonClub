import { describe, it, expect } from "vitest";
import { candidates, isLocked, maxPoints, predictableRounds, score, setPick, type PMatch } from "./bracketPredict";

const mk = (code: string, round: number, n: number, next: string | null, pos: number | null, p1: string | null, p2: string | null, o: Partial<PMatch> = {}): PMatch => ({
  id: code,
  match_code: code,
  round,
  round_name: null,
  match_number: n,
  status: "scheduled",
  winner_side: null,
  advances_to_match: next,
  advances_to_position: pos,
  player1_id: p1,
  player2_id: p2,
  team1_label: p1 ? p1.toUpperCase() : null,
  team2_label: p2 ? p2.toUpperCase() : null,
  ...o,
});

// 4-draw: SF1 a v b, SF2 c v BYE(→ c), F
const draw = () => [
  mk("SF1", 1, 1, "F", 1, "a", "b"),
  mk("SF2", 1, 2, "F", 2, "c", null, { team2_label: "BYE", status: "completed", winner_side: 1 }),
  mk("F", 2, 1, null, null, null, null),
];

describe("bracketPredict", () => {
  it("bye feeders send their player through; picks fill the other slot", () => {
    const d = draw();
    expect(candidates(d, d[2], {}).map((c) => c?.id)).toEqual([undefined, "c"]);
    expect(candidates(d, d[2], { SF1: "b" }).map((c) => c?.id)).toEqual(["b", "c"]);
  });

  it("clears downstream picks that become unreachable", () => {
    const d = draw();
    let p = setPick(d, {}, "SF1", "a");
    p = setPick(d, p, "F", "a");
    expect(p).toEqual({ SF1: "a", F: "a" });
    p = setPick(d, p, "SF1", "b");
    expect(p).toEqual({ SF1: "b" });
  });

  it("locks when a real match starts, not on byes", () => {
    const d = draw();
    expect(isLocked(d)).toBe(false);
    d[0] = { ...d[0], status: "in_progress" };
    expect(isLocked(d)).toBe(true);
  });

  it("scores 1 per first-round hit, doubling per round", () => {
    const d = draw();
    d[0] = { ...d[0], status: "completed", winner_side: 1 };
    d[2] = { ...d[2], status: "completed", winner_side: 2, player1_id: "a", player2_id: "c" };
    expect(score(d, { SF1: "a", F: "c" })).toEqual({ points: 3, correct: 2, decided: 2 });
    expect(score(d, { SF1: "b", F: "a" })).toEqual({ points: 0, correct: 0, decided: 2 });
    expect(maxPoints(d)).toBe(3);
    expect(predictableRounds(d)).toHaveLength(2);
  });
});
