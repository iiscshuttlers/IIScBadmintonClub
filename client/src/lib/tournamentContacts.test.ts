import { describe, expect, it } from "vitest";
import { isTournamentFinished, parseContactsMode } from "./tournamentContacts";

describe("parseContactsMode", () => {
  it("reads the mode setting", () => {
    expect(parseContactsMode({ mode: "hidden" })).toBe("hidden");
    expect(parseContactsMode({ mode: "officials" })).toBe("officials");
    expect(parseContactsMode({ mode: "everyone" })).toBe("everyone");
  });

  it("keeps the meaning of older boolean settings", () => {
    expect(parseContactsMode(true)).toBe("everyone");
    expect(parseContactsMode({ enabled: true })).toBe("everyone");
    expect(parseContactsMode(false)).toBe("officials");
    expect(parseContactsMode({ enabled: false })).toBe("officials");
  });

  it("defaults to officials for missing or unknown values", () => {
    expect(parseContactsMode(null)).toBe("officials");
    expect(parseContactsMode(undefined)).toBe("officials");
    expect(parseContactsMode({ mode: "public" })).toBe("officials");
    expect(parseContactsMode("everyone")).toBe("officials");
  });
});

describe("isTournamentFinished", () => {
  it("matches finished statuses in any case", () => {
    for (const s of ["completed", "archived", "deleted", "COMPLETED", "Archived"]) {
      expect(isTournamentFinished(s)).toBe(true);
    }
  });

  it("is false while the tournament runs", () => {
    for (const s of ["draft", "registration", "in_progress", "", null, undefined]) {
      expect(isTournamentFinished(s)).toBe(false);
    }
  });
});
