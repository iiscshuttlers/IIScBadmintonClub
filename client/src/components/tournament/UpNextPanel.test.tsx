import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { toMatchView, type MatchRow, type MatchView } from "@/lib/matchView";

let mockViews: MatchView[] = [];
vi.mock("@/hooks/queries/useMatchViews", () => ({
  useOpenMatchViews: () => ({ views: mockViews, status: "ready", updatedAt: Date.now(), refreshFailed: false, retry: () => {}, online: true }),
}));

import { UpNextPanel } from "./UpNextPanel";

function row(id: string, over: Partial<MatchRow> = {}): MatchRow {
  return {
    id,
    tournament_id: "t1",
    category: "MS",
    match_code: `MS_${id}`,
    round: 1,
    round_name: "Round 1",
    match_number: Number(id.replace(/\D/g, "")) || 0,
    team1_label: `Left ${id}`,
    team2_label: `Right ${id}`,
    player1_id: null,
    player2_id: null,
    player3_id: null,
    player4_id: null,
    court_number: null,
    status: "scheduled",
    score: null,
    sets_history: null,
    scheduled_at: null,
    started_at: null,
    ended_at: null,
    winner_side: null,
    advances_to_match: null,
    rubber_label: null,
    tie_id: null,
    ...over,
  };
}

describe("UpNextPanel on the shared court queue", () => {
  it("renders nothing without live or court-assigned matches", () => {
    mockViews = [toMatchView(row("m1"))];
    const { container } = render(<UpNextPanel tournamentId="t1" />);
    expect(container.innerHTML).toBe("");
  });

  it("groups by court in push-alert order, caps upcoming at 3 and keeps courtless live matches", () => {
    mockViews = [
      row("m1", { court_number: "C1", status: "in_progress", score: "11-7" }),
      row("m2", { court_number: "C1", scheduled_at: "2026-10-01T05:00:00Z" }),
      row("m3", { court_number: "C1", scheduled_at: "2026-10-01T04:00:00Z" }),
      row("m4", { court_number: "C1" }),
      row("m5", { court_number: "C1" }),
      row("m9", { status: "in_progress" }),
    ].map((r) => toMatchView(r));
    render(<UpNextPanel tournamentId="t1" />);

    const court = screen.getByRole("region", { name: "Court 1" });
    const cards = within(court).getAllByRole("link");
    // Live first, then scheduled time (nulls last), then match number; 3 upcoming max.
    expect(cards.map((a) => a.getAttribute("href"))).toEqual([
      "/tournaments/t1/matches/m1",
      "/tournaments/t1/matches/m3",
      "/tournaments/t1/matches/m2",
      "/tournaments/t1/matches/m4",
    ]);
    expect(within(court).getByText("Live")).toBeTruthy();

    const oop = screen.getByRole("region", { name: "Order of play" });
    expect(within(oop).getByText("Left m9")).toBeTruthy();
  });
});
