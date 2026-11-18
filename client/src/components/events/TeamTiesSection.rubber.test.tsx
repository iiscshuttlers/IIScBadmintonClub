import { describe, it, expect, vi } from "vitest";

// TeamTiesSection pulls in heavy UI modules; only the pure rubber adapter is under test.
vi.mock("@/components/umpire/TieUmpireConsole", () => ({ TieUmpireConsole: () => null }));
vi.mock("@/components/events/TieVisualLineupModal", () => ({ TieVisualLineupModal: () => null }));
vi.mock("@/components/admin/TeamLineupBuilder", () => ({ TeamLineupBuilder: () => null }));
vi.mock("@/components/events/PlayerMatchBanner", () => ({ PlayerMatchBanner: () => null }));
vi.mock("@/services/teamService", () => ({ teamService: {} }));

import { rubberView } from "./TeamTiesSection";

const base = {
  id: "r1",
  tournament_id: "t1",
  tie_id: "tie1",
  category: "MD",
  rubber_label: "Doubles 1",
  match_code: "T1_R1",
  player1: { full_name: "A One" },
  player3: { full_name: "A Three" },
  player2: { full_name: "B Two" },
  player4: { full_name: "B Four" },
  status: "completed",
  score: "21-15, 18-21, 21:19",
  winner_side: 2,
  court_number: 2,
};

describe("rubberView (team rubbers on the shared match model)", () => {
  it("uses revealed lineup names, parsed games and the winner for a completed rubber", () => {
    const v = rubberView(base, true, "t1");
    expect(v.sides[0].label).toBe("A One / A Three");
    expect(v.sides[1].label).toBe("B Two / B Four");
    expect(v.statusLabel).toBe("Completed");
    expect(v.games).toHaveLength(3);
    expect(v.sides[1].isWinner).toBe(true);
    expect(v.court).toBe("2");
    expect(v.rubberLabel).toBe("Doubles 1");
  });

  it("hides an unrevealed lineup and shows no winner while live", () => {
    const v = rubberView({ ...base, status: "in_progress" }, false, "t1");
    expect(v.sides[0].label).toBe("Hidden lineup");
    expect(v.sides[0].isTbd).toBe(true);
    expect(v.statusLabel).toBe("Live");
    expect(v.sides.some((s) => s.isWinner)).toBe(false);
  });

  it("falls back to the section's tournament id", () => {
    const v = rubberView({ ...base, tournament_id: undefined }, true, "t9");
    expect(v.tournamentId).toBe("t9");
  });
});
