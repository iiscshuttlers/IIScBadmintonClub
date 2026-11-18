import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyTournamentCard } from "@/components/home/MyTournamentCard";
import type { MatchView } from "@/lib/matchView";

function match(id: string, overrides: Partial<MatchView> = {}): MatchView {
  return {
    id,
    tournamentId: "00000000-0000-4000-8000-000000000301",
    discipline: "XD",
    categoryLabel: "Mixed Doubles",
    roundName: "Quarter-final",
    round: 2,
    matchNumber: 4,
    matchCode: "XD_QF_4",
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "Asha & Dev", playerIds: ["me", "partner"], seed: 2, isWinner: false, isTbd: false, isBye: false },
      { label: "Bala & Chitra", playerIds: ["b", "c"], seed: null, isWinner: false, isTbd: false, isBye: false },
    ],
    state: "scheduled",
    statusLabel: "Scheduled",
    games: [],
    scoreText: null,
    court: "2",
    scheduledAt: "2026-11-15T09:30:00.000Z",
    startedAt: null,
    endedAt: null,
    nextMatchCode: null,
    ...overrides,
  };
}

describe("MyTournamentCard", () => {
  it("shows the actionable match, both sides and canonical destinations", () => {
    const primary = match("00000000-0000-4000-8000-000000000302");
    render(<MyTournamentCard summary={{ primary, otherMatches: [] }} myPlayerId="me" tournamentNames={{ [primary.tournamentId]: "Spectrum Open" }} />);
    expect(screen.getByRole("heading", { name: "Your next match" })).toBeInTheDocument();
    expect(screen.getByText("Your side:")).toHaveTextContent("Your side:");
    expect(screen.getByText(/Asha & Dev/)).toBeInTheDocument();
    expect(screen.getByText(/Bala & Chitra/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open match/ })).toHaveAttribute("href", `/tournaments/${primary.tournamentId}/matches/${primary.id}`);
    expect(screen.getByRole("link", { name: "View draw" })).toHaveAttribute("href", `/tournaments/${primary.tournamentId}/draw?cat=XD`);
    expect(screen.getByRole("link", { name: /Schedule/ })).toHaveAttribute("href", `/tournaments/${primary.tournamentId}/schedule?cat=XD&court=2`);
  });

  it("states unknown time and court without inventing reporting information", () => {
    const primary = match("m-unscheduled", { state: "unscheduled", scheduledAt: null, court: null });
    render(<MyTournamentCard summary={{ primary, otherMatches: [] }} myPlayerId="me" tournamentNames={{}} />);
    expect(screen.getAllByText("Time not assigned").length).toBeGreaterThan(0);
    expect(screen.getByText("Court not assigned")).toBeInTheDocument();
    expect(screen.queryByText(/report/i)).not.toBeInTheDocument();
  });

  it("keeps additional disciplines visible with direct match links", () => {
    const primary = match("primary");
    const ms = match("other-ms", { discipline: "MS", categoryLabel: "Men's Singles", roundName: "Semi-final", court: null, scheduledAt: null, state: "unscheduled" });
    render(<MyTournamentCard summary={{ primary, otherMatches: [ms] }} myPlayerId="me" tournamentNames={{}} />);
    expect(screen.getByText("Other entries")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /MS · Semi-final/ })).toHaveAttribute("href", `/tournaments/${ms.tournamentId}/matches/${ms.id}`);
    expect(screen.getByRole("link", { name: "See all 2" })).toHaveAttribute("href", "/my-matches");
  });
});
