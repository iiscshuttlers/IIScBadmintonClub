import { describe, expect, it } from "vitest";
import { categoryFull, overEventsLimit, playerCategories, waitlistPosition } from "./limits";
import type { EntryRow, WaitlistRow } from "./partners";

const rows: EntryRow[] = [
  { id: "1", category: "MS", playerId: "A", partnerId: null },
  { id: "2", category: "MD", playerId: "A", partnerId: "B" },
  { id: "3", category: "XD", playerId: "C", partnerId: "F" },
];
const wait: WaitlistRow[] = [
  { id: "w1", category: "XD", playerId: "B", partnerId: "G" },
  { id: "w2", category: "XD", playerId: "H", partnerId: "A" },
];

describe("limits", () => {
  it("counts entered and waitlisted categories", () => {
    expect(playerCategories(rows, wait, "A").sort()).toEqual(["MD", "MS", "XD"]);
    expect(playerCategories(rows, wait, "B").sort()).toEqual(["MD", "XD"]);
  });

  it("checks the events limit for both members", () => {
    // A is in 3 (incl. waitlist), B in 2; adding WD with limit 3 blocks A only.
    expect(overEventsLimit(rows, wait, ["B", "A"], "WD", 3)).toEqual(["A"]);
    expect(overEventsLimit(rows, wait, ["B", "C"], "WD", 2)).toEqual(["B"]);
    // Changing partner inside a category you're already in doesn't count twice.
    expect(overEventsLimit(rows, wait, ["A"], "MD", 3)).toEqual([]);
    expect(overEventsLimit(rows, wait, ["A", "B"], "WD", null)).toEqual([]);
  });

  it("caps count rows", () => {
    expect(categoryFull(16, 16)).toBe(true);
    expect(categoryFull(15, 16)).toBe(false);
    expect(categoryFull(99, null)).toBe(false);
  });

  it("waitlist position is 1-based, either member", () => {
    expect(waitlistPosition(wait, "XD", "G")).toBe(1);
    expect(waitlistPosition(wait, "XD", "A")).toBe(2);
    expect(waitlistPosition(wait, "MD", "A")).toBe(null);
  });
});
