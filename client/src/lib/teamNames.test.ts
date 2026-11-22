import { describe, expect, it } from "vitest";
import { isTeamDoubles, resolveTeamMembers, resolveTeamName } from "@/lib/teamNames";

const p = (full_name: string) => ({ id: full_name.toLowerCase().replace(/\s+/g, "-"), full_name, avatar_url: null });
const names = (members: { full_name: string }[]) => members.map((m) => m.full_name);

describe("resolveTeamMembers", () => {
  it("uses both player records when both are linked", () => {
    expect(names(resolveTeamMembers(p("A"), p("B"), "A & B"))).toEqual(["A", "B"]);
  });

  it("fills an unlinked partner from the other name in the label", () => {
    const team = resolveTeamMembers(p("Manish Mandal"), null, "Manish Mandal & Ravi K");
    expect(names(team)).toEqual(["Manish Mandal", "Ravi K"]);
    expect(team[1]).toMatchObject({ isUnlinked: true });
    expect(names(resolveTeamMembers(null, p("Ravi K"), "Manish Mandal & Ravi K"))).toEqual(["Manish Mandal", "Ravi K"]);
  });

  it("never turns a one-name label into a partner (singles entry name differs from the profile)", () => {
    expect(names(resolveTeamMembers(p("Piyush Tiwary"), null, "Piyush Tiwary Lalit Kumar"))).toEqual(["Piyush Tiwary"]);
    expect(names(resolveTeamMembers(p("Gopika Atul"), null, "Gopika"))).toEqual(["Gopika Atul"]);
    expect(names(resolveTeamMembers(p("Abhisek K"), null, "Abhisek K "))).toEqual(["Abhisek K"]);
    expect(resolveTeamName(p("Piyush Tiwary"), null, "Piyush Tiwary Lalit Kumar")).toBe("Piyush Tiwary");
    expect(isTeamDoubles(p("Piyush Tiwary"), null, "Piyush Tiwary Lalit Kumar")).toBe(false);
  });

  it("goes by position when the linked player's name is spelled differently in a pair label", () => {
    expect(names(resolveTeamMembers(p("Piyush Tiwary"), null, "Piyush T & Lalit Kumar"))).toEqual(["Piyush Tiwary", "Lalit Kumar"]);
    expect(names(resolveTeamMembers(null, p("Lalit Kumar"), "Piyush T & Lalit K"))).toEqual(["Piyush T", "Lalit Kumar"]);
  });

  it("splits the label when nobody is linked", () => {
    expect(names(resolveTeamMembers(null, null, "A & B"))).toEqual(["A", "B"]);
    expect(names(resolveTeamMembers(null, null, "Solo"))).toEqual(["Solo"]);
    expect(resolveTeamMembers(null, null, null)).toEqual([]);
  });
});
