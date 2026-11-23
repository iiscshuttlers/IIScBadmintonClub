import { describe, expect, it } from "vitest";
import cases from "./registrationWindowCases.json";
import { canReopen, registrationWindow, type RegistrationWindowInput } from "./window";

describe("registrationWindow (shared case list, mirrored in SQL)", () => {
  for (const c of cases as { name: string; input: RegistrationWindowInput; state: string; lockReason?: string }[]) {
    it(c.name, () => {
      const w = registrationWindow(c.input);
      expect(w.state).toBe(c.state);
      if (c.lockReason) expect(w.lockReason).toBe(c.lockReason);
    });
  }

  it("reports the effective opening and deadline", () => {
    const w = registrationWindow({
      flagOn: true, status: "upcoming", now: "2026-12-01T12:00:00Z",
      tournamentOpensAt: "2026-11-01T00:00:00Z", tournamentClosesAt: "2026-12-10T00:00:00Z",
      categoryClosesAt: "2026-12-08T00:00:00Z",
    });
    expect(w.opensAt).toBe("2026-11-01T00:00:00Z");
    expect(w.closesAt).toBe("2026-12-08T00:00:00Z");
    expect(w.canEdit).toBe(true);
  });

  it("only open and closing soon allow edits", () => {
    expect(registrationWindow({ flagOn: true, status: "upcoming", lockedAt: "x" }).canEdit).toBe(false);
    expect(registrationWindow({ flagOn: false }).canEdit).toBe(false);
  });
});

describe("canReopen", () => {
  const base = { flagOn: true, status: "upcoming", now: "2026-12-01T12:00:00Z" } as const;
  it("reopens a manual lock", () => {
    expect(canReopen({ ...base, lockedAt: "2026-12-01T00:00:00Z" })).toEqual({ ok: true, needsNewDeadline: false });
  });
  it("refuses once the draw exists", () => {
    expect(canReopen({ ...base, hasDraw: true })).toEqual({ ok: false, reason: "draw_exists" });
  });
  it("needs a new future deadline when the deadline passed", () => {
    const input = { ...base, tournamentClosesAt: "2026-12-01T10:00:00Z" };
    expect(canReopen(input)).toEqual({ ok: false, reason: "needs_new_deadline" });
    expect(canReopen(input, "2026-12-01T11:00:00Z")).toEqual({ ok: false, reason: "needs_new_deadline" });
    expect(canReopen(input, "2026-12-05T10:00:00Z")).toEqual({ ok: true, needsNewDeadline: false });
  });
  it("is not needed when not locked", () => {
    expect(canReopen(base)).toEqual({ ok: false, reason: "not_locked" });
  });
});
