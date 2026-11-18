import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAdmin: false }) }));
vi.mock("@/contexts/ConfirmContext", () => ({ useConfirm: () => ({ confirm: async () => false }) }));
vi.mock("@/hooks/useUserMatchAlerts", () => ({ useUserMatchAlerts: () => [] }));
vi.mock("@/services/tournamentService", () => ({ deleteTournamentMatch: vi.fn() }));
vi.mock("./EditVideoModal", () => ({ EditVideoModal: () => null }));
vi.mock("./VideoPlayerModal", () => ({ VideoPlayerModal: () => null }));
vi.mock("./MatchScorecardModal", () => ({ MatchScorecardModal: () => null }));
vi.mock("../pulse/MatchReminderModal", () => ({ MatchReminderModal: () => null }));

import { MatchCard } from "./MatchCard";

/** A tournament_matches row as fetchFeedMatches maps it. */
function row(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    tournament_id: "t1",
    is_friendly: false,
    match_code: "XD_R1_M1",
    match_number: 1,
    category: "XD",
    round_name: "Round 1",
    team1_label: "Alpha Player / Beta Player",
    team2_label: "Gamma Player / Delta Player",
    player1: null,
    player2: null,
    partner1: null,
    partner2: null,
    status: "completed",
    score: "21-13, 21-11",
    sets_history: null,
    winner_side: 1,
    winner_id: null,
    court_number: "C1",
    scheduled_at: "2026-10-01T04:30:00Z",
    started_at: "2026-10-01T04:35:00Z",
    ended_at: "2026-10-01T05:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function renderCard(match: Record<string, unknown>, isExpanded = true) {
  return render(
    <MatchCard match={match} currentUser={null} isExpanded={isExpanded} />,
  );
}

describe("MatchCard — tournament rows on the shared match model", () => {
  it("writes the status, marks the winner, splits games and links to the match page", () => {
    renderCard(row());
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getByText("defeated")).toBeTruthy();
    expect(screen.getByText("Set 1")).toBeTruthy();
    expect(screen.getByText("Set 2")).toBeTruthy();
    const link = screen.getByText(/Match details/).closest("a")!;
    expect(link.getAttribute("href")).toBe("/tournaments/t1/matches/m1");
    // Scheduled, started and finished stay separate; created_at is never shown as a time.
    const times = screen.getByText(/^Scheduled /).textContent!;
    expect(times).toContain("Started");
    expect(times).toContain("Finished");
    expect(screen.getByText("Court 1")).toBeTruthy();
  });

  it("does not show a winner while the status column says the match is live", () => {
    renderCard(row({ status: "in_progress", winner_side: 1, ended_at: null }));
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
    expect(screen.queryByText("defeated")).toBeNull();
  });

  it("parses colon and en-dash game scores via parseGames", () => {
    renderCard(row({ score: "21:13, 19–21, 21-9" }));
    expect(screen.getByText("Set 3")).toBeTruthy();
  });

  it("does not invent a time for an unscheduled match", () => {
    renderCard(row({ status: "pending", winner_side: null, score: null, scheduled_at: null, started_at: null, ended_at: null, court_number: null }));
    expect(screen.getAllByText("Not yet scheduled").length).toBeGreaterThan(0);
    expect(screen.getByText("No scheduled time")).toBeTruthy();
  });

  it("collapsed card shows the written status", () => {
    renderCard(row({ status: "walkover", score: null }), false);
    expect(screen.getByText("Walkover")).toBeTruthy();
  });
});
