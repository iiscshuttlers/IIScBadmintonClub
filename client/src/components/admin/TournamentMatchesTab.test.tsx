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

    expect(toast.error).toHaveBeenCalledWith("Game 1: 21-20 isn't a possible score (first to 21, win by 2, 30 wins).");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });

  it("refuses an incomplete score until a side is chosen", () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    enterGames([["21", "10"]]);

    const winner = screen.getByRole("combobox", { name: "Winner" });
    expect(winner).toHaveValue("");
    expect(screen.getByText("Choose winner…")).toBeInTheDocument();
    expect(screen.getByText("Score is incomplete — pick the side that won by retirement or concession")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(toast.error).toHaveBeenCalledWith("Score is incomplete. Choose the side that won by retirement or concession.");
    expect(svc.submitTournamentMatch).not.toHaveBeenCalled();
  });

  it("saves an incomplete score for the side chosen by hand", async () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    enterGames([["21", "10"], ["15", "21"]]);
    fireEvent.change(screen.getByRole("combobox", { name: "Winner" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.submitTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.submitTournamentMatch).toHaveBeenCalledWith(expect.objectContaining({
      p_winner_side: 2,
      p_score: "21-10, 15-21",
      p_sets: ["21-10", "15-21"],
    }));
  });

  it("keeps the editor open with the typed score when saving fails", async () => {
    vi.mocked(svc.submitTournamentMatch).mockRejectedValueOnce(new Error("Result changed elsewhere"));
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    enterGames([["21", "10"], ["21", "15"]]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.submitTournamentMatch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled());
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("ignores a hand-picked side once the games decide the match", async () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Score" }));
    enterGames([["21", "10"]]);
    fireEvent.change(screen.getByRole("combobox", { name: "Winner" }), { target: { value: "2" } });
    enterGames([["21", "10"], ["21", "15"]]);

    expect(screen.queryByRole("combobox", { name: "Winner" })).not.toBeInTheDocument();
    expect(screen.getByText("(auto-detected)").parentElement).toHaveTextContent("Asha Rao");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.submitTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.submitTournamentMatch).toHaveBeenCalledWith(expect.objectContaining({
      p_winner_side: 1,
      p_score: "21-10, 21-15",
    }));
  });
});

describe("TournamentMatchesTab schedule editor", () => {
  it("saves a blank Other court as no court", async () => {
    renderTab([match({ court_number: "C2" })]);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Court" }), { target: { value: "other" } });
    expect(screen.getByPlaceholderText("Enter court")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ court_number: null, reminder_sent: false }),
      "Edit the match court and scheduled time",
    );
  });

  it("trims a typed Other court", async () => {
    renderTab([match()]);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Court" }), { target: { value: "other" } });
    fireEvent.change(screen.getByPlaceholderText("Enter court"), { target: { value: "  Annex 2 " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ court_number: "Annex 2" }),
      "Edit the match court and scheduled time",
    );
  });

  it("does not re-arm the reminder when the slot is saved unchanged", async () => {
    renderTab([match({ court_number: "C2", scheduled_at: null, reminder_sent: true })]);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    const patch = (vi.mocked(svc.adminUpdateTournamentMatch).mock.calls[0] as unknown[])[1];
    expect(patch).toMatchObject({ court_number: "C2" });
    expect(patch).not.toHaveProperty("reminder_sent");
  });

  it("opens a non-preset court in Other mode", () => {
    renderTab([match({ court_number: "Annex 2" })]);
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    expect(screen.getByRole("combobox", { name: "Court" })).toHaveValue("other");
    expect(screen.getByPlaceholderText("Enter court")).toHaveValue("Annex 2");
  });
});

describe("TournamentMatchesTab bulk schedule", () => {
  function pasteAndPreview(text: string) {
    fireEvent.change(screen.getByPlaceholderText(/MS_QF_01: Court 3/), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  }

  it("schedules a pending match from a pasted line", async () => {
    const { load } = renderTab([match({ status: "pending" })], { showBulkSchedule: true });
    pasteAndPreview("MS_SF_01 court=C2 date=2026-06-30 time=10:00");
    expect(screen.getByText("✓ Found")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save 1 Match" }));
    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m1",
      { court_number: "C2", scheduled_at: new Date("2026-06-30T10:00").toISOString(), status: "scheduled", reminder_sent: false },
      "Bulk order-of-play schedule update",
    );
    expect(load).toHaveBeenCalled();
  });

  it("keeps the existing time on a court-only line", async () => {
    renderTab([match({ court_number: "C1", scheduled_at: "2026-06-30T04:30:00+00:00" })], { showBulkSchedule: true });
    pasteAndPreview("MS_SF_01 court=C3");
    fireEvent.click(screen.getByRole("button", { name: "Save 1 Match" }));

    await waitFor(() => expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(1));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m1",
      { court_number: "C3", status: "scheduled", reminder_sent: false },
      "Bulk order-of-play schedule update",
    );
  });

  it("saves every row when one fails and reports which one", async () => {
    svc.adminUpdateTournamentMatch.mockRejectedValueOnce(new Error("permission denied")); // the first row (m1)
    const { load } = renderTab(
      [match(), match({ id: "m2", match_code: "MS_SF_02", match_number: 2 })],
      { showBulkSchedule: true },
    );
    pasteAndPreview("MS_SF_01 court=C1\nMS_SF_02 court=C2");
    fireEvent.click(screen.getByRole("button", { name: "Save 2 Matches" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Saved 1 of 2; 1 failed: MS_SF_01",
      { description: "permission denied" },
    ));
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledTimes(2);
    expect(svc.adminUpdateTournamentMatch).toHaveBeenCalledWith(
      "m2",
      expect.objectContaining({ court_number: "C2" }),
      "Bulk order-of-play schedule update",
    );
    expect(load).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save 2 Matches" })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
