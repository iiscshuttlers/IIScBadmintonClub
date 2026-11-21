import { describe, expect, it } from "vitest";
import { scoreInsights, scoreStats } from "@/lib/scoreStats";

const names: [string, string] = ["Vivek & Kota", "Varun & Piyush"];

describe("scoreStats", () => {
  it("adds up points, games won, biggest wins and extra-point games", () => {
    const s = scoreStats([
      { side1: 24, side2: 22 },
      { side1: 21, side2: 17 },
    ]);
    expect(s.points).toEqual([45, 39]);
    expect(s.gamesWon).toEqual([2, 0]);
    expect(s.biggestWin).toEqual([4, 0]);
    expect(s.games.map((g) => g.extraPoints)).toEqual([true, false]);
  });

  it("uses the match's own target score", () => {
    expect(scoreStats([{ side1: 16, side2: 14 }], 15).games[0].extraPoints).toBe(true);
    expect(scoreStats([{ side1: 16, side2: 14 }], 21).games[0].extraPoints).toBe(false);
  });
});

describe("scoreInsights", () => {
  it("says straight games and extra points in short sentences", () => {
    const s = scoreStats([
      { side1: 24, side2: 22 },
      { side1: 21, side2: 17 },
    ]);
    expect(scoreInsights(s, names, 1)).toEqual(["Vivek & Kota won in straight games.", "Game 1 went to extra points (24–22)."]);
  });

  it("notes a comeback, a decider, a fewer-points winner and a big win", () => {
    const comeback = scoreStats([
      { side1: 2, side2: 21 },
      { side1: 21, side2: 19 },
      { side1: 21, side2: 19 },
    ]);
    const lines = scoreInsights(comeback, names, 1);
    expect(lines[0]).toBe("Varun & Piyush won more points (59–44), but Vivek & Kota won the match.");
    expect(lines).toContain("Vivek & Kota lost the first game but came back to win.");
    expect(lines).toContain("Varun & Piyush's biggest win was 21–2 in Game 1.");

    const decider = scoreStats([
      { side1: 21, side2: 15 },
      { side1: 18, side2: 21 },
      { side1: 21, side2: 12 },
    ]);
    expect(scoreInsights(decider, names, 1)).toContain("Vivek & Kota won the deciding game 21–12.");
  });

  it("never uses pronouns", () => {
    const s = scoreStats([
      { side1: 2, side2: 21 },
      { side1: 23, side2: 21 },
      { side1: 21, side2: 19 },
    ]);
    expect(scoreInsights(s, names, 1).join(" ")).not.toMatch(/\b(he|she|his|her)\b/i);
  });
});
