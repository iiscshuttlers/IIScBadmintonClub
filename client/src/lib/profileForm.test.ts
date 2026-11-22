import { describe, expect, it } from "vitest";
import { computeProfileForm, type FormRow } from "@/lib/profileForm";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

let n = 0;
/** "me" plays side 1 unless `side` says 2. */
const m = (o: { won?: boolean | null; score?: string; status?: string; at?: string; side?: 1 | 2 }): FormRow => {
  const side = o.side ?? 1;
  return {
    status: o.status ?? "completed",
    player1_id: side === 1 ? "me" : `opp${++n}`,
    player2_id: side === 2 ? "me" : `opp${++n}`,
    winner_side: o.won == null ? null : o.won ? side : side === 1 ? 2 : 1,
    score: o.score ?? null,
    ended_at: o.at ?? daysAgo(30),
  };
};

describe("computeProfileForm", () => {
  it("lists the last 10 results oldest first and skips undecided matches", () => {
    const rows = [
      ...Array.from({ length: 11 }, (_, i) => m({ won: i % 2 === 0, at: daysAgo(i + 1) })),
      m({ won: null, status: "scheduled", at: daysAgo(0) }),
    ];
    const f = computeProfileForm(rows, "me", NOW);
    expect(f.decided).toBe(11);
    expect(f.recent).toHaveLength(10);
    // Newest (1 day ago, i = 0) is a win and comes last.
    expect(f.recent[9]).toBe("W");
    expect(f.recent[8]).toBe("L");
    expect(f.streak).toEqual({ result: "W", count: 1 });
  });

  it("counts the current streak back from the latest result", () => {
    const f = computeProfileForm(
      [m({ won: false, at: daysAgo(1) }), m({ won: false, at: daysAgo(2) }), m({ won: true, at: daysAgo(3) })],
      "me",
      NOW,
    );
    expect(f.streak).toEqual({ result: "L", count: 2 });
    expect(computeProfileForm([], "me", NOW).streak).toBeNull();
  });

  it("finds the longest win streak", () => {
    const results = [true, true, false, true, true, true, false];
    const f = computeProfileForm(results.map((won, i) => m({ won, at: daysAgo(i + 1) })), "me", NOW);
    expect(f.bestWinStreak).toBe(3);
  });

  it("counts this week's results", () => {
    const f = computeProfileForm([m({ won: true, at: daysAgo(1) }), m({ won: false, at: daysAgo(6) }), m({ won: true, at: daysAgo(9) })], "me", NOW);
    expect(f.thisWeek).toEqual({ played: 2, won: 1 });
  });

  it("finds sweeps and deciders from either side of the net", () => {
    const f = computeProfileForm(
      [
        m({ won: true, score: "21-15, 21-18" }), // sweep
        m({ won: true, score: "15-21, 21-18, 21-19" }), // decider won
        m({ won: false, score: "21-19, 18-21, 19-21" }), // decider lost
        m({ won: true, side: 2, score: "12-21, 10-21" }), // sweep as side 2
        m({ won: true, status: "walkover" }), // a result, but no games
        m({ won: true, score: "30-24" }), // one-game round: not a straight-game win either way
      ],
      "me",
      NOW,
    );
    expect(f.decided).toBe(6);
    expect(f.sweeps).toEqual({ won: 2, of: 3 });
    expect(f.deciders).toEqual({ played: 2, won: 1 });
  });
});
