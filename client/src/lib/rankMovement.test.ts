import { describe, expect, it } from "vitest";
import { movementLabel, toMovementMap, type RankMovement } from "@/lib/rankMovement";
import { calculateRanksMap } from "@/lib/rankingUtils";

const base: RankMovement = { rank: 5, previousRank: 8, delta: 3, status: "moved", since: "2026-11-16", peakRank: 2 };

describe("movementLabel", () => {
  it("labels up, down, same, new and re-entry with words as well as arrows", () => {
    expect(movementLabel(base)).toMatchObject({ text: "▲3", tone: "up" });
    expect(movementLabel(base)!.long).toMatch(/^Up 3 places since .* \(was 8\)$/);
    expect(movementLabel({ ...base, delta: -1, previousRank: 4 })).toMatchObject({ text: "▼1", tone: "down" });
    expect(movementLabel({ ...base, delta: 0 })).toMatchObject({ text: "–", tone: "same" });
    expect(movementLabel({ ...base, status: "new", delta: null })).toMatchObject({ text: "NEW" });
    expect(movementLabel({ ...base, status: "re", delta: null })).toMatchObject({ text: "RE" });
  });
  it("shows nothing before the first comparison snapshot", () => {
    expect(movementLabel({ ...base, status: "none" })).toBeNull();
    expect(movementLabel(undefined)).toBeNull();
  });
});

describe("toMovementMap", () => {
  it("maps RPC rows by player and guards unknown statuses", () => {
    const m = toMovementMap([
      { player_id: "p", rank: 1, previous_rank: 2, delta: 1, status: "moved", since: "2026-11-16", peak_rank: 1 },
      { player_id: "q", rank: 2, previous_rank: null, delta: null, status: "weird", since: null, peak_rank: 2 },
    ]);
    expect(m.p.delta).toBe(1);
    expect(m.q.status).toBe("none");
  });
});

/**
 * The weekly snapshot SQL (migration 20261115100000, current_club_ranks)
 * mirrors this rule: exclude null/1200, rating desc then win % desc, ties share
 * a rank and the next rank skips. If this test changes, change the SQL too.
 */
describe("club rank rule (mirrored in SQL)", () => {
  it("ranks by rating, then win %, with shared ranks that skip", () => {
    const r = calculateRanksMap([
      { id: "a", elo_rating: 1300, win_loss_record: "5W - 1L" },
      { id: "b", elo_rating: 1300, win_loss_record: "5W - 1L" },
      { id: "c", elo_rating: 1300, win_loss_record: "1W - 1L" },
      { id: "d", elo_rating: 1250, win_loss_record: "0W - 0L" },
      { id: "e", elo_rating: 1200, win_loss_record: "9W - 0L" },
      { id: "f", elo_rating: null },
    ]);
    expect([r.a.overall, r.b.overall, r.c.overall, r.d.overall, r.e.overall, r.f.overall]).toEqual([1, 1, 3, 4, 0, 0]);
  });
});
