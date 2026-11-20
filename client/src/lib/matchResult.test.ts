import { describe, expect, it } from "vitest";
import { playerWon, sideIds, sideOf, winningSide } from "./matchResult";

// Raja (r) partners Manish (m) on side 2 of a doubles match, in the partner slot.
const doubles = { player1_id: "a", player3_id: "b", player2_id: "m", player4_id: "r" };

describe("winningSide", () => {
  it("uses winner_side even when winner_id names another slot or is empty", () => {
    expect(winningSide({ ...doubles, winner_side: 2, winner_id: "m" })).toBe(2);
    expect(winningSide({ ...doubles, winner_side: 1, winner_id: null })).toBe(1); // guest won
  });

  it("falls back to winner_id on either slot of a side when winner_side is missing", () => {
    expect(winningSide({ ...doubles, winner_id: "r" })).toBe(2);
    expect(winningSide({ ...doubles, winner_id: "b" })).toBe(1);
    expect(winningSide({ ...doubles, winner_id: "zzz" })).toBeNull();
    expect(winningSide({ ...doubles })).toBeNull();
  });

  it("understands mapped profile rows and embedded players", () => {
    const mapped = { player1_id: "a", team1_partner_id: "b", player2_id: "m", team2_partner_id: "r", winner_id: "r" };
    expect(winningSide(mapped)).toBe(2);
    expect(winningSide({ player1: { id: "a" }, player2: { id: "c" }, match_winner_id: "c" })).toBe(2);
  });
});

describe("playerWon / sideOf", () => {
  it("credits the partner-slot player with their side's win", () => {
    const m = { ...doubles, winner_side: 2, winner_id: "m" };
    expect(sideOf(m, "r")).toBe(2);
    expect(playerWon(m, "r")).toBe(true);
    expect(playerWon(m, "m")).toBe(true);
    expect(playerWon(m, "a")).toBe(false);
  });

  it("is null when the player is absent or there is no result", () => {
    expect(playerWon({ ...doubles, winner_side: 1 }, "x")).toBeNull();
    expect(playerWon({ ...doubles }, "r")).toBeNull();
    expect(playerWon({ ...doubles, winner_side: 1 }, null)).toBeNull();
  });

  it("lists each side once", () => {
    expect(sideIds({ player1_id: "a", team1_partner_id: "b", player3_id: "b", player1: { id: "a" } }, 1)).toEqual(["a", "b"]);
  });
});
