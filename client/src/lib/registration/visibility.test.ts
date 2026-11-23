import { describe, expect, it } from "vitest";
import { categoryEntriesVisible, hiddenReason } from "./visibility";
import type { RegistrationWindow } from "./window";

const open: RegistrationWindow = { state: "open", opensAt: null, closesAt: null, lockReason: null, canEdit: true };
const closed: RegistrationWindow = { state: "locked", opensAt: null, closesAt: null, lockReason: "deadline", canEdit: false };
const drawn: RegistrationWindow = { state: "locked", opensAt: null, closesAt: null, lockReason: "draw", canEdit: false };

describe("categoryEntriesVisible", () => {
  it("flag off: show_participants decides, settings ignored", () => {
    expect(categoryEntriesVisible({ flagOn: false, showParticipants: true, visibility: "hidden" })).toBe(true);
    expect(categoryEntriesVisible({ flagOn: false, showParticipants: false, visibility: "as_entered" })).toBe(false);
  });
  it("null inherits show_participants", () => {
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: null, window: open })).toBe(true);
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: false, visibility: null, window: open })).toBe(false);
  });
  it("as_entered shows at once, even with show_participants off", () => {
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: false, visibility: "as_entered", window: open })).toBe(true);
  });
  it("after_close waits for the lock", () => {
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: "after_close", window: open })).toBe(false);
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: "after_close", window: closed })).toBe(true);
  });
  it("after_draw waits for the draw", () => {
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: "after_draw", window: closed })).toBe(false);
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: "after_draw", window: drawn })).toBe(true);
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: "after_draw", hasDraw: true })).toBe(true);
  });
  it("hidden never shows", () => {
    expect(categoryEntriesVisible({ flagOn: true, showParticipants: true, visibility: "hidden", window: drawn, hasDraw: true })).toBe(false);
  });
  it("explains why", () => {
    expect(hiddenReason("after_draw")).toMatch(/draw/);
    expect(hiddenReason(null)).toMatch(/not been published/);
  });
});
