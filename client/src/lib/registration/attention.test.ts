import { describe, expect, it } from "vitest";
import { entriesNeedingAttention, reminderAudience } from "./attention";
import type { EntryRow } from "./partners";

const row = (id: string, playerId: string | null, partnerId: string | null, category = "MD", lookingForPartner = false): EntryRow =>
  ({ id, category, playerId, partnerId, lookingForPartner });

const players = {
  A: { id: "A", gender: "Male" as const },
  B: { id: "B", gender: "Male" as const },
  C: { id: "C", gender: "Male" as const },
  D: { id: "D", gender: "Male" as const },
  G: { id: "G", gender: "Male" as const, isGuest: true },
  F: { id: "F", gender: "Female" as const },
  U: { id: "U", gender: null },
};

describe("entriesNeedingAttention", () => {
  it("finds rows with no partner, keeping the looking flag", () => {
    const att = entriesNeedingAttention([row("r1", "A", null, "MD", true), row("r2", "B", "C"), row("s", "D", null, "MS")], players);
    expect(att.noPartner).toEqual([{ rowId: "r1", category: "MD", playerId: "A", lookingForPartner: true }]);
  });

  it("finds a player shared by three pairs", () => {
    const att = entriesNeedingAttention([row("r1", "A", "C"), row("r2", "C", "B"), row("r3", "D", "C")], players);
    expect(att.sharedPartner).toEqual([
      { category: "MD", sharedPlayerId: "C", rowIds: ["r1", "r2", "r3"], otherPlayerIds: ["A", "B", "D"] },
    ]);
    expect(reminderAudience(att, "shared_partner").sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("doesn't call the same player in two categories shared", () => {
    expect(entriesNeedingAttention([row("r1", "A", "C"), row("r2", "C", "F", "XD")], players).sharedPartner).toEqual([]);
  });

  it("flags guest partners", () => {
    expect(entriesNeedingAttention([row("r1", "A", "G")], players).partnerNotOnApp).toEqual([{ rowId: "r1", category: "MD", partnerId: "G" }]);
  });

  it("flags gender mismatch and unknown, unless ignored", () => {
    const rows = [row("m", "A", "F"), row("u", "B", "U")];
    const att = entriesNeedingAttention(rows, players);
    expect(att.genderMismatch).toEqual([{ rowId: "m", category: "MD" }]);
    expect(att.genderUnknown).toEqual([{ rowId: "u", category: "MD", playerIds: ["U"] }]);
    const ignored = entriesNeedingAttention(rows, players, { ignoreGenderRules: true });
    expect(ignored.genderMismatch).toEqual([]);
    expect(ignored.genderUnknown).toEqual([]);
  });

  it("scopes to one category", () => {
    const att = entriesNeedingAttention([row("r1", "A", null), row("r2", "F", null, "XD")], players, { category: "XD" });
    expect(att.noPartner.map((n) => n.rowId)).toEqual(["r2"]);
  });

  it("builds the no-partner audience", () => {
    const att = entriesNeedingAttention([row("r1", "A", null), row("r2", "B", "C"), row("r3", "C", "D")], players);
    expect(reminderAudience(att, "no_partner")).toEqual(["A"]);
    expect(reminderAudience(att, "all_incomplete").sort()).toEqual(["A", "B", "C", "D"]);
  });
});
