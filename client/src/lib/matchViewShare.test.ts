import { describe, expect, it } from "vitest";
import { canShareResult, matchShareUrl, matchViewToShareInput } from "@/lib/matchViewShare";
import type { MatchView } from "@/lib/matchView";

function view(p: Partial<MatchView> = {}): MatchView {
  return {
    id: "m1",
    tournamentId: "t1",
    discipline: "MS",
    categoryLabel: "Men's Singles",
    roundName: "Final",
    round: 3,
    matchNumber: 1,
    matchCode: null,
    rubberLabel: null,
    tieId: null,
    sides: [
      { label: "Asha", isTbd: false, isBye: false, isWinner: false, seed: 2, playerIds: ["a"] },
      { label: "Bala", isTbd: false, isBye: false, isWinner: true, seed: null, playerIds: ["b"] },
    ],
    state: "completed",
    statusLabel: "Completed",
    games: [
      { side1: 21, side2: 18 },
      { side1: 15, side2: 21 },
      { side1: 19, side2: 21 },
    ],
    scoreText: null,
    court: "1",
    scheduledAt: null,
    startedAt: null,
    endedAt: "2026-08-23T12:00:00Z",
    nextMatchCode: null,
    ...p,
  };
}

describe("matchShareUrl", () => {
  it("is absolute and keeps the GitHub Pages base path", () => {
    expect(matchShareUrl({ tournamentId: "t1", id: "m1" })).toBe(
      "https://iiscshuttlers.github.io/IIScBadmintonClub/tournaments/t1/matches/m1",
    );
  });
});

describe("matchViewToShareInput", () => {
  it("orients games winner-first and labels the event", () => {
    const r = matchViewToShareInput(view(), { tournamentName: "Open 2026" })!;
    expect(r.data.winners).toEqual([{ name: "Bala" }]);
    expect(r.data.losers).toEqual([{ name: "Asha [2]" }]);
    expect(r.data.sets).toEqual([
      { w: 18, l: 21 },
      { w: 21, l: 15 },
      { w: 21, l: 19 },
    ]);
    expect(r.data.setsWon).toEqual({ w: 2, l: 1 });
    expect(r.data.category).toBe("Men's Singles · Final");
    expect(r.text).toContain("Open 2026 · Men's Singles · Final: Bala def. Asha (18-21, 21-15, 21-19)");
    expect(r.url).toMatch(/\/tournaments\/t1\/matches\/m1$/);
  });

  it("splits doubles pairs into players", () => {
    const v = view({
      sides: [
        { label: "Asha / Chitra", isTbd: false, isBye: false, isWinner: true, seed: null, playerIds: ["a", "c"] },
        { label: "Bala & Dev", isTbd: false, isBye: false, isWinner: false, seed: null, playerIds: ["b", "d"] },
      ],
    });
    const r = matchViewToShareInput(v)!;
    expect(r.data.winners).toEqual([{ name: "Asha" }, { name: "Chitra" }]);
    expect(r.data.losers).toEqual([{ name: "Bala" }, { name: "Dev" }]);
  });

  it("shares walkovers without games", () => {
    const r = matchViewToShareInput(view({ state: "walkover", games: [] }))!;
    expect(r.data.displayScore).toBe("Walkover");
    expect(r.data.sets).toEqual([]);
    expect(r.text).toContain("won by walkover against");
  });

  it("refuses undecided matches", () => {
    expect(canShareResult(view({ state: "live" }))).toBe(false);
    expect(matchViewToShareInput(view({ state: "scheduled" }))).toBeNull();
  });
});
