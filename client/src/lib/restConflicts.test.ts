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
    expect(c.get("b")![0]).toMatchObject({
      playerId: "x",
      gapMins: 0,
      previousCode: "A",
      timingBasis: "estimated",
      conflictType: "warning",
    });
  });

  it("classifies actual completed match gap below min as hard conflict", () => {
    const c = findRestConflicts([
      m("a", "2026-10-15T10:00:00Z", {
        player1_id: "p1",
        status: "completed",
        ended_at: "2026-10-15T10:35:00Z",
      }),
      m("b", "2026-10-15T10:45:00Z", {
        player1_id: "p1",
        status: "scheduled",
      }),
    ], { minRestMinutes: 15 });

    expect(c.get("b")?.[0]).toMatchObject({
      playerId: "p1",
      gapMins: 10,
      timingBasis: "actual",
      conflictType: "hard",
      minRestMinutes: 15,
    });
  });

  it("respects custom minRestMinutes and estimatedMinutes options", () => {
    // 25 mins gap between 10:40 and 11:05
    const matches = [
      m("a", "2026-10-15T10:00:00Z", {
        player1_id: "p1",
        status: "completed",
        ended_at: "2026-10-15T10:40:00Z",
      }),
      m("b", "2026-10-15T11:00:00Z", {
        player1_id: "p1",
        status: "scheduled",
      }),
    ];

    // With 15 mins min rest: 20 mins gap is NOT a conflict
    expect(findRestConflicts(matches, { minRestMinutes: 15 }).size).toBe(0);

    // With 25 mins min rest: 20 mins gap IS a hard conflict
    const conflicts = findRestConflicts(matches, { minRestMinutes: 25 });
    expect(conflicts.get("b")?.[0]).toMatchObject({
      conflictType: "hard",
      gapMins: 20,
      minRestMinutes: 25,
    });
  });

  it("ignores completed, unscheduled and placeholder ids", () => {
    const c = findRestConflicts([
      m("a", "2026-10-15T10:00:00Z", { player1_id: "x", status: "walkover" }),
      m("b", "2026-10-15T10:10:00Z", { player1_id: "x" }),
      m("c", null, { player1_id: "x" }),
      m("d", "2026-10-15T10:00:00Z", { player1_id: "assigned" }),
      m("e", "2026-10-15T10:05:00Z", { player1_id: "assigned" }),
    ]);
    expect(c.size).toBe(0);
  });

  it("uses a completed match's actual end time for rest", () => {
    const c = findRestConflicts([
      m("ms", "2026-10-15T10:00:00Z", {
        player1_id: "x",
        status: "completed",
        ended_at: "2026-10-15T10:40:00Z",
        category: "MS",
      }),
      m("xd", "2026-10-15T10:50:00Z", { player1_id: "z", player4_id: "x", category: "XD" }),
    ]);

    expect(c.get("xd")?.[0]).toMatchObject({
      previousCode: "MS",
      playerId: "x",
      gapMins: 10,
      timingBasis: "actual",
    });
  });

  it("checks every doubles slot across MD, WD and XD", () => {
    const c = findRestConflicts([
      m("md", "2026-10-15T10:00:00Z", { player3_id: "p3", category: "MD" }),
      m("wd", "2026-10-15T10:00:00Z", { player4_id: "p4", category: "WD" }),
      m("xd-p3", "2026-10-15T10:35:00Z", { player1_id: "p3", player2_id: "q", category: "XD" }),
      m("xd-p4", "2026-10-15T10:35:00Z", { player3_id: "r", player4_id: "p4", category: "XD" }),
    ]);

    expect(c.get("xd-p3")?.[0].playerId).toBe("p3");
    expect(c.get("xd-p4")?.[0].playerId).toBe("p4");
  });

  it("labels the player's side", () => {
    expect(playerSideLabel(m("a", null, { player4_id: "x", team2_label: "Ravi & Asha" }), "x")).toBe("Ravi & Asha");
  });
});
