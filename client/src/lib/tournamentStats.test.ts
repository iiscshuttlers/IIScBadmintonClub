import { describe, expect, it } from "vitest";
import { computeTournamentStats } from "@/lib/tournamentStats";
import { matchFacts, trustedDurationMin } from "@/lib/matchStats";
import type { MatchView } from "@/lib/matchView";

let n = 0;
function m(p: {
  a?: [string, string[], number | null];
  b?: [string, string[], number | null];
  games?: Array<[number, number]>;
  winner?: 0 | 1;
  state?: MatchView["state"];
  started?: string | null;
  ended?: string | null;
  discipline?: MatchView["discipline"];
}): MatchView {
  const [al, aIds, aSeed] = p.a ?? ["Asha", ["a"], null];
  const [bl, bIds, bSeed] = p.b ?? ["Bala", ["b"], null];
  const winner = p.winner ?? 0;
  return {
    id: `m${++n}`,
    tournamentId: "t",
    discipline: p.discipline ?? "MS",
    categoryLabel: "Men's Singles",
    roundName: "Final",
    round: 1,
    matchNumber: n,
    matchCode: null,
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: al, playerIds: aIds, seed: aSeed, isWinner: winner === 0, isTbd: false, isBye: /\bbye\b/i.test(al) },
      { label: bl, playerIds: bIds, seed: bSeed, isWinner: winner === 1, isTbd: false, isBye: /\bbye\b/i.test(bl) },
    ],
    state: p.state ?? "completed",
    statusLabel: "Completed",
    games: (p.games ?? [[21, 10], [21, 12]]).map(([side1, side2]) => ({ side1, side2 })),
    scoreText: null,
    court: null,
    scheduledAt: null,
    startedAt: p.started ?? null,
    endedAt: p.ended ?? null,
    nextMatchCode: null,
  };
}

describe("trustedDurationMin", () => {
  it("accepts 10–120 minutes on the same day only", () => {
    expect(trustedDurationMin("2026-08-23T10:00:00", "2026-08-23T10:40:00")).toBe(40);
    expect(trustedDurationMin("2026-08-23T10:00:00", "2026-08-23T10:05:00")).toBeNull();
    expect(trustedDurationMin("2026-08-23T18:00:00", "2026-08-24T11:41:00")).toBeNull();
    expect(trustedDurationMin(null, "2026-08-23T10:40:00")).toBeNull();
  });
});

describe("matchFacts", () => {
  it("counts deuce games and margins, and ignores walkover scores", () => {
    const f = matchFacts(m({ games: [[22, 20], [19, 21], [30, 29]] }));
    expect(f).toMatchObject({ games: 3, deuceGames: 2, pointMargin: 5, longestGamePoints: 59, totalPoints: 141 });
    expect(matchFacts(m({ state: "walkover", games: [] })).games).toBe(0);
  });
});

describe("computeTournamentStats", () => {
  it("totals, records, leaders and seed upsets", () => {
    const views = [
      m({ games: [[21, 19], [22, 20]] }), // closest: margin 4
      m({ games: [[21, 2], [21, 3]] }), // most one-sided
      m({ a: ["Chitra", ["c"], null], b: ["Asha", ["a"], 1], winner: 0 }), // seed upset: unseeded beats seed 1
      m({ state: "walkover", games: [] }),
      m({ state: "live", games: [[30, 29]] }), // never counted
    ];
    const s = computeTournamentStats(views);
    expect(s.completed).toBe(4);
    expect(s.walkovers).toBe(1);
    expect(s.games).toBe(6);
    expect(s.closest[0].value).toBe(4);
    expect(s.mostOneSided[0].value).toBe(37);
    expect(s.longestGame[0].value).toBe(42);
    expect(s.mostWins[0]).toMatchObject({ label: "Asha", value: 3, note: "3 of 4" });
    expect(s.seedUpsets).toHaveLength(1);
    expect(s.seedUpsets[0].title).toBe("Chitra vs Asha");
  });

  it("hides time records when most matches have untrustworthy timing", () => {
    const s = computeTournamentStats([
      m({ started: "2026-08-23T10:00:00", ended: "2026-08-23T10:40:00" }),
      m({ started: "2026-08-23T18:00:00", ended: "2026-08-24T11:41:00" }),
      m({}),
    ]);
    expect(s.longestByTime).toBeNull();
    expect(s.timingCoverage).toBeCloseTo(1 / 3);
  });

  it("groups doubles by exact pair and lists ties", () => {
    const pair = (l: string, ids: string[]): [string, string[], null] => [l, ids, null];
    const s = computeTournamentStats([
      m({ a: pair("A / C", ["a", "c"]), b: pair("B / D", ["b", "d"]), discipline: "MD" }),
      m({ a: pair("C / A", ["c", "a"]), b: pair("E / F", ["e", "f"]), discipline: "MD" }),
    ]);
    expect(s.mostWins[0]).toMatchObject({ key: "a+c", value: 2 });
  });

  it("excludes BYE matches from decided count and wins", () => {
    const s = computeTournamentStats([
      m({
        a: ["Varun", ["v"], null],
        b: ["BYE", [], null],
        state: "completed",
        games: [],
      }),
      m({
        a: ["Varun", ["v"], null],
        b: ["Aneesh", ["an"], null],
        winner: 0,
        games: [[21, 14], [21, 9]],
      }),
    ]);
    expect(s.completed).toBe(1);
    expect(s.mostWins[0]).toMatchObject({ label: "Varun", value: 1, note: "1 of 1" });
  });

  it("accurately reflects losses in doubles when viewing combined disciplines", () => {
    const pair = (l: string, ids: string[]): [string, string[], null] => [l, ids, null];
    const s = computeTournamentStats([
      // Varun wins singles
      m({ a: ["Varun", ["v"], null], b: ["Opp1", ["o1"], null], winner: 0, discipline: "MS" }),
      // Varun and Piyush lose doubles
      m({
        a: pair("Vivek & Kota", ["vk", "ks"]),
        b: pair("Varun & Piyush", ["v", "p"]),
        winner: 0,
        discipline: "MD",
      }),
    ]);
    const varun = s.mostWins.find((r) => r.label === "Varun");
    expect(varun).toBeDefined();
    // 1 win out of 2 matches (not 100%!)
    expect(varun).toMatchObject({ value: 1, note: "1 of 2" });
  });

  it("only counts genuine deuce games", () => {
    const s = computeTournamentStats([
      m({ games: [[30, 15]] }), // 30-pt normal game: NOT deuce
      m({ games: [[30, 29]] }), // 30-pt deuce: YES
      m({ games: [[21, 14]] }), // 21-pt normal game: NOT deuce
      m({ games: [[22, 20]] }), // 21-pt deuce: YES
    ]);
    expect(s.games).toBe(4);
    expect(s.deuceGames).toBe(2);
  });
});
