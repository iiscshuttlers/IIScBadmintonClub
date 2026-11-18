import { describe, expect, it } from "vitest";
import { groupByStageDesc, stageOf } from "./roundOrder";

describe("stageOf", () => {
  it("reads the stage from generator and hand-typed round names", () => {
    expect(stageOf({ round_name: "Final" }).rank).toBe(0);
    expect(stageOf({ round_name: "Grand Final" }).rank).toBe(0);
    expect(stageOf({ round_name: "3rd Place Playoff" }).rank).toBe(0.5);
    expect(stageOf({ round_name: "Semifinal" }).rank).toBe(1);
    expect(stageOf({ roundName: "Semi-final" }).rank).toBe(1);
    expect(stageOf({ round_name: "Quarterfinal" }).rank).toBe(2);
    expect(stageOf({ round_name: "Round of 16" }).rank).toBe(3);
    expect(stageOf({ round_name: "Round of 32" }).short).toBe("R32");
    expect(stageOf({ round_name: "Round of 128" }).rank).toBe(6);
  });

  it("falls back to distance from the event's last round", () => {
    expect(stageOf({ round: 3, round_name: "Round 3" }, 3).rank).toBe(0);
    expect(stageOf({ round: 1, round_name: "Round 1" }, 3).rank).toBe(2);
    expect(stageOf({ round: 2, round_name: "" }, 2).label).toBe("Round 2");
  });
});

describe("groupByStageDesc", () => {
  it("puts Finals first across events with different draw sizes", () => {
    const rows = [
      { id: "ms-r1", category: "MS", round: 1, round_name: "Round of 32" },
      { id: "xd-f", category: "XD", round: 2, round_name: "Final" },
      { id: "ms-qf", category: "MS", round: 3, round_name: "Quarterfinal" },
      { id: "ms-3rd", category: "MS", round: 4, round_name: "3rd Place Playoff" },
      { id: "ms-sf", category: "MS", round: 4, round_name: "Semifinal" },
      { id: "ms-f", category: "MS", round: 5, round_name: "Final" },
      { id: "xd-sf", category: "XD", round: 1, round_name: "Semifinal" },
    ];
    const groups = groupByStageDesc(rows, (m) => m.category);
    expect(groups.map((g) => g.stage.short)).toEqual(["Final", "3rd", "SF", "QF", "R32"]);
    expect(groups[0].items.map((m) => m.id)).toEqual(["xd-f", "ms-f"]);
    expect(groups[2].items.map((m) => m.id)).toEqual(["ms-sf", "xd-sf"]);
  });
});
