import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseCorrectionPreview } from "@/lib/correctionPreview";

const preview = vi.fn();
const apply = vi.fn();
const undo = vi.fn();
const audit = vi.fn();

vi.mock("@/services/correctionService", () => ({
  previewTournamentMatchCorrection: (...a: unknown[]) => preview(...a),
  undoTournamentMatchCorrection: (...a: unknown[]) => undo(...a),
  fetchAuditEvents: (...a: unknown[]) => audit(...a),
}));
vi.mock("@/services/tournamentService", () => ({
  applyTournamentMatchCorrection: (...a: unknown[]) => apply(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MatchCorrectionDialog } from "./MatchCorrectionDialog";

const server = (over: Record<string, unknown> = {}) =>
  parseCorrectionPreview({
    match_id: "m1",
    tournament_id: "t1",
    match_code: "MS_QF_01",
    status: "completed",
    revision: 4,
    winner_side: 1,
    score: "21-19, 21-17",
    sets: ["21-19", "21-17"],
    counts_for_elo: false,
    is_team_rubber: false,
    elo_effect: "not_ranked",
    downstream: [
      { match_id: "m2", match_code: "MS_SF_01", path: "winner", position: 1, status: "scheduled", started: false },
    ],
    blockers: [],
    undoable_event_id: null,
    ...over,
  });

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MatchCorrectionDialog open onOpenChange={() => {}} matchId="m1" team1Label="Asha" team2Label="Bina" />
    </QueryClientProvider>,
  );
}

describe("MatchCorrectionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audit.mockResolvedValue([]);
  });

  it("shows a read-only preview with downstream impact before anything is applied", async () => {
    preview.mockResolvedValue(server());
    renderDialog();
    const input = await screen.findByLabelText("Corrected game scores");
    expect((input as HTMLInputElement).value).toBe("21-19, 21-17");
    fireEvent.change(input, { target: { value: "21-19, 18-21, 21-17" } });
    fireEvent.click(screen.getByRole("button", { name: "Review impact" }));
    expect(await screen.findByText(/Preview \(read-only\)/)).toBeTruthy();
    expect(screen.getByText(/MS_SF_01/)).toBeTruthy();
    expect(screen.getByText(/Will be checked against revision 4/)).toBeTruthy();
    expect(apply).not.toHaveBeenCalled();
    // Apply requires a reason.
    const applyBtn = screen.getByRole("button", { name: /Apply correction/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
  });

  it("sends the previewed revision and reports a stale preview without saving", async () => {
    preview.mockResolvedValue(server());
    apply.mockRejectedValue({ code: "40001", message: "result_revision_conflict: expected 4, current 5" });
    renderDialog();
    fireEvent.change(await screen.findByLabelText("Corrected game scores"), { target: { value: "21-19, 18-21, 21-17" } });
    fireEvent.click(screen.getByRole("button", { name: "Review impact" }));
    fireEvent.change(await screen.findByLabelText(/Reason/), { target: { value: "Score sheet" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply correction/ }));
    await waitFor(() => expect(apply).toHaveBeenCalledTimes(1));
    expect(apply.mock.calls[0][0]).toMatchObject({ expectedRevision: 4, winnerSide: 1, sets: ["21-19", "18-21", "21-17"], reason: "Score sheet" });
    expect(await screen.findByText(/changed after your preview\. Nothing was saved/)).toBeTruthy();
  });

  it("locks the correction when a later match has started", async () => {
    preview.mockResolvedValue(server({ blockers: ["downstream_started"] }));
    renderDialog();
    fireEvent.change(await screen.findByLabelText("Corrected game scores"), { target: { value: "21-19, 18-21, 21-17" } });
    expect(screen.getByText(/already started or finished/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Review impact" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks a winner change in a ranked tournament but not a score fix", async () => {
    preview.mockResolvedValue(server({ counts_for_elo: true }));
    renderDialog();
    const input = await screen.findByLabelText("Corrected game scores");
    fireEvent.change(input, { target: { value: "19-21, 17-21" } });
    expect(screen.getByText(/counts for club Elo/)).toBeTruthy();
    fireEvent.change(input, { target: { value: "21-19, 21-15" } });
    expect(screen.queryByText(/counts for club Elo/)).toBeNull();
    expect((screen.getByRole("button", { name: "Review impact" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("offers undo of the latest correction as a reasoned action", async () => {
    preview.mockResolvedValue(server({ undoable_event_id: 7 }));
    undo.mockResolvedValue({ applied: true, revision: 6 });
    renderDialog();
    const btn = (await screen.findByRole("button", { name: /Undo last correction/ })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Reason for undo"), { target: { value: "Wrong match" } });
    fireEvent.click(btn);
    await waitFor(() => expect(undo).toHaveBeenCalledTimes(1));
    expect(undo.mock.calls[0][0]).toMatchObject({ eventId: 7, expectedRevision: 4, reason: "Wrong match" });
  });
});
