import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import TournamentPage from "./TournamentPage";

const TID = "3f2b8c1e-1d2a-4b5c-8d9e-0a1b2c3d4e5f";

vi.mock("@/hooks/queries/useTournamentRoute", () => ({
  useTournamentRoute: () => ({
    kind: "ready",
    tournament: { id: TID, name: "Route Test Open", status: "active", tournament_type: "individual" },
    lifecycle: "active",
    winners: [],
  }),
}));
vi.mock("@/hooks/useArchivedTournaments", () => ({ useArchivedTournaments: () => ({ archivedTournaments: [] }) }));
vi.mock("@/hooks/usePageMeta", () => ({ usePageMeta: () => undefined }));
vi.mock("@/components/tournament/FollowTournamentButton", () => ({ FollowTournamentButton: () => null }));
vi.mock("@/components/pulse/LiveTab", () => ({
  LiveTab: ({ route }: any) => (
    <div>
      <output data-testid="route-state">{`${route.tab}|${route.panel ?? ""}`}</output>
      <button type="button" onClick={() => route.navigate({ tab: "results", panel: null })}>Results</button>
    </div>
  ),
}));

describe("TournamentPage canonical navigation", () => {
  it("fresh-loads a canonical tab and preserves every filter when changing tabs", () => {
    const initial = `/tournaments/${TID}/draw?cat=XD&court=2&date=2026-11-14&status=upcoming`;
    const { hook, history } = memoryLocation({ path: initial, record: true });
    render(<Router hook={hook}><TournamentPage /></Router>);

    expect(screen.getByTestId("route-state")).toHaveTextContent("draw|");
    fireEvent.click(screen.getByRole("button", { name: "Results" }));

    expect(history).toEqual([
      initial,
      `/tournaments/${TID}/results?cat=XD&court=2&date=2026-11-14&status=upcoming`,
    ]);
  });

  it("normalizes an unknown tab with replace while preserving filters", async () => {
    const { hook, history } = memoryLocation({
      path: `/tournaments/${TID}/bogus?cat=XD&court=4&date=2026-11-14&status=completed`,
      record: true,
    });
    render(<Router hook={hook}><TournamentPage /></Router>);

    await waitFor(() => expect(history.at(-1)).toBe(
      `/tournaments/${TID}?cat=XD&court=4&date=2026-11-14&status=completed`,
    ));
    expect(history).toHaveLength(1);
  });
});
