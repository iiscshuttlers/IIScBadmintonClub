import { describe, expect, it } from "vitest";
import {
  findCourtConflicts,
  suggestAlternativeSlots,
  type CourtScheduledMatch,
  type UnavailableCourtPeriod,
} from "./courtConflicts";

const match = (id: string, court: string | null, at: string | null, extra: Partial<CourtScheduledMatch> = {}): CourtScheduledMatch => ({
  id,
  court_number: court,
  scheduled_at: at,
  status: "scheduled",
  match_code: id.toUpperCase(),
  ...extra,
});

describe("findCourtConflicts", () => {
  it("flags overlapping estimated slots on the same court as warning", () => {
    const conflicts = findCourtConflicts([
      match("a", "C1", "2026-11-12T10:00:00Z"),
      match("b", "c1", "2026-11-12T10:20:00Z"),
    ]);

    expect(conflicts.get("a")?.[0]).toMatchObject({
      otherCode: "B",
      overlapMins: 10,
      timingBasis: "estimated",
      conflictType: "warning",
    });
    expect(conflicts.get("b")?.[0]).toMatchObject({
      otherCode: "A",
      court: "C1",
      conflictType: "warning",
    });
  });

  it("flags court occupied by in-progress match as hard conflict", () => {
    const conflicts = findCourtConflicts([
      match("live1", "1", "2026-11-12T10:00:00Z", { status: "in_progress", started_at: "2026-11-12T10:05:00Z" }),
      match("next1", "1", "2026-11-12T10:20:00Z", { status: "scheduled" }),
    ]);

    expect(conflicts.get("next1")?.[0]).toMatchObject({
      conflictType: "hard",
      timingBasis: "actual",
      court: "1",
    });
  });

  it("flags court in unavailable blackout period as hard conflict", () => {
    const unavailablePeriods: UnavailableCourtPeriod[] = [
      {
        court: "1",
        start: "2026-11-12T14:00:00Z",
        end: "2026-11-12T16:00:00Z",
        reason: "Coaching camp",
      },
    ];

    const conflicts = findCourtConflicts(
      [match("m1", "1", "2026-11-12T14:30:00Z")],
      { unavailablePeriods }
    );

    expect(conflicts.get("m1")?.[0]).toMatchObject({
      conflictType: "hard",
      timingBasis: "unavailable_period",
      court: "1",
      reason: "Coaching camp",
    });
  });

  it("uses actual end times and allows adjacent slots", () => {
    const conflicts = findCourtConflicts([
      match("a", "1", "2026-11-12T10:00:00Z", { status: "completed", ended_at: "2026-11-12T10:42:00Z" }),
      match("b", "1", "2026-11-12T10:42:00Z"),
      match("c", "2", "2026-11-12T10:10:00Z"),
    ]);

    expect(conflicts.size).toBe(0);
  });

  it("ignores walkovers and unscheduled matches", () => {
    const conflicts = findCourtConflicts([
      match("a", "1", "2026-11-12T10:00:00Z", { status: "walkover" }),
      match("b", "1", "2026-11-12T10:05:00Z"),
      match("c", "1", null),
    ]);

    expect(conflicts.size).toBe(0);
  });
});

describe("findCourtConflicts: one court, many spellings", () => {
  it('treats "1", "C1" and "Court 1" as the same court', () => {
    const conflicts = findCourtConflicts([
      match("a", "1", "2026-11-12T10:00:00Z"),
      match("b", "C1", "2026-11-12T10:10:00Z"),
      match("c", "Court 1", "2026-11-12T10:20:00Z"),
    ]);
    expect(conflicts.get("a")?.map((c) => c.otherCode)).toEqual(["B", "C"]);
    expect(conflicts.get("c")?.map((c) => c.otherCode)).toEqual(["A", "B"]);
  });

  it("never matches different courts or placeholders", () => {
    const conflicts = findCourtConflicts([
      match("a", "C1", "2026-11-12T10:00:00Z"),
      match("b", "C11", "2026-11-12T10:00:00Z"),
      match("c", "Court", "2026-11-12T10:00:00Z"),
      match("d", "Court", "2026-11-12T10:00:00Z"),
    ]);
    expect(conflicts.size).toBe(0);
  });

  it("applies a blackout typed as Court 2 to a match stored as 2", () => {
    const conflicts = findCourtConflicts([match("a", "2", "2026-11-12T10:00:00Z")], {
      unavailablePeriods: [{ court: "Court 2", start: "2026-11-12T09:00:00Z", end: "2026-11-12T11:00:00Z" }],
    });
    expect(conflicts.get("a")?.[0]).toMatchObject({ timingBasis: "unavailable_period", conflictType: "hard" });
  });

  it("doesn't suggest the same court under another spelling at the same time", () => {
    const target = match("t", "1", "2026-11-12T10:00:00Z");
    const slots = suggestAlternativeSlots(target, [target], ["C1", "C2"]);
    expect(slots[0]).toMatchObject({ court: "C2", scheduledAt: "2026-11-12T10:00:00.000Z" });
  });
});

describe("suggestAlternativeSlots", () => {
  it("suggests available alternative courts and subsequent slots", () => {
    const target = match("target", "1", "2026-11-12T10:00:00Z");
    const other = match("busy", "1", "2026-11-12T10:00:00Z");
    const all = [target, other];
    const courts = ["1", "2", "3"];

    const suggestions = suggestAlternativeSlots(target, all, courts, 30);
    expect(suggestions.length).toBeGreaterThan(0);
    // Should suggest Court 2 or 3 at the same time (10:00)
    const court2Suggestion = suggestions.find((s) => s.court === "2" && s.scheduled_at === "2026-11-12T10:00:00.000Z");
    expect(court2Suggestion).toBeDefined();
    // And on Court 1 after match finishes (10:30)
    const court1Later = suggestions.find((s) => s.court === "1" && s.scheduled_at === "2026-11-12T10:30:00.000Z");
    expect(court1Later).toBeDefined();
  });

  it("does not suggest slots that fall into unavailable blackout periods", () => {
    const target = match("target", "1", "2026-11-12T14:00:00Z");
    const blackout: UnavailableCourtPeriod[] = [
      {
        court: "2",
        start: "2026-11-12T14:00:00Z",
        end: "2026-11-12T15:00:00Z",
        reason: "Maintenance",
      },
    ];

    const suggestions = suggestAlternativeSlots(target, [target], ["1", "2"], 30, blackout);
    const inBlackout = suggestions.find((s) => s.court === "2" && s.scheduled_at === "2026-11-12T14:00:00.000Z");
    expect(inBlackout).toBeUndefined();
  });
});
