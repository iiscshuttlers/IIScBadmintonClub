import { describe, expect, it } from "vitest";
import { makeDrawWarnings, seedsAreSignUpOrder } from "./drawWarnings";

const r = (id: string, category: string, player_id: string, partner_id: string | null, seed: number, at: string) =>
  ({ id, category, player_id, partner_id, seed, created_at: at });

describe("makeDrawWarnings", () => {
  it("flags shared partners, partner-less doubles and sign-up-order seeds", () => {
    const rows = [r("1", "MD", "a", "c", 1, "2026-11-01"), r("2", "MD", "b", "c", 2, "2026-11-02"), r("3", "MD", "d", null, 3, "2026-11-03")];
    expect(makeDrawWarnings(rows, ["MD"], { flagOn: true })).toEqual([
      "MD: 1 player(s) are in two pairs.",
      "MD: 1 doubles entry has no partner.",
      "MD: seeds are in sign-up order; set seeds first.",
    ]);
  });
  it("is quiet when seeds were set by hand and pairs are clean", () => {
    const rows = [r("1", "MD", "a", "b", 2, "2026-11-01"), r("2", "MD", "c", "d", 1, "2026-11-02")];
    expect(makeDrawWarnings(rows, ["MD"], { flagOn: true })).toEqual([]);
  });
  it("singles without partners are fine; flag off says nothing", () => {
    const rows = [r("1", "MS", "a", null, 2, "2026-11-01"), r("2", "MS", "b", null, 1, "2026-11-02")];
    expect(makeDrawWarnings(rows, ["MS"], { flagOn: true })).toEqual([]);
    expect(makeDrawWarnings([r("1", "MD", "a", null, 1, "x")], ["MD"], { flagOn: false })).toEqual([]);
  });
  it("seedsAreSignUpOrder needs two or more rows", () => {
    expect(seedsAreSignUpOrder([r("1", "MS", "a", null, 1, "x")])).toBe(false);
  });
});
