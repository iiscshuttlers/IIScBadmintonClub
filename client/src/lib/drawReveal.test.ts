import { describe, it, expect } from "vitest";
import { buildDraw, type DrawMatch } from "./drawReveal";

const m = (o: Partial<DrawMatch>): DrawMatch => ({
  id: Math.random().toString(36).slice(2),
  category: "MS",
  round: 1,
  match_number: 1,
  team1_label: "A",
  team2_label: "B",
  ...o,
});

describe("buildDraw", () => {
  it("takes the first round per category in match order, flags byes", () => {
    const d = buildDraw([
      m({ category: "XD", match_number: 2, team1_label: "P", team2_label: "BYE" }),
      m({ category: "XD", match_number: 1 }),
      m({ category: "XD", round: 2, match_number: 1 }),
      m({ category: "MS", round: 2 }), // MS draw starts at round 2 (e.g. byes collapsed)
      m({ category: "MS", round: 3 }),
      m({ category: "MS", tie_id: "t" }), // team rubber, ignored
    ]);
    expect(d.map((c) => c.category)).toEqual(["MS", "XD"]);
    expect(d[0].pairs).toHaveLength(1);
    expect(d[1].pairs.map((p) => [p.slot, p.isBye])).toEqual([[1, false], [2, true]]);
  });

  it("labels missing sides as TBD", () => {
    const [c] = buildDraw([m({ team1_label: null, team2_label: null })]);
    expect(c.pairs[0].side1).toBe("TBD");
  });
});
