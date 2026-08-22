import { describe, it, expect } from "vitest";
import { toLocalDateTimeInput, localDateTimeInputToIso } from "./schedule";

describe("toLocalDateTimeInput", () => {
  it("renders a stored timestamp as the local wall-clock time", () => {
    const iso = "2026-08-22T16:30:00.000Z";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    // Asserted against the runner's own timezone so this holds anywhere.
    expect(toLocalDateTimeInput(iso)).toBe(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  });

  it("does not shift the time by the UTC offset", () => {
    // The trap: using toISOString().slice(0, 16) here would show UTC in a
    // control that means local time, moving every match by the offset.
    const iso = "2026-08-22T16:30:00.000Z";
    const offsetMinutes = new Date(iso).getTimezoneOffset();
    const shown = toLocalDateTimeInput(iso);
    const utcShown = iso.slice(0, 16);
    if (offsetMinutes !== 0) expect(shown).not.toBe(utcShown);
  });

  it("returns an empty string for a missing or unusable value", () => {
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(toLocalDateTimeInput(undefined)).toBe("");
    expect(toLocalDateTimeInput("")).toBe("");
    expect(toLocalDateTimeInput("not a date")).toBe("");
  });
});

describe("localDateTimeInputToIso", () => {
  it("reads the input as local time", () => {
    const value = "2026-08-22T16:30";
    expect(localDateTimeInputToIso(value)).toBe(new Date(value).toISOString());
  });

  it("rejects empty and malformed values", () => {
    expect(localDateTimeInputToIso("")).toBeNull();
    expect(localDateTimeInputToIso("tomorrow")).toBeNull();
    expect(localDateTimeInputToIso("2026-13-45T99:99")).toBeNull();
  });
});

describe("round trip", () => {
  it("survives storage and re-editing unchanged", () => {
    // Reopening the dialog and saving again must not drift the slot.
    const stored = "2026-08-22T16:30:00.000Z";
    const shown = toLocalDateTimeInput(stored);
    const resaved = localDateTimeInputToIso(shown);
    expect(resaved).toBe(stored);
  });

  it("holds across a daylight-saving style offset change", () => {
    for (const stored of ["2026-01-15T09:05:00.000Z", "2026-07-15T09:05:00.000Z"]) {
      expect(localDateTimeInputToIso(toLocalDateTimeInput(stored))).toBe(stored);
    }
  });
});
