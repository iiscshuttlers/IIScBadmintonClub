import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ScoreConflictModal } from "./ScoreConflictModal";
import type { ScoreConflictState } from "@/types/umpire";

const sampleConflict: ScoreConflictState = {
  matchId: "m-101",
  tournamentId: "t-1",
  matchNumber: "42",
  category: "MD",
  team1Label: "Sathwik / Chirag",
  team2Label: "Ahsan / Setiawan",
  localRevision: 0,
  serverRevision: 1,
  localWinnerSide: 1,
  localScore: "21-19, 21-18",
  localSets: ["21-19", "21-18"],
  serverWinnerSide: 2,
  serverScore: "19-21, 21-19, 21-17",
  serverSets: ["19-21", "21-19", "21-17"],
  serverStatus: "completed",
  lastActorName: "Umpire Alice",
  lastUpdatedAt: "2026-11-13T10:30:00Z",
  downstreamStarted: false,
};

describe("ScoreConflictModal", () => {
  const onKeepServerResult = vi.fn();
  const onApplyCorrection = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={false}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders accessible dialog semantics and title", () => {
    render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={true}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "conflict-dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "conflict-dialog-description");
    expect(screen.getByText(/Score Revision Conflict/i)).toBeInTheDocument();
    expect(screen.getByText(/MD • Match #42/i)).toBeInTheDocument();
  });

  it("renders side-by-side local vs server score comparison", () => {
    render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={true}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Your Device Score")).toBeInTheDocument();
    expect(screen.getByText("Rev 0")).toBeInTheDocument();
    expect(screen.getByText("21-19, 21-18")).toBeInTheDocument();
    expect(screen.getByText("G1: 21-19")).toBeInTheDocument();
    expect(screen.getByText("G2: 21-18")).toBeInTheDocument();

    expect(screen.getByText("Server Accepted Score")).toBeInTheDocument();
    expect(screen.getByText("Rev 1")).toBeInTheDocument();
    expect(screen.getByText("19-21, 21-19, 21-17")).toBeInTheDocument();
    expect(screen.getByText("G3: 21-17")).toBeInTheDocument();
    expect(screen.getByText(/Updated by Umpire Alice/i)).toBeInTheDocument();
  });

  it("blocks simple correction and warns when downstream match has started", () => {
    const downstreamConflict: ScoreConflictState = {
      ...sampleConflict,
      downstreamStarted: true,
      downstreamMatchCode: "SF-2",
    };

    render(
      <ScoreConflictModal
        conflict={downstreamConflict}
        isOpen={true}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/Downstream Draw Match Already Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Match SF-2/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply Correction/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Keep Server Result/i })).toBeInTheDocument();
  });

  it("enforces non-empty reason before enabling Apply Correction", () => {
    render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={true}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    const applyButton = screen.getByRole("button", { name: /Apply Correction/i });
    expect(applyButton).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/Required: State the reason/i);
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(applyButton).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Scores verified with match sheet and players." } });
    expect(applyButton).not.toBeDisabled();

    fireEvent.click(applyButton);
    expect(onApplyCorrection).toHaveBeenCalledWith("Scores verified with match sheet and players.");
  });

  it("triggers onKeepServerResult when Keep Server Result is tapped", () => {
    render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={true}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    const keepButton = screen.getByRole("button", { name: /Keep Server Result/i });
    fireEvent.click(keepButton);
    expect(onKeepServerResult).toHaveBeenCalledTimes(1);
  });

  it("shows unauthorized explanation when canCorrect is false", () => {
    render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={true}
        canCorrect={false}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    expect(
      screen.getByText(/Only authorized tournament officials or administrators can override an accepted match result/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Apply Correction/i })).not.toBeInTheDocument();
  });

  it("closes when Escape key is pressed", () => {
    render(
      <ScoreConflictModal
        conflict={sampleConflict}
        isOpen={true}
        canCorrect={true}
        onKeepServerResult={onKeepServerResult}
        onApplyCorrection={onApplyCorrection}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

