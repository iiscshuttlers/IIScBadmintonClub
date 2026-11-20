import { describe, expect, it } from "vitest";
import {
  assessPointLogCoverage,
  decodePoints,
  gameFlows,
  gameMinutes,
  isGamePoint,
  keyMoments,
  longestRun,
  nextServer,
  progression,
  rallyServers,
  rallyStats,
  shortNames,
  splitGames,
  statInsights,
  type Rally,
  type RallyStats,
  type SideStats,
} from "@/lib/pointLog";

/** Build a game's rallies from a winner sequence like "1122…". */
function game(n: number, seq: string, t0 = 0): Rally[] {
  let a = 0;
  let b = 0;
  return [...seq].map((c, i) => {
    if (c === "1") a++;
    else b++;
    return { game: n, side: c === "1" ? 1 : 2, t1: a, t2: b, server: c === "1" ? 1 : 2, ts: t0 + i * 20_000 } as Rally;
  });
}

describe("decodePoints", () => {
  it("keeps scoring rallies and drops lets, faults and junk", () => {
    expect(decodePoints([[1, 1, 1, 0, 1, 10], [1, 0, 1, 0, 1, 20], "x", [1, 2, 1, 1, 2, 30]])).toEqual([
      { game: 1, side: 1, t1: 1, t2: 0, server: 1, ts: 10 },
      { game: 1, side: 2, t1: 1, t2: 1, server: 2, ts: 30 },
    ]);
    expect(decodePoints(null)).toEqual([]);
  });
});

describe("isGamePoint", () => {
  const rules = { pointsToWin: 21, goldenPoint: 30, bestOf: 3 };
  it("follows BWF scoring", () => {
    expect(isGamePoint(20, 15, rules)).toBe(true);
    expect(isGamePoint(20, 20, rules)).toBe(false);
    expect(isGamePoint(21, 20, rules)).toBe(true);
    expect(isGamePoint(29, 29, rules)).toBe(true);
    expect(isGamePoint(19, 10, rules)).toBe(false);
  });

  it("supports 15- and 30-point formats and an uncapped game", () => {
    const to15 = { pointsToWin: 15, goldenPoint: 21, bestOf: 3 };
    expect(isGamePoint(14, 10, to15)).toBe(true);
    expect(isGamePoint(14, 14, to15)).toBe(false);
    expect(isGamePoint(20, 20, to15)).toBe(true);

    const to30 = { pointsToWin: 30, goldenPoint: 30, bestOf: 1 };
    expect(isGamePoint(29, 29, to30)).toBe(true);

    const uncapped = { pointsToWin: 21, goldenPoint: 0, bestOf: 3 };
    expect(isGamePoint(0, 0, uncapped)).toBe(false);
    expect(isGamePoint(20, 20, uncapped)).toBe(false);
    expect(isGamePoint(21, 20, uncapped)).toBe(true);
  });
});

describe("assessPointLogCoverage", () => {
  const options = { finished: true, final: true, supersededByCorrection: false };

  it.each([
    [15, { side1: 15, side2: 0 }],
    [21, { side1: 21, side2: 0 }],
    [30, { side1: 30, side2: 0 }],
  ])("recognises a complete contiguous game to %i", (points, expected) => {
    expect(assessPointLogCoverage(game(1, "1".repeat(points)), [expected], options)).toBe("complete");
  });

  it("does not call a score-only or truncated timeline complete", () => {
    const jumped: Rally[] = [{ game: 1, side: 1, t1: 21, t2: 0, server: 1, ts: 1 }];
    expect(assessPointLogCoverage(jumped, [{ side1: 21, side2: 0 }], options)).toBe("partial");
    expect(assessPointLogCoverage(game(1, "1".repeat(11)), [{ side1: 21, side2: 0 }], options)).toBe("partial");
  });

  it("distinguishes a current live history and a corrected result", () => {
    const rallies = game(1, "11122");
    expect(assessPointLogCoverage(rallies, [{ side1: 3, side2: 2 }], { ...options, finished: false, final: false })).toBe("live");
    expect(assessPointLogCoverage(rallies, [{ side1: 3, side2: 2 }], { ...options, supersededByCorrection: true })).toBe("corrected");
  });
});

describe("splitGames and longestRun", () => {
  it("groups by game and finds the winner and runs", () => {
    const r = [...game(1, "1".repeat(21)), ...game(2, "2122")];
    const g = splitGames(r);
    expect(g.map((x) => [x.game, x.winner, x.final])).toEqual([
      [1, 1, [21, 0]],
      [2, 2, [1, 3]],
    ]);
    expect(longestRun(g[0].rallies)).toEqual({ side: 1, length: 21 });
  });
});

describe("keyMoments", () => {
  it("finds a comeback, a run and the converted match point", () => {
    // Game 1: side 1 wins 21-0. Game 2: side 2 leads 0-6, side 1 wins 21-6.
    const r = [...game(1, "1".repeat(21)), ...game(2, "222222" + "1".repeat(21))];
    const m = keyMoments(r, undefined, ["Asha", "Bala"]);
    expect(m.map((x) => x.kind)).toContain("comeback");
    expect(m.find((x) => x.kind === "comeback")?.text).toBe("Asha came back from 6 points down to win the game");
    expect(m.find((x) => x.kind === "match_point")?.text).toBe("Asha won on match point at 20–6");
  });

  it("counts deuce, saved game points and golden point", () => {
    // 20-20 via alternation, then 29-29, then side 2 wins 30-29.
    const seq = "12".repeat(29) + "2";
    const m = keyMoments(game(1, seq), undefined, ["A", "B"]);
    expect(m.some((x) => x.kind === "golden")).toBe(true);
    const saved = m.filter((x) => x.kind === "game_points_saved");
    expect(saved.length).toBeGreaterThan(0);
  });
});

describe("progression and gameMinutes", () => {
  it("samples every 5 rallies plus the end, and times games", () => {
    const [g] = splitGames(game(1, "1112211", 1_700_000_000_000));
    expect(progression(g).map((p) => p.rally)).toEqual([5, 7]);
    // 7 rallies × 20 s apart = 2 minutes.
    expect(gameMinutes(g)).toBe(2);
  });
});

describe("rallyServers / nextServer", () => {
  it("takes each rally's server from the previous rally's winner, across games", () => {
    const rallies = [...game(1, "112"), ...game(2, "1")];
    // The match's first serve isn't stored; the stored "server" is the next server.
    expect(rallyServers(rallies)).toEqual([null, 1, 1, 2]);
    expect(nextServer(rallies)).toBe(1);
    expect(nextServer([])).toBeNull();
  });
});

describe("rallyStats", () => {
  it("counts points, runs, leads, ties and serve/receive for each side", () => {
    const s = rallyStats(game(1, "11221112"));
    const [a, b] = s.sides;
    expect(s.rallies).toBe(8);
    expect([a.pointsWon, b.pointsWon]).toEqual([5, 3]);
    expect([a.longestRun, b.longestRun]).toEqual([3, 2]);
    expect([a.biggestLead, b.biggestLead]).toEqual([3, 0]);
    expect([a.ralliesAhead, b.ralliesAhead]).toEqual([7, 0]);
    expect(s.ties).toBe(1);
    expect(s.leadChanges).toBe(0);
    // Servers by rally: ?, 1, 1, 2, 2, 1, 1, 1
    expect(a.onServe).toEqual({ won: 3, of: 5 });
    expect(b.onReceive).toEqual({ won: 2, of: 5 });
    expect(b.onServe).toEqual({ won: 1, of: 2 });
    expect(a.onReceive).toEqual({ won: 1, of: 2 });
  });

  it("counts game points, crunch points and lead changes", () => {
    const rules = { pointsToWin: 5, goldenPoint: 7, bestOf: 3 };
    const s = rallyStats(game(1, "1122111"), rules);
    expect(s.sides[0].gamePoints).toEqual({ won: 1, of: 1 });
    expect(s.sides[1].gamePoints).toEqual({ won: 0, of: 0 });
    // Crunch from 2-all: the rallies starting at 2–2, 3–2 and 4–2.
    expect(s.crunchFrom).toBe(2);
    expect(s.sides[0].crunch).toEqual({ won: 3, of: 3 });
    const swing = rallyStats(game(1, "1221"));
    expect(swing.leadChanges).toBe(1);
    expect(swing.ties).toBe(2);
  });

  it("scopes to one game but keeps that game's first server", () => {
    const rallies = [...game(1, "11"), ...game(2, "2")];
    const g2 = rallyStats(rallies, undefined, 2);
    expect(g2.rallies).toBe(1);
    expect(g2.sides[0].onServe).toEqual({ won: 0, of: 1 });
    expect(g2.sides[1].onReceive).toEqual({ won: 1, of: 1 });
  });
});

describe("gameFlows", () => {
  it("gives the interval score, lead changes and best run per game", () => {
    const rules = { pointsToWin: 5, goldenPoint: 7, bestOf: 3 };
    const [g] = gameFlows(game(1, "1122111"), rules);
    expect(g).toMatchObject({ game: 1, final: [5, 2], winner: 1, atInterval: [3, 2], leadChanges: 0, longestRun: { side: 1, length: 3 } });
  });
});

describe("statInsights", () => {
  const side = (over: Partial<SideStats>): SideStats => ({
    pointsWon: 0,
    longestRun: 0,
    biggestLead: 0,
    ralliesAhead: 0,
    gamePoints: { won: 0, of: 0 },
    onServe: { won: 0, of: 0 },
    onReceive: { won: 0, of: 0 },
    crunch: { won: 0, of: 0 },
    ...over,
  });
  const base: RallyStats = { rallies: 78, sides: [side({}), side({})], leadChanges: 0, ties: 0, crunchFrom: 18 };

  it("leads with a winner who scored fewer points", () => {
    const stats = { ...base, sides: [side({ pointsWon: 40, ralliesAhead: 30 }), side({ pointsWon: 38, ralliesAhead: 30 })] as [SideStats, SideStats] };
    expect(statInsights(stats, ["Asha", "Bala"], { scope: "match", matchWinner: 2 })[0]).toBe(
      "Asha won more points (40–38), but Bala won the match.",
    );
  });

  it("names control, serve and crunch-time edges, using names only", () => {
    const stats = {
      ...base,
      sides: [
        side({ pointsWon: 42, ralliesAhead: 60, onServe: { won: 26, of: 40 }, crunch: { won: 4, of: 5 } }),
        side({ pointsWon: 36, ralliesAhead: 10, onServe: { won: 18, of: 37 }, crunch: { won: 1, of: 5 } }),
      ] as [SideStats, SideStats],
    };
    const lines = statInsights(stats, ["Asha", "Bala"], { scope: "match", matchWinner: 1 });
    expect(lines).toContain("Asha led for 77% of the match.");
    expect(lines).toContain("On serve, Asha won 65% of points and Bala 49%.");
    expect(lines).toContain("From 18-all, Asha won 4 of 5 points.");
    expect(lines.join(" ")).not.toMatch(/\b(he|she|his|her)\b/i);
  });

  it("says nothing on too few rallies", () => {
    expect(statInsights({ ...base, rallies: 5 }, ["A", "B"], { scope: "game" })).toEqual([]);
  });
});

describe("shortNames", () => {
  it("uses first names, skipping initials, and both partners in doubles", () => {
    expect(shortNames(["Shiv Pratap Singh Rathore", "Uday regon"])).toEqual(["Shiv", "Uday"]);
    expect(shortNames(["Ritul & Prasenjeet Padhi", "K. Ramesh / S Kumar"])).toEqual(["Ritul & Prasenjeet", "Ramesh & Kumar"]);
  });
  it("keeps full names when the short ones would clash", () => {
    expect(shortNames(["Rahul Iyer", "Rahul Menon"])).toEqual(["Rahul Iyer", "Rahul Menon"]);
  });
});
