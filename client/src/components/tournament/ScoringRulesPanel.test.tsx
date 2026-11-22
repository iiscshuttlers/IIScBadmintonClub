import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const svc = vi.hoisted(() => ({
  fetchTournamentMatchesForRounds: vi.fn(),
  fetchTournamentRoundRules: vi.fn(),
  setTournamentRoundRule: vi.fn(),
}));
vi.mock("@/services/tournamentService", () => ({ tournamentService: svc }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { ScoringRulesPanel } from "./ScoringRulesPanel";

const tournament = { id: "t1", format_family: "INDIVIDUAL" } as any;

beforeEach(() => {
  vi.clearAllMocks();
  svc.fetchTournamentMatchesForRounds.mockResolvedValue([
    // The 3rd place playoff shares the semifinal's round number.
    { category: "MD", round: 1, round_name: "3rd Place Playoff" },
    { category: "MD", round: 1, round_name: "Semifinal" },
    { category: "MD", round: 2, round_name: "Final" },
    { category: "MS", round: 1, round_name: "Semifinal" },
    { category: "MS", round: 2, round_name: "Final" },
  ]);
  svc.fetchTournamentRoundRules.mockResolvedValue([
    { category: "MS", round: 1, round_name: "Semifinal", points_to_win: 15, best_of_sets: 3, golden_point: 21 },
    { category: "MS", round: 2, round_name: "Final", points_to_win: 11, best_of_sets: 5, golden_point: 15 },
  ]);
  svc.setTournamentRoundRule.mockResolvedValue(undefined);
});

describe("ScoringRulesPanel", () => {
  it("autosaves an edit on blur without reloading the list", async () => {
    render(<ScoringRulesPanel tournament={tournament} />);
    // Both formats have a Final; Men's Doubles is listed first.
    const [md] = await screen.findAllByLabelText("Final points to win");
    fireEvent.change(md, { target: { value: "15" } });
    fireEvent.blur(md);
    await waitFor(() => expect(svc.setTournamentRoundRule).toHaveBeenCalledTimes(1));
    expect(svc.setTournamentRoundRule).toHaveBeenCalledWith(
      expect.objectContaining({ tournament_id: "t1", category: "MD", round: 2, points_to_win: 15, best_of_sets: 3, golden_point: 30 }),
    );
    expect(await screen.findByText("Saved")).toBeTruthy();
    // No reload: rules and matches were fetched once, and the edited value stays.
    expect(svc.fetchTournamentRoundRules).toHaveBeenCalledTimes(1);
    expect((md as HTMLInputElement).value).toBe("15");
  });

  it("copies every round from another format, pairing rounds by name", async () => {
    render(<ScoringRulesPanel tournament={tournament} />);
    const select = await screen.findByLabelText("Copy every round's rule into Men's Doubles from another format");
    fireEvent.change(select, { target: { value: "MS" } });
    await waitFor(() => expect(svc.setTournamentRoundRule).toHaveBeenCalledTimes(2));
    expect(svc.setTournamentRoundRule).toHaveBeenCalledWith(expect.objectContaining({ category: "MD", round: 1, points_to_win: 15, golden_point: 21 }));
    expect(svc.setTournamentRoundRule).toHaveBeenCalledWith(expect.objectContaining({ category: "MD", round: 2, points_to_win: 11, best_of_sets: 5 }));
  });

  it("copies one round's rule from a round of another format", async () => {
    render(<ScoringRulesPanel tournament={tournament} />);
    // A round shared by the semifinal and the playoff shows both names.
    const select = await screen.findByLabelText("Copy Men's Doubles Semifinal + 3rd Place Playoff rule from another round");
    fireEvent.change(select, { target: { value: "MS::2" } });
    await waitFor(() => expect(svc.setTournamentRoundRule).toHaveBeenCalledTimes(1));
    expect(svc.setTournamentRoundRule).toHaveBeenCalledWith({
      tournament_id: "t1", category: "MD", round: 1, round_name: "Semifinal", points_to_win: 11, best_of_sets: 5, golden_point: 15,
    });
  });
});
