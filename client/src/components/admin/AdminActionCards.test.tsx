import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AdminActionCard } from "@/lib/adminActions";

const state: { data?: AdminActionCard[]; isPending: boolean; isError: boolean } = { data: [], isPending: false, isError: false };
const setLocation = vi.fn();
vi.mock("@/hooks/queries/useAdminActionItems", () => ({
  useAdminActionItems: () => ({ ...state, isFetching: false, refetch: vi.fn() }),
}));
vi.mock("wouter", () => ({ useLocation: () => ["/admin", setLocation] }));

import { AdminActionCards } from "./AdminActionCards";

const card = (over: Partial<AdminActionCard>): AdminActionCard => ({
  id: "x",
  kind: "missing_officials",
  severity: "high",
  title: "Open: no umpire or referee assigned",
  detail: "d",
  count: 1,
  href: "/tournament-admin?id=t1&tab=officials",
  actionLabel: "Assign officials",
  ...over,
});

describe("AdminActionCards", () => {
  it("says so when nothing needs attention", () => {
    state.data = [];
    render(<AdminActionCards onOpenTab={vi.fn()} />);
    expect(screen.getByText("Nothing needs attention right now.")).toBeTruthy();
  });

  it("links tournament cards to the resolving screen and tab cards to the admin tab", () => {
    const onOpenTab = vi.fn();
    state.data = [card({}), card({ id: "disputes", kind: "disputed_results", title: "1 disputed result awaiting a decision", href: "#inbox" })];
    render(<AdminActionCards onOpenTab={onOpenTab} />);
    fireEvent.click(screen.getByRole("button", { name: /no umpire or referee/ }));
    expect(setLocation).toHaveBeenCalledWith("/tournament-admin?id=t1&tab=officials");
    fireEvent.click(screen.getByRole("button", { name: /disputed result/ }));
    expect(onOpenTab).toHaveBeenCalledWith("inbox");
  });

  it("never shows an empty list as 'all clear' when the check failed", () => {
    state.data = undefined;
    state.isError = true;
    render(<AdminActionCards onOpenTab={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toMatch(/may be incomplete/);
    expect(screen.queryByText("Nothing needs attention right now.")).toBeNull();
    state.isError = false;
  });
});
