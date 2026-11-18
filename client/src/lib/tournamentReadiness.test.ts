import { describe, expect, it } from "vitest";
import { 
  evaluateTournamentReadiness, 
  evaluateLifecycleReadiness 
} from "./tournamentReadiness";

describe("evaluateTournamentReadiness", () => {
  it("does not pass when only one of several matches is scheduled", () => {
    const checks = evaluateTournamentReadiness({
      tournament: { name: "Open", start_date: "2026-11-20", venue: "Gymkhana", status: "draft" },
      participants: [{ category: "MS" }, { category: "MS" }],
      matches: [
        { player1_id: "a", player2_id: "b", court_number: "1", scheduled_at: "2026-11-20T10:00:00Z", points_to_win: 21, best_of_sets: 3, golden_point: 30, umpired_by: "u" },
        { player1_id: "c", player2_id: "d", points_to_win: 21, best_of_sets: 3, golden_point: 30 },
      ],
    });
    expect(checks.find((check) => check.key === "schedule")).toMatchObject({ state: "fail", detail: "1/2 currently playable matches have a court and time." });
  });

  it("flags an unresolved XD partner", () => {
    const checks = evaluateTournamentReadiness({
      tournament: { name: "Open", start_date: "2026-11-20", venue: "Gymkhana" },
      participants: [{ id: "p1", category: "XD", player_id: "a", partner_id: null, display_name: "A" } as any],
    });
    expect(checks.find((check) => check.key === "entrants")).toMatchObject({ state: "fail" });
  });

  it("returns unknown instead of green checks when data failed to load", () => {
    const checks = evaluateTournamentReadiness({ tournament: { start_date: "x", venue: "y" }, dataError: true });
    expect(checks.every((check) => check.state === "unknown")).toBe(true);
  });
});

describe("evaluateLifecycleReadiness", () => {
  describe("announce stage", () => {
    it("blocks announce when name, start_date or venue are missing", () => {
      const report = evaluateLifecycleReadiness({
        action: "announce",
        tournament: { name: "", start_date: null, venue: "" },
      });
      expect(report.allowed).toBe(false);
      expect(report.blockers.map((b) => b.code)).toContain("MISSING_DETAILS");
      expect(report.blockers.every((b) => b.fix_tab === "setup")).toBe(true);
    });

    it("allows announce with basic details and surfaces non-blocking warnings", () => {
      const report = evaluateLifecycleReadiness({
        action: "announce",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
          description: "",
          categories: [],
        },
      });
      expect(report.allowed).toBe(true);
      expect(report.blockers).toHaveLength(0);
      expect(report.warnings.map((w) => w.code)).toEqual(
        expect.arrayContaining(["MISSING_DESCRIPTION", "NO_CATEGORIES"])
      );
    });
  });

  describe("publish_draw stage", () => {
    it("blocks draw publication when entrants, fixtures or scoring are missing", () => {
      const report = evaluateLifecycleReadiness({
        action: "publish_draw",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
        },
        participants: [],
        matches: [],
      });
      expect(report.allowed).toBe(false);
      expect(report.blockers.map((b) => b.code)).toContain("EMPTY_ENTRANTS");
      expect(report.blockers.map((b) => b.code)).toContain("NO_FIXTURES");
    });

    it("blocks draw publication when doubles entry is missing a partner", () => {
      const report = evaluateLifecycleReadiness({
        action: "publish_draw",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
        },
        participants: [
          { id: "p1", category: "MD", partner_id: null, display_name: "Player 1" },
          { id: "p2", category: "MS", partner_id: null, display_name: "Player 2" },
        ],
        matches: [
          { id: "m1", points_to_win: 21, best_of_sets: 3 },
        ],
      });
      expect(report.allowed).toBe(false);
      const blocker = report.blockers.find((b) => b.code === "UNRESOLVED_PAIRS");
      expect(blocker).toBeDefined();
      expect(blocker?.entity_ids).toEqual(["p1"]);
      expect(blocker?.fix_tab).toBe("participants");
    });

    it("blocks draw publication when match scoring is invalid (even sets or zero points)", () => {
      const report = evaluateLifecycleReadiness({
        action: "publish_draw",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
        },
        participants: [
          { id: "p1", category: "MS" },
          { id: "p2", category: "MS" },
        ],
        matches: [
          { id: "m1", points_to_win: 21, best_of_sets: 2 }, // even sets is invalid in badminton
        ],
      });
      expect(report.allowed).toBe(false);
      const blocker = report.blockers.find((b) => b.code === "INVALID_SCORING");
      expect(blocker).toBeDefined();
      expect(blocker?.entity_ids).toEqual(["m1"]);
      expect(blocker?.fix_tab).toBe("rules");
    });

    it("allows draw publication when entrants, resolved pairs, fixtures and scoring are valid", () => {
      const report = evaluateLifecycleReadiness({
        action: "publish_draw",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
        },
        participants: [
          { id: "p1", category: "MS" },
          { id: "p2", category: "MS" },
        ],
        matches: [
          { id: "m1", points_to_win: 21, best_of_sets: 3, golden_point: 30 },
        ],
      });
      expect(report.allowed).toBe(true);
      expect(report.blockers).toHaveLength(0);
    });

    it("supports team tournament draw checks using teamCount and tieCount", () => {
      const report = evaluateLifecycleReadiness({
        action: "publish_draw",
        tournament: {
          name: "Inter-Lab Trophy",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
          format_family: "TEAM",
        },
        teamCount: 4,
        tieCount: 2,
        matches: [
          { id: "m1", points_to_win: 21, best_of_sets: 3 },
        ],
      });
      expect(report.allowed).toBe(true);
      expect(report.blockers).toHaveLength(0);
    });
  });

  describe("start_play stage", () => {
    it("blocks start_play when no playable matches are populated", () => {
      const report = evaluateLifecycleReadiness({
        action: "start_play",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
        },
        participants: [{ id: "p1", category: "MS" }, { id: "p2", category: "MS" }],
        matches: [
          { id: "m1", player1_id: "p1", player2_id: null, points_to_win: 21, best_of_sets: 3 },
        ],
      });
      expect(report.allowed).toBe(false);
      expect(report.blockers.map((b) => b.code)).toContain("NO_PLAYABLE_MATCHES");
    });

    it("blocks start_play when playable match lacks court or scheduled time", () => {
      const report = evaluateLifecycleReadiness({
        action: "start_play",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
        },
        participants: [{ id: "p1", category: "MS" }, { id: "p2", category: "MS" }],
        matches: [
          { id: "m1", player1_id: "p1", player2_id: "p2", points_to_win: 21, best_of_sets: 3, court_number: null, scheduled_at: null },
        ],
      });
      expect(report.allowed).toBe(false);
      const blocker = report.blockers.find((b) => b.code === "UNSCHEDULED_PLAYABLE_MATCHES");
      expect(blocker).toBeDefined();
      expect(blocker?.entity_ids).toEqual(["m1"]);
      expect(blocker?.fix_tab).toBe("schedule");
    });

    it("blocks start_play when playable match overlaps court blackout period", () => {
      const report = evaluateLifecycleReadiness({
        action: "start_play",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
          unavailable_court_periods: [
            { court: "Court 1", start: "2026-12-01T10:00:00Z", end: "2026-12-01T11:00:00Z" },
          ],
          estimated_match_minutes: 30,
        },
        participants: [{ id: "p1", category: "MS" }, { id: "p2", category: "MS" }],
        matches: [
          {
            id: "m1",
            player1_id: "p1",
            player2_id: "p2",
            points_to_win: 21,
            best_of_sets: 3,
            court_number: "Court 1",
            scheduled_at: "2026-12-01T10:15:00Z",
            umpired_by: "ump1",
          },
        ],
      });
      expect(report.allowed).toBe(false);
      const blocker = report.blockers.find((b) => b.code === "HARD_SCHEDULE_CONFLICT");
      expect(blocker).toBeDefined();
      expect(blocker?.entity_ids).toEqual(["m1"]);
      expect(blocker?.fix_tab).toBe("schedule");
    });

    it("allows start_play when scheduled playable matches have no conflicts, and flags missing officials as warning", () => {
      const report = evaluateLifecycleReadiness({
        action: "start_play",
        tournament: {
          name: "Annual Open",
          start_date: "2026-12-01T09:00:00Z",
          venue: "Old Gymkhana",
          unavailable_court_periods: [],
        },
        participants: [{ id: "p1", category: "MS" }, { id: "p2", category: "MS" }],
        matches: [
          {
            id: "m1",
            player1_id: "p1",
            player2_id: "p2",
            points_to_win: 21,
            best_of_sets: 3,
            court_number: "Court 2",
            scheduled_at: "2026-12-01T09:30:00Z",
            umpired_by: null, // missing umpire is a warning, not a blocker
          },
        ],
      });
      expect(report.allowed).toBe(true);
      expect(report.blockers).toHaveLength(0);
      expect(report.warnings.map((w) => w.code)).toContain("MISSING_OFFICIALS");
    });
  });

  describe("data error handling", () => {
    it("returns blocking DATA_ERROR when dataError flag is set", () => {
      const report = evaluateLifecycleReadiness({
        action: "start_play",
        tournament: { name: "Open", start_date: "2026-12-01", venue: "Gym" },
        dataError: true,
      });
      expect(report.allowed).toBe(false);
      expect(report.blockers[0]?.code).toBe("DATA_ERROR");
    });
  });
});
