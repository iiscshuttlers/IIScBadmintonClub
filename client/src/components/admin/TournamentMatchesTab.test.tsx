import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tournament, TournamentMatch } from "@/types/tournament";

const svc = vi.hoisted(() => ({
  fetchTournamentParticipantsByCategory: vi.fn(async () => []),
  adminUpdateTournamentMatch: vi.fn(async () => undefined),
  deleteTournamentMatch: vi.fn(),
  submitTournamentMatch: vi.fn(async () => ({ applied: true })),
  recordTournamentWalkover: vi.fn(),
  undoTournamentMatch: vi.fn(),
  notifyTournamentMatch: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/services/tournamentService", () => svc);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/MatchCorrectionDialog", () => ({ MatchCorrectionDialog: () => null }));
vi.mock("@/components/umpire/PlayerSelect", () => ({ PlayerSelect: () => null }));

import { TournamentMatchesTab } from "./TournamentMatchesTab";

const match = (o: Partial<TournamentMatch> = {}): TournamentMatch => ({
  id: "m1",
  tournament_id: "t1",
  category: "MS",
  match_code: "MS_SF_01",
  round: 3,
  round_name: "Semi-final",
  match_number: 1,
  player1_id: "p1",
  player3_id: null,
  team1_label: "Asha Rao",
  player2_id: "p2",
  player4_id: null,
  team2_label: "Bina Das",
  court_number: null,
  scheduled_at: null,
  points_to_win: 21,
  best_of_sets: 3,
  golden_point: 30,
  winner_side: null,
  winner_id: null,
  score: null,
  sets_history: null,
  status: "scheduled",
  locked: false,
  advances_to_match: "MS_F_01",
  advances_to_position: 1,
  advances_to_match_loser: null,
  advances_to_position_loser: null,
  reminder_sent: null,
  result_revision: 2,
  ...o,
});

function renderTab(matches: TournamentMatch[], extra: { showBulkSchedule?: boolean } = {}) {
  const load = vi.fn(async () => {});
  render(
    <TournamentMatchesTab
      tournament={{ id: "t1", name: "Club Open" } as Tournament}
      matches={matches}
      activeCategory="MS"
      isMasterAdmin
      allPlayers={[]}
      load={load}
      setMatches={vi.fn()}
      confirm={vi.fn(async () => true)}
      session={{ user: { id: "admin-1" } }}
      showBulkSchedule={extra.showBulkSchedule ?? false}
      setShowBulkSchedule={vi.fn()}
    />,
  );
  return { load };
}

function enterGames(games: [string, string][]) {
  const inputs = screen.getAllByPlaceholderText("—");
  games.forEach(([a, b], i) => {
    fireEvent.change(inputs[i * 2], { target: { value: a } });
    fireEvent.change(inputs[i * 2 + 1], { target: { value: b } });
  });
  return inputs;
}

beforeEach(() => vi.clearAllMocks());

describe("TournamentMatchesTab score editor", () => {
  it("saves the winner worked out from the games, not the default side", async () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    enterGames([["15", "21"], ["21", "19"], ["18", "21"]]);

    expect(screen.getByText("(auto-detected)").parentElement).toHaveTextContent("Bina Das");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.submitTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.submitTournamentMatch).toHaveBeenCalledWith({
      p_match_id: "m1",
      p_winner_side: 2,
      p_score: "15-21, 21-19, 18-21",
      p_sets: ["15-21", "21-19", "18-21"],
      p_umpire_id: null,
      p_expected_revision: 2,
    });
  });

  it("locks the deciding game once a side has won two", () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    const inputs = enterGames([["21", "10"], ["21", "12"]]);
    expect(inputs[4]).toBeDisabled();
    expect(inputs[5]).toBeDisabled();
  });

  it("refuses an impossible game score", () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    enterGames([["21", "20"]]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(toast.error).toHaveBeenCalledWith("Invalid score in set 1: 21-20. Enter a mathematically valid badminton score.");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });
});

describe("TournamentMatchesTab bulk schedule", () => {
  it("schedules a pending match from a pasted line", async () => {
    const { load } = renderTab([match({ status: "pending" })], { showBulkSchedule: true });
    fireEvent.change(screen.getByPlaceholderText(/MS_QF_01: Court 3/), {
      target: { value: "MS_SF_01 court=C2 date=2026-06-30 time=10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("✓ Found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save 1 Match" }));
    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m1",
      { court_number: "C2", scheduled_at: new Date("2026-06-30T10:00").toISOString(), status: "scheduled" },
      "Bulk order-of-play schedule update",
    );
    expect(load).toHaveBeenCalled();
  });
});
