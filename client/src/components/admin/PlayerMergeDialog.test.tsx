import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const preview = vi.fn();
const merge = vi.fn();
const decide = vi.fn();
vi.mock("@/services/identityService", async () => {
  const actual = await vi.importActual<any>("@/services/identityService");
  return {
    ...actual,
    previewPlayerMerge: (...a: unknown[]) => preview(...a),
    mergePlayerIdentity: (...a: unknown[]) => merge(...a),
    decidePlayerClaim: (...a: unknown[]) => decide(...a),
  };
});

import { PlayerMergeDialog } from "./PlayerMergeDialog";

const base = {
  guest: { id: "g", name: "Asha (guest)" },
  target: { id: "r", name: "Asha Rao" },
  references: [
    { table: "matches", column: "player1_id", rows: 3 },
    { table: "tournament_matches", column: "player2_id", rows: 2 },
  ],
  conflicts: [],
  blockers: [],
  aliasRedirects: 0,
};

const renderDialog = (props: Partial<React.ComponentProps<typeof PlayerMergeDialog>> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlayerMergeDialog open onOpenChange={() => {}} guestId="g" realId="r" {...props} />
    </QueryClientProvider>,
  );

describe("PlayerMergeDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows what will move and requires a verification reason", async () => {
    preview.mockResolvedValue(base);
    merge.mockResolvedValue({ applied: true });
    renderDialog();
    expect(await screen.findByText("Records that will move (5)")).toBeTruthy();
    expect(screen.getByText(/Friendly matches/)).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Link history/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/How was ownership verified/), { target: { value: "Confirmed in person" } });
    fireEvent.click(btn);
    await waitFor(() => expect(merge).toHaveBeenCalledTimes(1));
    expect(merge.mock.calls[0][0]).toMatchObject({ guestId: "g", realId: "r", reason: "Confirmed in person" });
  });

  it("blocks a merge that would make a player play themself", async () => {
    preview.mockResolvedValue({ ...base, blockers: ["history_conflict"], conflicts: [{ table: "matches", rows: 1, kind: "same_row" }] });
    renderDialog();
    expect(await screen.findByText(/play themself/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/How was ownership verified/), { target: { value: "x" } });
    expect((screen.getByRole("button", { name: /Link history/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("approving a claim goes through the claim decision, not a bare merge", async () => {
    preview.mockResolvedValue(base);
    decide.mockResolvedValue({ status: "approved", applied: true });
    renderDialog({ claimRequestId: 7 });
    fireEvent.change(await screen.findByLabelText(/How was ownership verified/), { target: { value: "Opponent confirmed" } });
    fireEvent.click(screen.getByRole("button", { name: /Link history/ }));
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1));
    expect(decide.mock.calls[0][0]).toMatchObject({ requestId: 7, approve: true, note: "Opponent confirmed" });
    expect(merge).not.toHaveBeenCalled();
  });
});
