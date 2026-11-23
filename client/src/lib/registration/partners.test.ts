import { describe, expect, it } from "vitest";
import {
  findTaken, genderCheck, isDoublesCategory, pairDisplayName, pickPartner, swapForCaller,
  type EntryRow, type WaitlistRow,
} from "./partners";

const row = (id: string, playerId: string | null, partnerId: string | null, category = "MD"): EntryRow =>
  ({ id, category, playerId, partnerId });

describe("pickPartner (B picks C)", () => {
  it("C free: B's row gets C", () => {
    expect(pickPartner([row("rb", "B", null)], [], "MD", "B", "C")).toEqual({ kind: "free", myRowId: "rb", leftBehind: null });
  });
  it("C free and B has no entry yet: a new row", () => {
    expect(pickPartner([], [], "MD", "B", "C")).toEqual({ kind: "free", myRowId: null, leftBehind: null });
  });
  it("C entered alone: B joins C's row and B's solo row is removed", () => {
    expect(pickPartner([row("rb", "B", null), row("rc", "C", null)], [], "MD", "B", "C"))
      .toEqual({ kind: "join_alone", targetRowId: "rc", removeMyRowId: "rb", leftBehind: null });
  });
  it("C entered alone, B was paired with X: X is left behind and keeps B's old row", () => {
    expect(pickPartner([row("rb", "B", "X"), row("rc", "C", null)], [], "MD", "B", "C"))
      .toEqual({ kind: "join_alone", targetRowId: "rc", removeMyRowId: null, leftBehind: "X" });
  });
  it("C entered alone as the stored partner column", () => {
    expect(pickPartner([row("rc", null, "C")], [], "MD", "B", "C").kind).toBe("join_alone");
  });
  it("C in a pair with A: refused, names A", () => {
    expect(pickPartner([row("ra", "A", "C")], [], "MD", "B", "C")).toEqual({ kind: "taken", rowId: "ra", withPlayerId: "A" });
    expect(pickPartner([row("ra", "C", "A")], [], "MD", "B", "C")).toEqual({ kind: "taken", rowId: "ra", withPlayerId: "A" });
  });
  it("C already entered with B: nothing new", () => {
    expect(pickPartner([row("r", "C", "B")], [], "MD", "B", "C")).toEqual({ kind: "already_pair", rowId: "r" });
  });
  it("changing partner from X to a free C leaves X behind", () => {
    expect(pickPartner([row("rb", "B", "X")], [], "MD", "B", "C")).toEqual({ kind: "free", myRowId: "rb", leftBehind: "X" });
  });
  it("C on the waitlist is taken", () => {
    const w: WaitlistRow[] = [{ id: "w1", category: "MD", playerId: "C", partnerId: null }];
    expect(pickPartner([], w, "MD", "B", "C")).toEqual({ kind: "waitlisted", rowId: "w1" });
  });
  it("other categories don't count", () => {
    expect(pickPartner([row("ra", "A", "C", "XD")], [], "MD", "B", "C").kind).toBe("free");
  });
  it("picking yourself", () => {
    expect(pickPartner([], [], "MD", "B", "B")).toEqual({ kind: "self" });
  });
});

describe("findTaken", () => {
  it("excludes the given rows", () => {
    expect(findTaken([row("r", "A", "C")], [], "MD", "C", ["r"])).toEqual({ kind: "free" });
    expect(findTaken([row("r", "A", "C")], [], "MD", "C")).toMatchObject({ kind: "entry", withPlayerId: "A" });
  });
});

describe("swapForCaller", () => {
  it("swaps when the stored partner acts", () => {
    expect(swapForCaller(row("r", "A", "C"), "C")).toMatchObject({ playerId: "C", partnerId: "A" });
  });
  it("keeps the row when the stored player acts", () => {
    expect(swapForCaller(row("r", "A", "C"), "A")).toMatchObject({ playerId: "A", partnerId: "C" });
  });
});

describe("genderCheck", () => {
  it("MD needs two men", () => {
    expect(genderCheck("MD", "Male", "Male")).toBe("ok");
    expect(genderCheck("MD", "Male", "Female")).toBe("mismatch");
  });
  it("WD needs two women", () => {
    expect(genderCheck("WD", "Female", "Female")).toBe("ok");
    expect(genderCheck("WD", "Male", "Female")).toBe("mismatch");
  });
  it("XD needs one of each", () => {
    expect(genderCheck("XD", "Male", "Female")).toBe("ok");
    expect(genderCheck("XD", "Female", "Female")).toBe("mismatch");
  });
  it("unknowns are allowed but flagged", () => {
    expect(genderCheck("MD", "Male", null)).toBe("unknown");
    expect(genderCheck("XD", null, null)).toBe("unknown");
    expect(genderCheck("XD", "Male", undefined)).toBe("ok");
    expect(genderCheck("XD", null, undefined)).toBe("unknown");
  });
  it("a known mismatch wins over an unknown", () => {
    expect(genderCheck("MD", "Female", null)).toBe("mismatch");
  });
  it("ignore_gender_rules and singles skip the check", () => {
    expect(genderCheck("MD", "Male", "Female", true)).toBe("ok");
    expect(genderCheck("MS", "Female", undefined)).toBe("ok");
  });
});

describe("helpers", () => {
  it("isDoublesCategory", () => {
    expect(["MD", "wd", "XD", "Mixed Doubles", "U19 Boys Doubles"].map(isDoublesCategory)).toEqual([true, true, true, true, true]);
    expect(["MS", "WS", "Open Singles"].map(isDoublesCategory)).toEqual([false, false, false]);
  });
  it("pairDisplayName matches addParticipant", () => {
    expect(pairDisplayName("Asha", "Ravi")).toBe("Asha & Ravi");
    expect(pairDisplayName("Asha", null)).toBe("Asha");
    expect(pairDisplayName(" Asha ", "")).toBe("Asha");
  });
});
