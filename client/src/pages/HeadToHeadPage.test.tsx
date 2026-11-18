import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComparisonRow } from "@/lib/comparison";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let search = `a=${A}&b=${B}`;

vi.mock("wouter", () => ({
  useSearch: () => search,
  useLocation: () => ["/h2h", vi.fn()],
  Link: ({ href, children, ...p }: any) => <a href={href} {...p}>{children}</a>,
}));
vi.mock("@/hooks/usePageMeta", () => ({ usePageMeta: () => {} }));
vi.mock("@/components/ui/PlayerSelect", () => ({ PlayerSelect: () => <div /> }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ is: () => ({ order: async () => ({ data: [{ id: A, full_name: "Asha", gender: "female" }, { id: B, full_name: "Bina", gender: "female" }], error: null }) }) }),
    }),
  },
}));

const row = (o: Partial<ComparisonRow>): ComparisonRow => ({
  id: Math.random().toString(36).slice(2),
  source: "tournament",
  status: "completed",
  winnerSide: 1,
  winnerId: null,
  side1: [A],
  side2: [B],
  category: "WS",
  date: "2026-10-01T10:00:00Z",
  score: "21-10, 21-12",
  round: "Final",
  event: "Open",
  tournamentId: "t1",
  ...o,
});

vi.mock("@/services/comparisonService", () => ({
  fetchComparisonRows: async () => ({
    rows: [
      row({}),
      row({ winnerSide: 2, date: "2026-10-05T10:00:00Z" }),
      row({ status: "walkover", winnerSide: 1, date: "2026-10-07T10:00:00Z" }),
      row({ status: "scheduled", winnerSide: null, date: "2026-10-09T10:00:00Z" }),
    ],
    players: {},
    truncated: false,
  }),
}));

import HeadToHeadPage from "./HeadToHeadPage";

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HeadToHeadPage />
    </QueryClientProvider>,
  );

describe("HeadToHeadPage", () => {
  it("shows reconciled totals with walkovers and unfinished matches separated", async () => {
    renderPage();
    expect(await screen.findByLabelText("1 wins to 1")).toBeTruthy();
    expect(screen.getByText(/^2 counted meetings/)).toBeTruthy();
    expect(screen.getByText(/walkovers 1–0 \(not counted\)/)).toBeTruthy();
    expect(screen.getByText(/1 not counted/)).toBeTruthy();
    expect(screen.getByText(/only 2 counted meetings/)).toBeTruthy();
    expect(screen.getByText(/Not counted — Not finished/)).toBeTruthy();
    // Each tournament meeting links to its match page.
    expect(screen.getAllByRole("link").some((l) => l.getAttribute("href")?.startsWith("/tournaments/t1/matches/"))).toBe(true);
  });

  it("refuses the same player on both sides", async () => {
    search = `a=${A}&b=${A}`;
    renderPage();
    expect(await screen.findByText("The same player can't be on both sides.")).toBeTruthy();
    search = `a=${A}&b=${B}`;
  });
});
