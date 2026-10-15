import { describe, it, expect } from "vitest";
import { findRestConflicts, playerSideLabel, type ScheduledMatch } from "./restConflicts";

const m = (id: string, at: string | null, p: Partial<ScheduledMatch> = {}): ScheduledMatch => ({
  id,
  scheduled_at: at,
  status: "scheduled",
  match_code: id.toUpperCase(),
  ...p,
});

describe("findRestConflicts", () => {
  it("flags the later match when a player's starts are too close", () => {
    const c = findRestConflicts([
      m("a", "2026-10-15T10:00:00Z", { player1_id: "x", player2_id: "y" }),
      m("b", "2026-10-15T10:30:00Z", { player1_id: "z", player4_id: "x" }),
      m("c", "2026-10-15T12:00:00Z", { player1_id: "x" }),
    ]);
    expect([...c.keys()]).toEqual(["b"]);
    expect(c.get("b")![0]).toMatchObject({ playerId: "x", gapMins: 30, previousCode: "A" });
  });

  it("ignores completed, unscheduled and placeholder ids", () => {
    const c = findRestConflicts([
      m("a", "2026-10-15T10:00:00Z", { player1_id: "x", status: "completed" }),
      m("b", "2026-10-15T10:10:00Z", { player1_id: "x" }),
      m("c", null, { player1_id: "x" }),
      m("d", "2026-10-15T10:00:00Z", { player1_id: "assigned" }),
      m("e", "2026-10-15T10:05:00Z", { player1_id: "assigned" }),
    ]);
    expect(c.size).toBe(0);
  });

  it("labels the player's side", () => {
    expect(playerSideLabel(m("a", null, { player4_id: "x", team2_label: "Ravi & Asha" }), "x")).toBe("Ravi & Asha");
  });
});
