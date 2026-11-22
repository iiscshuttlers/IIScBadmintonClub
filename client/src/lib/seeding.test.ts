import { describe, expect, it } from "vitest";
import { publishedSeedCount, publishedSeeds, seedForSide } from "./seeding";

describe("publishedSeedCount", () => {
  it("follows the BWF draw-size table", () => {
    expect(publishedSeedCount(3)).toBe(0);
    expect(publishedSeedCount(4)).toBe(2);
    expect(publishedSeedCount(15)).toBe(2);
    expect(publishedSeedCount(16)).toBe(4);
    expect(publishedSeedCount(31)).toBe(4);
    expect(publishedSeedCount(32)).toBe(8);
    expect(publishedSeedCount(63)).toBe(8);
    expect(publishedSeedCount(64)).toBe(16);
    expect(publishedSeedCount(105)).toBe(16);
  });
});

describe("publishedSeeds", () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    seed: i + 1,
    player_id: `p${i + 1}`,
    partner_id: i === 1 ? "partner2" : null,
    display_name: i === 3 ? "Guest Four" : `Player ${i + 1}`,
  }));

  it("keeps only the top seeds for the draw size (20 entries → 4)", () => {
    const s = publishedSeeds(entries);
    expect(s.count).toBe(4);
    expect(s.byId.get("p1")).toBe(1);
    expect(s.byId.get("p4")).toBe(4);
    expect(s.byId.has("p5")).toBe(false);
  });

  it("maps doubles partners and names", () => {
    const s = publishedSeeds(entries);
    expect(s.byId.get("partner2")).toBe(2);
    expect(s.byName.get("guest four")).toBe(4);
  });

  it("ignores missing seeds", () => {
    const s = publishedSeeds([{ seed: null, player_id: "x" }, ...entries.slice(0, 5)]);
    expect(s.byId.has("x")).toBe(false);
  });
});

describe("seedForSide", () => {
  const s = publishedSeeds(
    Array.from({ length: 8 }, (_, i) => ({ seed: i + 1, player_id: i === 1 ? null : `p${i + 1}`, display_name: `Name ${i + 1}` })),
  );

  it("finds a seed by any player id, then by label", () => {
    expect(seedForSide(s, [null, "p1"], "Whatever")).toBe(1);
    expect(seedForSide(s, [null], "  name 2 ")).toBe(2);
    expect(seedForSide(s, ["p7"], "Name 7")).toBeNull();
    expect(seedForSide(null, ["p1"], "Name 1")).toBeNull();
  });
});
