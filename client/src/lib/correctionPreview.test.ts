import { describe, expect, it } from "vitest";
import {
  blockerMessage,
  blockersFor,
  classifyCorrectionError,
  parseCorrectionPreview,
  parseGamesInput,
  winnerFromGames,
} from "./correctionPreview";

const raw = {
  match_id: "m1",
  tournament_id: "t1",
  match_code: "MS_QF_01",
  status: "completed",
  revision: "3",
  winner_side: 1,
  score: "21-19, 21-17",
  sets: ["21-19", "21-17"],
  counts_for_elo: true,
  is_team_rubber: false,
  winner_change: false,
  elo_effect: "unchanged",
  downstream: [
    { match_id: "m2", match_code: "MS_SF_01", path: "winner", position: 1, status: "scheduled", team1_label: "A", team2_label: null, started: false },
  ],
  blockers: [],
  undoable_event_id: 12,
};

describe("parseCorrectionPreview", () => {
  it("parses the server preview", () => {
    const p = parseCorrectionPreview(raw);
    expect(p.revision).toBe(3);
    expect(p.winnerSide).toBe(1);
    expect(p.downstream[0]).toMatchObject({ matchCode: "MS_SF_01", path: "winner", position: 1, started: false });
    expect(p.undoableEventId).toBe(12);
  });
  it("keeps unknown blocker codes so the dialog fails closed", () => {
    const p = parseCorrectionPreview({ ...raw, blockers: ["future_rule"] });
    expect(blockersFor(p, 1)).toEqual(["future_rule"]);
    expect(blockerMessage("future_rule")).toMatch(/Blocked by the server/);
  });
});

describe("blockersFor", () => {
  it("blocks a ranked winner change but allows a score-only correction", () => {
    const p = parseCorrectionPreview(raw);
    expect(blockersFor(p, 1)).toEqual([]);
    expect(blockersFor(p, 2)).toEqual(["ranked_winner_change"]);
  });
  it("blocks any change once a downstream match has started", () => {
    const p = parseCorrectionPreview({ ...raw, counts_for_elo: false, blockers: ["downstream_started"] });
    expect(blockersFor(p, 1)).toEqual(["downstream_started"]);
  });
  it("blocks a winner change on a team rubber", () => {
    const p = parseCorrectionPreview({ ...raw, counts_for_elo: false, is_team_rubber: true });
    expect(blockersFor(p, 2)).toEqual(["team_winner_change"]);
  });
});

describe("parseGamesInput / winnerFromGames", () => {
  it("accepts commas, spaces, en dashes and colons", () => {
    expect(parseGamesInput("21-19, 18–21 21:17").games).toEqual(["21-19", "18-21", "21-17"]);
  });
  it("rejects malformed and tied games", () => {
    expect(parseGamesInput("21-19, x").error).toMatch(/not a game score/);
    expect(parseGamesInput("20-20").error).toMatch(/tied/);
    expect(parseGamesInput("  ").error).toMatch(/at least one/);
  });
  it("derives the winner from games won", () => {
    expect(winnerFromGames(["21-19", "18-21", "21-17"])).toBe(1);
    expect(winnerFromGames(["19-21", "18-21"])).toBe(2);
    expect(winnerFromGames(["21-19", "19-21"])).toBeNull();
  });
});

describe("classifyCorrectionError", () => {
  it("distinguishes stale, superseded, downstream, winner-change and permission errors", () => {
    expect(classifyCorrectionError({ code: "40001", message: "result_revision_conflict: expected 1, current 2" })).toBe("stale");
    expect(classifyCorrectionError({ code: "40001", message: "correction_superseded: x" })).toBe("superseded");
    expect(classifyCorrectionError({ code: "42501", message: "downstream_match_started: x" })).toBe("downstream");
    expect(classifyCorrectionError({ code: "0A000", message: "winner_change_requires_coordinated_correction: x" })).toBe("winner_change");
    expect(classifyCorrectionError({ code: "42501", message: "Not authorized" })).toBe("forbidden");
    expect(classifyCorrectionError({ message: "boom" })).toBe("other");
  });
});
