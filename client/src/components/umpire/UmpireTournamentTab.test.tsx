import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const svc = vi.hoisted(() => ({
  fetchUmpirePickerTournaments: vi.fn(),
  fetchUmpireOpenMatches: vi.fn(),
  fetchUmpireDoneMatches: vi.fn(),
  fetchRoundRulesForTournaments: vi.fn(),
  subscribeToUmpireTournamentMatches: vi.fn(() => () => {}),
  adminUpdateTournamentMatch: vi.fn(),
  submitTournamentMatch: vi.fn(),
  recordTournamentWalkover: vi.fn(),
  notifyTournamentMatch: vi.fn(),
  deleteTournamentMatch: vi.fn(),
  deleteTournamentMatches: vi.fn(),
  invokeCallToCourt: vi.fn(),
  fetchTournamentRowOrNull: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }));

vi.mock("@/services/tournamentService", () => svc);
vi.mock("@/services/teamService", () => ({
  teamService: { getUmpirePendingTies: vi.fn(async () => []), getTieWithTeamNames: vi.fn() },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "umpire-1" } }, profile: { role: "umpire" } }),
}));
vi.mock("@/hooks/queries/useCheckins", () => ({ useTournamentReadiness: () => ({ matches: [] }) }));
vi.mock("@/components/checkin/OfficialBoard", () => ({
  CallMissingButton: () => null,
  ReadySections: () => null,
  UmpireWhosHere: () => null,
  WalkoverCheckinRecord: () => null,
  startWarning: () => null,
  walkoverHint: () => null,
}));
vi.mock("./TieUmpireConsole", () => ({ TieUmpireConsole: () => null }));
// A plain state stand-in for the history-backed drill-down.
vi.mock("@/hooks/useHistoryStep", async () => {
  const { useState } = await import("react");
  return {
    useHistoryStep: <T,>(_key: string, initial: T, parentOf: (v: T) => T | undefined) => {
      const [value, setValue] = useState<T>(initial);
      return {
        value,
        go: (next: T) => setValue(next),
        back: () => {
          const p = parentOf(value);
          if (p !== undefined) setValue(p);
          return p !== undefined;
        },
      };
    },
  };
});

import { UmpireTournamentTab } from "./UmpireTournamentTab";

const MATCH = {
  id: "m1",
  tournament_id: "t1",
  category: "MS",
  match_code: "MS_QF_01",
  round_name: "Quarter-final",
  round: 2,
  match_number: 1,
  player1_id: "p1",
  player3_id: null,
  team1_label: "Asha Rao",
  player2_id: "p2",
  player4_id: null,
  team2_label: "Bina Das",
  court_number: "2",
  scheduled_at: "2026-11-22T10:00:00.000Z",
  status: "scheduled",
  locked: false,
  result_revision: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  svc.fetchUmpirePickerTournaments.mockResolvedValue([{ id: "t1", name: "Club Open" }]);
  svc.fetchUmpireOpenMatches.mockResolvedValue({ data: [MATCH], error: null });
  svc.fetchUmpireDoneMatches.mockResolvedValue({ data: [] });
  svc.fetchRoundRulesForTournaments.mockResolvedValue([
    { tournament_id: "t1", category: "MS", round: 2, points_to_win: 21, best_of_sets: 3, golden_point: 30 },
  ]);
  svc.adminUpdateTournamentMatch.mockResolvedValue(undefined);
  svc.submitTournamentMatch.mockResolvedValue({ applied: true });
});

async function openMatch() {
  render(<UmpireTournamentTab onStartMatch={() => {}} tournamentId="t1" />);
  fireEvent.click(await screen.findByText("Asha Rao"));
  await screen.findByRole("button", { name: /start umpiring/i });
}

describe("UmpireTournamentTab", () => {
  it("asks for a reason in the reschedule dialog and saves the new slot with it", async () => {
    await openMatch();
    fireEvent.click(screen.getByRole("button", { name: /reschedule/i }));

    const save = screen.getByRole("button", { name: /save new slot/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Court 1 overran" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m1",
      { scheduled_at: "2026-11-22T10:00:00.000Z", court_number: "2", status: "scheduled", reminder_sent: false },
      "Court 1 overran",
    );
  });

  it("submits a directly entered score with the winner worked out from the sets", async () => {
    await openMatch();
    fireEvent.click(screen.getByRole("button", { name: /enter score/i }));

    const inputs = screen.getAllByPlaceholderText("0");
    expect(inputs).toHaveLength(6); // best of 3, from the round rule
    const values = ["15", "21", "21", "19", "18", "21"];
    inputs.forEach((input, i) => fireEvent.change(input, { target: { value: values[i] } }));

    expect(screen.getByText(/Winner: Bina Das \(1-2 sets\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit score/i }));

    await waitFor(() => expect(svc.submitTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.submitTournamentMatch).toHaveBeenCalledWith({
      p_match_id: "m1",
      p_winner_side: 2,
      p_score: "15-21, 21-19, 18-21",
      p_sets: ["15-21", "21-19", "18-21"],
      p_umpire_id: "umpire-1",
      p_expected_revision: 4,
    });
  });

  it("refuses to submit a single set in a best-of-3", async () => {
    await openMatch();
    fireEvent.click(screen.getByRole("button", { name: /enter score/i }));
    const [t1, t2] = screen.getAllByPlaceholderText("0");
    fireEvent.change(t1, { target: { value: "21" } });
    fireEvent.change(t2, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /submit score/i }));

    expect(toast.error).toHaveBeenCalledWith("Enter at least 2 sets");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });
});
