import { describe, it, expect } from "vitest";
import { pairRounds } from "./roundRuleCopy";

const r = (round: number, round_name: string | null) => ({ round, round_name });

describe("pairRounds", () => {
  it("pairs rounds by name, ignoring case and spacing", () => {
    const target = [r(1, "Round of 32"), r(2, "Quarterfinal"), r(3, "Final")];
    const source = [r(1, "Round of 64"), r(2, "round of  32"), r(3, "Quarterfinal"), r(4, "Semifinal"), r(5, "Final")];
    expect(Object.fromEntries(pairRounds(target, source))).toEqual({ 1: 2, 2: 3, 3: 5 });
  });

  it("falls back to the same distance from the final", () => {
    const target = [r(1, null), r(2, null), r(3, null)];
    const source = [r(10, "Round of 16"), r(11, "Semifinal"), r(12, "Final")];
    expect(Object.fromEntries(pairRounds(target, source))).toEqual({ 1: 10, 2: 11, 3: 12 });
  });

  it("uses the source's first round when the target draw is deeper", () => {
    const target = [r(1, "Round of 128"), r(2, "Round of 64"), r(3, "Final")];
    const source = [r(1, "Semifinal"), r(2, "Final")];
    expect(Object.fromEntries(pairRounds(target, source))).toEqual({ 1: 1, 2: 1, 3: 2 });
  });

  it("returns nothing for an empty source", () => {
    expect(pairRounds([r(1, "Final")], []).size).toBe(0);
  });
});
