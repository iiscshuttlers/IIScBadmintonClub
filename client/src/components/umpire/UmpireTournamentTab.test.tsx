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

    expect(screen.getByText(/Winner: Bina Das \(1-2 in games\)/)).toBeInTheDocument();
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

    expect(toast.error).toHaveBeenCalledWith("Enter at least 2 games");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });

  async function enterScore(values: string[]) {
    await openMatch();
    fireEvent.click(screen.getByRole("button", { name: /enter score/i }));
    screen.getAllByPlaceholderText("0").forEach((input, i) => fireEvent.change(input, { target: { value: values[i] ?? "" } }));
  }

  it("shows the match's rules above the score inputs", async () => {
    await enterScore([]);
    expect(screen.getByText("First to 21 · 30 wins · best of 3")).toBeInTheDocument();
  });

  it("refuses a score no badminton game can end on", async () => {
    await enterScore(["5", "3", "21", "10"]);
    expect(screen.queryByText(/Winner:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit score/i }));

    expect(toast.error).toHaveBeenCalledWith("Game 1: 5-3 isn't a possible score (first to 21, win by 2, 30 wins).");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });

  it("refuses a game entered after the match was won", async () => {
    await enterScore(["21", "10", "21", "10", "10", "21"]);
    expect(screen.queryByText(/Winner:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit score/i }));

    expect(toast.error).toHaveBeenCalledWith("The match was already won after game 2. Remove game 3.");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });

  it("refuses a match neither side has won", async () => {
    await enterScore(["21", "10", "10", "21"]);
    fireEvent.click(screen.getByRole("button", { name: /submit score/i }));

    expect(toast.error).toHaveBeenCalledWith("Neither side has won 2 games yet.");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });

  it("checks the score against the round's own rules", async () => {
    svc.fetchRoundRulesForTournaments.mockResolvedValue([
      { tournament_id: "t1", category: "MS", round: 2, points_to_win: 15, best_of_sets: 1, golden_point: 21 },
    ]);
    await enterScore(["15", "13"]);
    expect(screen.getAllByPlaceholderText("0")).toHaveLength(2);
    expect(screen.getByText("First to 15 · 21 wins · best of 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /submit score/i }));

    await waitFor(() => expect(svc.submitTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.submitTournamentMatch).toHaveBeenCalledWith(expect.objectContaining({ p_winner_side: 1, p_score: "15-13", p_sets: ["15-13"] }));
  });
});

describe("UmpireTournamentTab match list", () => {
  const row = (o: Record<string, unknown>) => ({ ...MATCH, scheduled_at: null, court_number: null, ...o });

  beforeEach(() => {
    svc.fetchUmpireOpenMatches.mockResolvedValue({
      data: [
        row({ id: "s1", match_code: "MS_QF_01", team1_label: "Asha Rao", team2_label: "Bina Das", status: "scheduled" }),
        row({ id: "s2", match_code: "MS_QF_02", team1_label: "Abbye Thomas", team2_label: "Byers", status: "scheduled", match_number: 2 }),
        row({ id: "p1", match_code: "MS_SF_01", team1_label: null, team2_label: null, status: "pending", round: 3 }),
        row({ id: "l1", match_code: "MS_QF_03", team1_label: "Chitra", team2_label: "Deepa", status: "in_progress", match_number: 3 }),
        row({ id: "b1", match_code: "MS_QF_04", team1_label: "Esha", team2_label: "BYE", status: "scheduled", match_number: 4 }),
      ],
      error: null,
    });
    svc.fetchUmpireDoneMatches.mockResolvedValue({
      data: [
        row({ id: "c1", match_code: "MS_R1_01", team1_label: "Farah", team2_label: "Gita", status: "completed", round: 1, winner_side: 1 }),
        row({ id: "b2", match_code: "MS_R1_02", team1_label: "BYE", team2_label: "Hema", status: "completed", round: 1, winner_side: 2 }),
      ],
    });
  });

  it("counts on each status pill what the list shows, pending included and byes left out", async () => {
    render(<UmpireTournamentTab onStartMatch={() => {}} tournamentId="t1" />);
    expect(await screen.findByRole("button", { name: "All (5)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upcoming (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done (1)" })).toBeInTheDocument();
    expect(screen.getByText("5 matches")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upcoming (3)" }));
    expect(screen.getByText("3 matches")).toBeInTheDocument();
    // The other pills keep their numbers whichever one is picked.
    expect(screen.getByRole("button", { name: "All (5)" })).toBeInTheDocument();
  });

  it("lists players whose names contain 'bye' as a normal match", async () => {
    render(<UmpireTournamentTab onStartMatch={() => {}} tournamentId="t1" />);
    expect(await screen.findByText("Abbye Thomas")).toBeInTheDocument();
    expect(screen.getByText("Byers")).toBeInTheDocument();
    expect(screen.queryByText("Esha")).not.toBeInTheDocument();
    expect(screen.queryByText("Hema")).not.toBeInTheDocument();
  });

  it("lists pending matches with the ones still to play, before live and finished ones", async () => {
    render(<UmpireTournamentTab onStartMatch={() => {}} tournamentId="t1" />);
    await screen.findByText("Abbye Thomas");
    const codes = screen.getAllByText(/^MS MS_/).map((el) => el.textContent);
    expect(codes).toEqual(["MS MS_QF_01", "MS MS_QF_02", "MS MS_SF_01", "MS MS_QF_03", "MS MS_R1_01"]);
  });
});
