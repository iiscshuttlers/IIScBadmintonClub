import { describe, it, expect } from "vitest";
import { computeMyCertificates, stageReached, type CertMatch } from "./myCertificates";

const m = (p: Partial<CertMatch>): CertMatch => ({
  category: "MS", round_name: null, match_code: null, status: "completed", winner_side: 1,
  player1_id: null, player2_id: null, player3_id: null, player4_id: null, ...p,
});
const base = { uid: "u", name: "Asha", tournamentName: "Open 2026", officialRoles: [] as string[] };

describe("computeMyCertificates", () => {
  it("gives a champion, a participant and an official certificate together", () => {
    const certs = computeMyCertificates({
      ...base,
      officialRoles: ["UMPIRE", "umpire"],
      matches: [
        m({ round_name: "Semifinal 1", player1_id: "u" }),
        m({ round_name: "Final", player2_id: "u", winner_side: 2 }),
        m({ category: "XD", round_name: "Quarterfinal 2", player3_id: "u", winner_side: 2 }),
      ],
    });
    expect(certs.map((c) => [c.placement, c.category, c.achievement])).toEqual([
      ["winner", "MS", undefined],
      ["participation", "XD", "Quarter-finalist"],
      ["official", "Tournament Official", "Umpire"],
    ]);
  });

  it("maps final loss and 3rd-place playoff", () => {
    const r = computeMyCertificates({ ...base, matches: [m({ match_code: "MS_F_01", player1_id: "u", winner_side: 2 })] });
    expect(r[0].placement).toBe("runnerUp");
    const t = computeMyCertificates({ ...base, matches: [m({ round_name: "3rd Place Playoff", player2_id: "u", winner_side: 1 })] });
    expect(t[0].placement).toBe("fourth");
  });

  it("skips categories with no finished match", () => {
    expect(computeMyCertificates({ ...base, matches: [m({ status: "scheduled", winner_side: null, player1_id: "u" })] })).toEqual([]);
  });

  it("names stages", () => {
    expect(stageReached("Semifinal 2")).toBe("Semi-finalist");
    expect(stageReached("Round 1")).toBeNull();
  });
});
