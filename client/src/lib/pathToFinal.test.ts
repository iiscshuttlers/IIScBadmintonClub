import { describe, it, expect } from "vitest";
import { computePath, type PathMatch } from "./pathToFinal";

const mk = (id: string, round: number, next: string | null, p1: string | null, p2: string | null, o: Partial<PathMatch> = {}): PathMatch => ({
  id,
  round,
  round_name: round === 3 ? "Final" : round === 2 ? "Semi-Final" : "Quarter-Final",
  status: "scheduled",
  winner_side: null,
  advances_to_match: next,
  player1_id: p1,
  player2_id: p2,
  player3_id: null,
  player4_id: null,
  team1_label: p1 ? p1.toUpperCase() : null,
  team2_label: p2 ? p2.toUpperCase() : null,
  ...o,
});

// 8-draw: QF a,b → SF s1; QF c,d → SF s2; s1,s2 → F
const ELO: Record<string, number> = { me: 1500, x: 1400, y: 1600, z: 1300, w: 1700, v: 1200, u: 1550, t: 1450 };
const elo = (id: string) => ELO[id];
const draw = (): PathMatch[] => [
  mk("a", 1, "s1", "me", "x"),
  mk("b", 1, "s1", "y", "z"),
  mk("c", 1, "s2", "w", "v"),
  mk("d", 1, "s2", "u", "t"),
  mk("s1", 2, "f", null, null),
  mk("s2", 2, "f", null, null),
  mk("f", 3, null, null, null),
];

describe("computePath", () => {
  it("predicts the higher-rated side in each round", () => {
    const p = computePath(draw(), "me", elo);
    expect(p.map((s) => [s.roundName, s.opponent?.label, s.predicted])).toEqual([
      ["Quarter-Final", "X", false],
      ["Semi-Final", "Y", true],
      ["Final", "W", true],
    ]);
    expect(p[0].winProb!).toBeGreaterThan(0.5);
    expect(p[2].winProb!).toBeLessThan(0.5);
  });

  it("uses actual results and filled slots", () => {
    const d = draw();
    d[0] = { ...d[0], winner_side: 1, status: "completed" };
    d[1] = { ...d[1], winner_side: 2, status: "completed" }; // upset: z beats y
    d[4] = { ...d[4], player1_id: "me", team1_label: "ME", player2_id: "z", team2_label: "Z" };
    const p = computePath(d, "me", elo);
    expect(p[0].roundName).toBe("Semi-Final");
    expect(p[0].opponent?.label).toBe("Z");
    expect(p[0].predicted).toBe(false);
  });

  it("follows match_code links (how real brackets store advances_to_match)", () => {
    const d = draw().map((m) => ({ ...m, match_code: `C_${m.id}`, advances_to_match: m.advances_to_match ? `C_${m.advances_to_match}` : null }));
    expect(computePath(d, "me", elo).map((s) => s.opponent?.label)).toEqual(["X", "Y", "W"]);
  });

  it("returns nothing once knocked out", () => {
    const d = draw();
    d[0] = { ...d[0], winner_side: 2, status: "completed" };
    expect(computePath(d, "me", elo)).toEqual([]);
  });
});
