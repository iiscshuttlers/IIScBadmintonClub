import { describe, expect, it } from "vitest";
import { isTieRevealed, tieCourts, type RubberRow } from "./organizerTieStatus";

const rubber = (o: Partial<RubberRow>): RubberRow => ({
  tie_id: "t1",
  court_number: null,
  status: "scheduled",
  player1_id: null,
  player2_id: null,
  is_decider_tiebreaker: false,
  ...o,
});

describe("isTieRevealed", () => {
  it("is false until every regular rubber has both sides' players", () => {
    const matches = [rubber({ player1_id: "a", player2_id: "b" }), rubber({ player1_id: "c" })];
    expect(isTieRevealed("t1", matches)).toBe(false);
    matches[1].player2_id = "d";
    expect(isTieRevealed("t1", matches)).toBe(true);
  });

  it("ignores the golden decider and other ties, and needs at least one rubber", () => {
    const matches = [
      rubber({ player1_id: "a", player2_id: "b" }),
      rubber({ is_decider_tiebreaker: true }),
      rubber({ tie_id: "t2" }),
    ];
    expect(isTieRevealed("t1", matches)).toBe(true);
    expect(isTieRevealed("t9", matches)).toBe(false);
  });
});

describe("tieCourts", () => {
  it("lists the distinct courts of unfinished rubbers in natural order", () => {
    const matches = [
      rubber({ court_number: "C10" }),
      rubber({ court_number: "C2" }),
      rubber({ court_number: "C2" }),
      rubber({ court_number: "C1", status: "completed" }),
      rubber({ court_number: " " }),
      rubber({ tie_id: "t2", court_number: "C3" }),
    ];
    expect(tieCourts("t1", matches)).toEqual(["C2", "C10"]);
  });

  it("is empty when no rubber has a court", () => {
    expect(tieCourts("t1", [rubber({})])).toEqual([]);
  });
});
