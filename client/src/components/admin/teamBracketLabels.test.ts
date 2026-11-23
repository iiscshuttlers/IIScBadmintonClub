import { describe, expect, it } from "vitest";
import { feederLabels } from "./teamBracketLabels";

const tie = (id: string, tie_code: string, o: Partial<Parameters<typeof feederLabels>[0][number]> = {}) => ({
  id,
  tie_code,
  advances_to_tie: null,
  advances_to_slot: null,
  loser_advances_to_tie: null,
  loser_advances_to_slot: null,
  ...o,
});

describe("feederLabels", () => {
  it("names undecided final and playoff sides after the semi-finals that feed them", () => {
    const labels = feederLabels([
      tie("sf1", "SF1", { advances_to_tie: "f", advances_to_slot: "A", loser_advances_to_tie: "p3", loser_advances_to_slot: "A" }),
      tie("sf2", "SF2", { advances_to_tie: "f", advances_to_slot: "B", loser_advances_to_tie: "p3", loser_advances_to_slot: "B" }),
      tie("f", "FINAL"),
      tie("p3", "3RD"),
    ]);
    expect(labels.get("f")).toEqual({ A: "Winner of SF1", B: "Winner of SF2" });
    expect(labels.get("p3")).toEqual({ A: "Loser of SF1", B: "Loser of SF2" });
    expect(labels.get("sf1")).toBeUndefined();
  });

  it("ignores links without a valid slot", () => {
    expect(feederLabels([tie("a", "QF1", { advances_to_tie: "b", advances_to_slot: null })]).size).toBe(0);
  });
});
