import { describe, expect, it } from "vitest";
import { computeClubRecords, isFinal } from "@/lib/clubRecords";
import type { MatchView } from "@/lib/matchView";

let n = 0;
function m(p: {
  t?: string;
  round?: string;
  a?: [string, string[]];
  b?: [string, string[]];
  winner?: 0 | 1;
  games?: Array<[number, number]>;
  ended?: string;
  state?: MatchView["state"];
  discipline?: MatchView["discipline"];
}): MatchView {
  const [al, aIds] = p.a ?? ["Asha", ["a"]];
  const [bl, bIds] = p.b ?? ["Bala", ["b"]];
  const w = p.winner ?? 0;
  return {
    id: `m${++n}`,
    tournamentId: p.t ?? "t1",
    discipline: p.discipline ?? "MS",
    categoryLabel: "",
    roundName: p.round ?? "Quarter-Final",
    round: 1,
    matchNumber: n,
    matchCode: null,
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: al, playerIds: aIds, seed: null, isWinner: w === 0, isTbd: false, isBye: false },
      { label: bl, playerIds: bIds, seed: null, isWinner: w === 1, isTbd: false, isBye: false },
    ],
    state: p.state ?? "completed",
    statusLabel: "",
    games: (p.games ?? [[21, 15], [21, 17]]).map(([side1, side2]) => ({ side1, side2 })),
    scoreText: null,
    court: null,
    scheduledAt: null,
    startedAt: null,
    endedAt: p.ended ?? `2026-08-${String(10 + (n % 15)).padStart(2, "0")}T10:00:00Z`,
    nextMatchCode: null,
  };
}

const T = {
  t1: { id: "t1", name: "Open 2026", countsForElo: true },
  t2: { id: "t2", name: "Fun Cup", countsForElo: false },
};

describe("isFinal", () => {
  it("matches finals but not semis or third place", () => {
    expect(isFinal(m({ round: "Final" }))).toBe(true);
    expect(isFinal(m({ round: "Grand Final" }))).toBe(true);
    expect(isFinal(m({ round: "Semi-Final" }))).toBe(false);
    expect(isFinal(m({ round: "3rd Place Final" }))).toBe(false);
  });
});

describe("computeClubRecords", () => {
  it("counts titles, finals, wins and streaks per player, doubles included", () => {
    const views = [
      m({ round: "Final", ended: "2026-08-01T10:00:00Z" }),
      m({ round: "Final", t: "t2", ended: "2026-08-02T10:00:00Z" }),
      m({ ended: "2026-08-03T10:00:00Z" }),
      m({ winner: 1, ended: "2026-08-04T10:00:00Z" }),
      m({ round: "Final", a: ["Asha / Chitra", ["a", "c"]], b: ["B / D", ["b", "d"]], discipline: "XD", ended: "2026-08-05T10:00:00Z" }),
    ];
    const r = computeClubRecords(views, T);
    expect(r.mostTitles[0]).toMatchObject({ playerId: "a", name: "Asha", value: 3 });
    expect(r.mostTitles.find((x) => x.playerId === "c")?.name).toBe("Chitra");
    expect(r.mostWins[0]).toMatchObject({ playerId: "a", value: 4, note: "of 5 matches" });
    expect(r.longestStreak.find((x) => x.playerId === "a")?.value).toBe(3);
    expect(r.tournamentCount).toBe(2);
  });

  it("filters ranked-only tournaments and disciplines", () => {
    const views = [m({ round: "Final" }), m({ round: "Final", t: "t2" }), m({ round: "Final", discipline: "WS" })];
    expect(computeClubRecords(views, T, { rankedOnly: true }).mostTitles[0].value).toBe(2);
    expect(computeClubRecords(views, T, { discipline: "WS" }).matchCount).toBe(1);
  });

  it("excludes cancelled and unknown tournaments, and finds the closest final", () => {
    const views = [
      m({ round: "Final", games: [[21, 19], [23, 21]] }),
      m({ round: "Final", games: [[21, 5], [21, 6]] }),
      m({ state: "cancelled" }),
      m({ t: "draft-x" }),
    ];
    const r = computeClubRecords(views, T);
    expect(r.matchCount).toBe(2);
    expect(r.closestFinal[0].value).toBe(4);
    expect(r.longestGame[0].value).toBe(44);
  });
});
