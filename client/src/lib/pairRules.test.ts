import { describe, expect, it } from "vitest";
import { genderOf, misfitOnSecondSide, possibleKinds, settledKind } from "@/lib/pairRules";

const M = "male" as const;
const F = "female" as const;

describe("pairRules", () => {
  it("reads recorded genders and leaves the rest open", () => {
    expect(genderOf({ gender: "Male" })).toBe(M);
    expect(genderOf({ gender: "female" })).toBe(F);
    expect(genderOf({ gender: null })).toBeNull();
    expect(genderOf(undefined)).toBeNull();
  });

  it("settles the kind from the first pair", () => {
    expect(settledKind([M, M], [])).toBe("MD");
    expect(settledKind([F, F], [])).toBe("WD");
    expect(settledKind([M, F], [])).toBe("XD");
    expect(settledKind([M], [])).toBeNull(); // MD or XD
  });

  it("a man facing a woman can only be mixed", () => {
    expect(possibleKinds([M], [F])).toEqual(["XD"]);
  });

  it("only men fit against two men, only women against two women", () => {
    expect(possibleKinds([M, M], [M])).toEqual(["MD"]);
    expect(possibleKinds([M, M], [F])).toEqual([]);
    expect(possibleKinds([F, F], [M])).toEqual([]);
    expect(possibleKinds([F, F], [F, F])).toEqual(["WD"]);
  });

  it("a mixed pair needs a man and a woman opposite", () => {
    expect(possibleKinds([M, F], [M, F])).toEqual(["XD"]);
    expect(possibleKinds([M, F], [M, M])).toEqual([]);
    expect(possibleKinds([M, F], [F, F])).toEqual([]);
  });

  it("lets players with no recorded gender fill any slot", () => {
    expect(possibleKinds([M, M], [null])).toEqual(["MD"]);
    expect(possibleKinds([M, null], [F, F])).toEqual([]);
    expect(possibleKinds([M, null], [F])).toEqual(["XD"]);
  });

  it("says which of the second pair's picks to drop when the first pair changes", () => {
    expect(misfitOnSecondSide([M, M], F, undefined)).toBe("player");
    expect(misfitOnSecondSide([M, M], M, F)).toBe("partner");
    expect(misfitOnSecondSide([M, F], M, F)).toBeNull();
    expect(misfitOnSecondSide([M], F, F)).toBe("partner"); // F + F is WD, but a man is already on the first side
    expect(misfitOnSecondSide([], F, F)).toBeNull();
  });
});
