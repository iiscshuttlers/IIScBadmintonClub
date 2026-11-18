import { describe, expect, it } from "vitest";
import { buildAdminActionCards, countDelayedMatches, countScheduleConflicts } from "./adminActions";

const base = { disputedResults: 0, guestIdentities: 0, unsyncedOnThisDevice: 0 };

describe("buildAdminActionCards", () => {
  it("produces no cards when nothing needs action", () => {
    expect(buildAdminActionCards({ ...base, tournaments: [] })).toEqual([]);
  });

  it("flags running tournaments without officials and links to the officials tab", () => {
    const cards = buildAdminActionCards({
      ...base,
      tournaments: [
        { id: "t1", name: "Open", lifecycle: "active", officialCount: 0, hardConflicts: 0, warningConflicts: 0, delayedMatches: 0 },
        { id: "t2", name: "Old", lifecycle: "completed", officialCount: 0, hardConflicts: 3, warningConflicts: 0, delayedMatches: 0 },
        { id: "t3", name: "Draft", lifecycle: "draft", officialCount: 0, hardConflicts: 0, warningConflicts: 0, delayedMatches: 0 },
      ],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: "missing_officials", severity: "high", href: "/tournament-admin?id=t1&tab=officials" });
  });

  it("counts schedule conflicts and ranks hard ones first", () => {
    const cards = buildAdminActionCards({
      ...base,
      guestIdentities: 2,
      tournaments: [{ id: "t1", name: "Open", lifecycle: "upcoming", officialCount: 2, hardConflicts: 1, warningConflicts: 2, delayedMatches: 0 }],
    });
    expect(cards.map((c) => c.kind)).toEqual(["schedule_conflicts", "unresolved_identities"]);
    expect(cards[0].title).toBe("Open: 3 schedule conflicts");
    expect(cards[0].href).toBe("/tournament-admin?id=t1&tab=schedule");
  });

  it("removes a card once its count is resolved", () => {
    const before = buildAdminActionCards({ ...base, disputedResults: 1, tournaments: [] });
    const after = buildAdminActionCards({ ...base, disputedResults: 0, tournaments: [] });
    expect(before.map((c) => c.id)).toEqual(["disputes"]);
    expect(after).toEqual([]);
  });

  it("is explicit that sync failures are only those on this device", () => {
    const [card] = buildAdminActionCards({ ...base, unsyncedOnThisDevice: 1, tournaments: [] });
    expect(card.title).toMatch(/on this device/);
    expect(card.href).toBe("#umpire");
  });

  it("does not turn an unreadable device queue into a false all-clear", () => {
    const [card] = buildAdminActionCards({ ...base, unsyncedOnThisDevice: null, tournaments: [] });
    expect(card.kind).toBe("sync_visibility");
    expect(card.detail).toMatch(/not an all-clear/);
  });

  it("shows delayed matches with the explicit estimate threshold and a resolving route", () => {
    const cards = buildAdminActionCards({
      ...base,
      tournaments: [{ id: "t1", name: "Open", lifecycle: "active", officialCount: 1, hardConflicts: 0, warningConflicts: 0, delayedMatches: 2 }],
    });
    expect(cards[0]).toMatchObject({ kind: "delayed_matches", severity: "high", href: "/tournament-admin?id=t1&tab=schedule&attention=delayed" });
    expect(cards[0].detail).toMatch(/15 minutes/);
  });
});

describe("countScheduleConflicts", () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 20, h, m)).toISOString();
  const match = (id: string, court: string, start: string, players: string[], extra: Record<string, unknown> = {}) => ({
    id,
    court_number: court,
    scheduled_at: start,
    status: "scheduled",
    match_code: id,
    player1_id: players[0] ?? null,
    player2_id: players[1] ?? null,
    ...extra,
  });

  it("counts a double-booked court", () => {
    const r = countScheduleConflicts(
      [match("a", "C1", at(10), ["p1", "p2"]), match("b", "C1", at(10, 10), ["p3", "p4"])],
      { estimatedMinutes: 30 },
    );
    expect(r.hard + r.warning).toBeGreaterThan(0);
  });

  it("ignores conflicts already accepted with an audited override", () => {
    const r = countScheduleConflicts(
      [
        match("a", "C1", at(10), ["p1", "p2"], { schedule_override_at: at(9) }),
        match("b", "C1", at(10, 10), ["p3", "p4"], { schedule_override_at: at(9) }),
      ],
      { estimatedMinutes: 30 },
    );
    expect(r).toEqual({ hard: 0, warning: 0 });
  });

  it("reports nothing for a clean schedule", () => {
    const r = countScheduleConflicts(
      [match("a", "C1", at(10), ["p1", "p2"]), match("b", "C2", at(10), ["p3", "p4"])],
      { estimatedMinutes: 30, minRestMinutes: 15 },
    );
    expect(r).toEqual({ hard: 0, warning: 0 });
  });
});

describe("countDelayedMatches", () => {
  it("counts only unstarted scheduled or pending matches beyond the threshold", () => {
    const now = new Date("2026-11-14T10:30:00Z");
    expect(countDelayedMatches([
      { status: "scheduled", scheduled_at: "2026-11-14T10:15:00Z" },
      { status: "pending", scheduled_at: "2026-11-14T10:14:59Z" },
      { status: "in_progress", scheduled_at: "2026-11-14T09:00:00Z", started_at: "2026-11-14T10:00:00Z" },
      { status: "completed", scheduled_at: "2026-11-14T09:00:00Z" },
    ], now)).toBe(2);
  });
});
