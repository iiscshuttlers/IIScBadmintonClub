import { describe, expect, it } from "vitest";
import { playerDoublesElo, playerElo, playerMixedElo, playerSinglesElo, type Player } from "./shared";

const base: Player = { id: "p1", full_name: "Asha", is_approved: true, created_at: "2026-01-01" };

describe("players admin ratings", () => {
  it("reads the rating columns", () => {
    const p = { ...base, elo_rating: 1310, singles_elo: 1290, doubles_elo: 1350, mixed_elo: 1205 };
    expect([playerElo(p), playerSinglesElo(p), playerDoublesElo(p), playerMixedElo(p)]).toEqual([1310, 1290, 1350, 1205]);
  });

  it("falls back to ratings kept in stats on very old rows", () => {
    const p = { ...base, stats: { eloRating: 1200, singles: 1180 } };
    expect(playerElo(p)).toBe(1200);
    expect(playerSinglesElo(p)).toBe(1180);
    expect(playerDoublesElo(p)).toBeNull();
  });
});
