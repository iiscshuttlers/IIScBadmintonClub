import { describe, expect, it } from "vitest";
import { currentGameIndex, dayChipLabel, groupByEventRound, liveCourts } from "@/lib/matchGrouping";
import type { MatchView } from "@/lib/matchView";

function view(p: Partial<MatchView>): MatchView {
  return {
    id: "m",
    tournamentId: "t",
    discipline: "MS",
    categoryLabel: "Men's Singles",
    roundName: "Quarter-final",
    round: 1,
    matchNumber: 1,
    matchCode: null,
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "A", ids: [], seed: null, isWinner: false, isTbd: false, isBye: false } as any,
      { label: "B", ids: [], seed: null, isWinner: false, isTbd: false, isBye: false } as any,
    ],
    state: "scheduled",
    statusLabel: "Scheduled",
    games: [],
    scoreText: null,
    court: null,
    scheduledAt: null,
    startedAt: null,
    endedAt: null,
    nextMatchCode: null,
    ...p,
  };
}

describe("groupByEventRound", () => {
  it("groups by discipline and round, keeping input order", () => {
    const groups = groupByEventRound([
      view({ id: "1", discipline: "XD", roundName: "Final" }),
      view({ id: "2", discipline: "MS", roundName: "Semi-final" }),
      view({ id: "3", discipline: "XD", roundName: "Final" }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Mixed Doubles · Final", "Men's Singles · Semi-final"]);
    expect(groups[0].items.map((v) => v.id)).toEqual(["1", "3"]);
  });

  it("falls back to the category label for unrecognised events", () => {
    const [g] = groupByEventRound([view({ discipline: null, categoryLabel: "Rubber 2", roundName: "" })]);
    expect(g.title).toBe("Rubber 2");
  });
});

describe("dayChipLabel", () => {
  const now = new Date(2026, 10, 14, 9, 0);
  it("names nearby days", () => {
    expect(dayChipLabel("2026-11-14", now)).toBe("Today");
    expect(dayChipLabel("2026-11-15", now)).toBe("Tomorrow");
    expect(dayChipLabel("2026-11-13", now)).toBe("Yesterday");
  });
  it("formats other days", () => {
    expect(dayChipLabel("2026-11-20", now)).toMatch(/20/);
  });
});

describe("currentGameIndex", () => {
  it("is the last game only while live", () => {
    const games = [{ side1: 21, side2: 18 }, { side1: 7, side2: 9 }] as any;
    expect(currentGameIndex({ state: "live", games })).toBe(1);
    expect(currentGameIndex({ state: "completed", games })).toBe(-1);
    expect(currentGameIndex({ state: "live", games: [] })).toBe(-1);
  });
});

describe("liveCourts", () => {
  it("lists courts with a live match, naturally sorted and de-duplicated", () => {
    expect(
      liveCourts([
        { state: "live", court: "10" },
        { state: "live", court: "2" },
        { state: "scheduled", court: "3" },
        { state: "live", court: "2" },
        { state: "live", court: null },
      ]),
    ).toEqual(["2", "10"]);
  });
});
