import { describe, it, expect } from "vitest";
import { computeStakes, formatRange } from "./eloStakes";

describe("computeStakes", () => {
  it("even match, experienced player: ±15 for 3 games, ±18 for 2", () => {
    const s = computeStakes(1500, null, [1500], 30);
    expect(s.expected).toBeCloseTo(0.5);
    expect(s.win).toEqual([15, 18]);
    expect(s.lose).toEqual([-18, -15]);
  });

  it("underdog gains more than favourite", () => {
    const under = computeStakes(1300, null, [1500], 30);
    const fav = computeStakes(1500, null, [1300], 30);
    expect(under.win[1]).toBeGreaterThan(fav.win[1]);
    expect(Math.abs(fav.lose[0])).toBeGreaterThan(Math.abs(under.lose[0]));
  });

  it("uses pair averages and newbie K", () => {
    const s = computeStakes(1400, 1600, [1500, 1500], 3);
    expect(s.win).toEqual([30, 36]);
  });

  it("formats ranges", () => {
    expect(formatRange([15, 18])).toBe("+15…18");
    expect(formatRange([-18, -15])).toBe("−18…−15");
    expect(formatRange([7, 7])).toBe("+7");
  });
});
