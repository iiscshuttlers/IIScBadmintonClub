import { describe, it, expect } from "vitest";
import { computeReport, matchesToCsv, parseGames, type ReportMatch } from "./tournamentReport";

const base = (o: Partial<ReportMatch>): ReportMatch => ({
  id: Math.random().toString(36).slice(2),
  category: "MS",
  status: "completed",
  player1_id: "a",
  player2_id: "b",
  team1_label: "Asha",
  team2_label: "Ravi",
  ...o,
});

describe("tournamentReport", () => {
  it("parses scores from sets_history or score", () => {
    expect(parseGames({ score: "21-19, 19-21, 22-20" })).toEqual([[21, 19], [19, 21], [22, 20]]);
    expect(parseGames({ sets_history: ["21-10"], score: "ignored" })).toEqual([[21, 10]]);
    expect(parseGames({ score: null })).toEqual([]);
  });

  it("aggregates counts, podium, durations and umpires", () => {
    const r = computeReport([
      base({ round_name: "Semi-Final", winner_side: 1, score: "21-10, 21-12", team2_label: "Kiran", player2_id: "k",
        started_at: "2026-10-15T09:00:00Z", ended_at: "2026-10-15T09:30:00Z", umpired_by: "u1", court_number: "2" }),
      base({ round_name: "Semi-Final", winner_side: 2, score: "18-21, 21-19, 20-22", team1_label: "Meera", player1_id: "m",
        started_at: "2026-10-15T09:00:00Z", ended_at: "2026-10-15T10:00:00Z", umpired_by: "u1", court_number: "1" }),
      base({ round_name: "Final", winner_side: 1, score: "21-15, 21-17",
        started_at: "2026-10-15T11:00:00Z", ended_at: "2026-10-15T11:40:00Z", umpired_by: "u2", court_number: "1" }),
      base({ category: "WS", status: "walkover", winner_side: 1, team1_label: "X", team2_label: "Y", player1_id: "x", player2_id: "y" }),
      base({ category: "WS", status: "scheduled", team2_label: "BYE", player2_id: null }),
    ]);
    expect(r.totalMatches).toBe(4); // bye excluded
    expect(r.completed).toBe(3);
    expect(r.walkovers).toBe(1);
    expect(r.remaining).toBe(0);
    expect(r.players).toBe(6);
    const ms = r.categories.find((c) => c.category === "MS")!;
    expect(ms.winner).toBe("Asha");
    expect(ms.runnerUp).toBe("Ravi");
    expect(ms.third.sort()).toEqual(["Kiran", "Meera"]);
    expect(r.courtsUsed).toEqual(["1", "2"]);
    expect(Math.round(r.avgMatchMins!)).toBe(43);
    expect(r.umpires[0]).toEqual({ id: "u1", matches: 2 });
    expect(r.highlights.find((h) => h.label === "Longest match")!.detail).toBe("60 min");
    expect(r.highlights.find((h) => h.label === "Closest match")!.detail).toContain("3 games");
  });

  it("writes CSV with quoting and formula neutralising", () => {
    const csv = matchesToCsv([base({ team1_label: "=HYPERLINK(1)", team2_label: 'Ravi "R", Jr', winner_side: 2, umpired_by: "u" })], { u: "Ump" });
    const line = csv.split("\r\n")[1];
    expect(line).toContain("'=HYPERLINK(1)");
    expect(line).toContain('"Ravi ""R"", Jr"');
    expect(line.endsWith("Ump")).toBe(true);
  });
});
