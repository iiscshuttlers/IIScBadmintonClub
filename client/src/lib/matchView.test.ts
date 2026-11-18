import { describe, expect, it } from "vitest";
import {
  buildCourtQueues,
  buildSeedIndex,
  bucketOf,
  compareCompleted,
  disciplineOf,
  filterMatches,
  matchOutcome,
  matchDay,
  parseGames,
  toMatchView,
  type MatchRow,
} from "./matchView";
import { computeQueueAlerts, type QueueMatch } from "../../../supabase/functions/_shared/courtQueue";

let n = 0;
const row = (over: Partial<MatchRow> = {}): MatchRow => ({
  id: `m${++n}`,
  tournament_id: "t1",
  category: "MS",
  match_code: null,
  round: 1,
  round_name: "Quarterfinal",
  match_number: n,
  team1_label: "Asha",
  team2_label: "Bala",
  player1_id: `p${n}a`,
  player2_id: `p${n}b`,
  player3_id: null,
  player4_id: null,
  court_number: null,
  status: "scheduled",
  score: null,
  sets_history: null,
  scheduled_at: null,
  started_at: null,
  ended_at: null,
  winner_side: null,
  advances_to_match: null,
  rubber_label: null,
  tie_id: null,
  ...over,
});

describe("disciplineOf", () => {
  it("recognises all five disciplines, including XD from several spellings", () => {
    expect(disciplineOf("XD")).toBe("XD");
    expect(disciplineOf("Mixed Doubles")).toBe("XD");
    expect(disciplineOf("Women's Doubles")).toBe("WD");
    expect(disciplineOf("Men's Singles")).toBe("MS");
    expect(disciplineOf("Open", "WS_QF_01")).toBe("WS");
    expect(disciplineOf("Rubber 3")).toBeNull();
  });
});

describe("parseGames", () => {
  it("prefers sets_history", () => {
    expect(parseGames(["21-13", "19-21", "21-18"], "ignored")).toEqual([
      { side1: 21, side2: 13 },
      { side1: 19, side2: 21 },
      { side1: 21, side2: 18 },
    ]);
  });
  it("falls back to the score text", () => {
    expect(parseGames(null, "21-13, 21-11")).toEqual([
      { side1: 21, side2: 13 },
      { side1: 21, side2: 11 },
    ]);
  });
  it("returns nothing for unparseable text rather than guessing", () => {
    expect(parseGames(null, "W/O")).toEqual([]);
    expect(parseGames([], null)).toEqual([]);
  });
});

describe("toMatchView status", () => {
  it("never infers completion from a score", () => {
    const v = toMatchView(row({ status: "scheduled", score: "21-10, 21-12", winner_side: 1 }));
    expect(v.state).toBe("unscheduled");
    expect(v.sides[0].isWinner).toBe(false);
  });

  it.each([
    ["in_progress", "live", "Live"],
    ["completed", "completed", "Completed"],
    ["walkover", "walkover", "Walkover"],
    ["cancelled", "cancelled", "Cancelled"],
    ["pending", "unscheduled", "Not yet scheduled"],
  ])("%s → %s", (status, state, label) => {
    const v = toMatchView(row({ status }));
    expect(v.state).toBe(state);
    expect(v.statusLabel).toBe(label);
  });

  it("marks winner only for decided matches, including walkovers", () => {
    const v = toMatchView(row({ status: "walkover", winner_side: 2 }));
    expect(v.sides[1].isWinner).toBe(true);
    expect(v.sides[0].isWinner).toBe(false);
  });

  it("flags TBD and BYE sides", () => {
    const v = toMatchView(row({ team1_label: null, team2_label: "BYE" }));
    expect(v.sides[0].isTbd).toBe(true);
    expect(v.sides[0].label).toBe("To be decided");
    expect(v.sides[1].isBye).toBe(true);
  });

  it("keeps unparseable scores as text", () => {
    expect(toMatchView(row({ status: "completed", score: "Retd. 21-15, 8-3 ret" })).scoreText).toBe("Retd. 21-15, 8-3 ret");
  });
});

describe("seeds", () => {
  it("finds a doubles pair seed through either partner, scoped to the discipline", () => {
    const seeds = buildSeedIndex([
      { category: "XD", player_id: "a", partner_id: "b", seed: 1 },
      { category: "MD", player_id: "a", partner_id: "c", seed: 4 },
    ]);
    const xd = toMatchView(row({ category: "XD", player1_id: "x", player3_id: "b" }), seeds);
    expect(xd.sides[0].seed).toBe(1);
    const md = toMatchView(row({ category: "MD", player1_id: "a" }), seeds);
    expect(md.sides[0].seed).toBe(4);
    expect(md.sides[1].seed).toBeNull();
  });
});

describe("filters and buckets", () => {
  const views = [
    toMatchView(row({ category: "XD", court_number: "C1", status: "in_progress", started_at: "2026-11-14T04:30:00Z" })),
    toMatchView(row({ category: "MS", court_number: "C2", scheduled_at: "2026-11-14T05:00:00Z" })),
    toMatchView(row({ category: "XD", status: "completed", ended_at: "2026-11-13T10:00:00Z" })),
  ];

  it("filters by discipline, court and day", () => {
    expect(filterMatches(views, { discipline: "XD" })).toHaveLength(2);
    expect(filterMatches(views, { court: "C2" })).toHaveLength(1);
    expect(filterMatches(views, { date: matchDay(views[2]) })).toHaveLength(1);
  });

  it("buckets by status", () => {
    expect(views.map(bucketOf)).toEqual(["live", "upcoming", "completed"]);
  });

  it("orders completed by actual end, newest first", () => {
    const a = toMatchView(row({ status: "completed", ended_at: "2026-11-13T09:00:00Z" }));
    const b = toMatchView(row({ status: "completed", ended_at: "2026-11-13T11:00:00Z" }));
    expect([a, b].sort(compareCompleted).map((v) => v.id)).toEqual([b.id, a.id]);
  });
});

describe("buildCourtQueues", () => {
  it("separates playing, next and following without moving anything", () => {
    const rows = [
      row({ court_number: "C1", scheduled_at: "2026-11-14T06:00:00Z" }),
      row({ court_number: "C1", status: "in_progress", scheduled_at: "2026-11-14T05:00:00Z" }),
      row({ court_number: "C1", scheduled_at: "2026-11-14T05:30:00Z" }),
      row({ court_number: "C1" }), // court assigned, no time → last
      row({ court_number: "C1", status: "completed" }), // not queued
      row({ court_number: null, scheduled_at: "2026-11-14T05:10:00Z" }), // no court → not queued
    ];
    const [q] = buildCourtQueues(rows.map((r) => toMatchView(r)));
    expect(q.court).toBe("C1");
    expect(q.playing.map((v) => v.id)).toEqual([rows[1].id]);
    expect(q.next?.id).toBe(rows[2].id);
    expect(q.following.map((v) => v.id)).toEqual([rows[0].id, rows[3].id]);
  });

  it("agrees with the push-alert queue order (courtQueue.ts)", () => {
    const rows = [
      row({ court_number: "2", status: "in_progress", player1_id: "l1", player2_id: "l2" }),
      row({ court_number: "2", scheduled_at: "2026-11-14T07:00:00Z", round: 2, player1_id: "a1", player2_id: "a2" }),
      row({ court_number: "2", scheduled_at: "2026-11-14T06:00:00Z", round: 3, player1_id: "b1", player2_id: "b2" }),
      row({ court_number: "2", scheduled_at: null, round: 1, player1_id: "c1", player2_id: "c2" }),
    ];
    const [q] = buildCourtQueues(rows.map((r) => toMatchView(r)));
    const alerts = computeQueueAlerts(rows as unknown as QueueMatch[]);
    const byPos = alerts.sort((a, b) => a.position - b.position).map((a) => a.match.id);
    expect([q.next?.id, q.following[0]?.id]).toEqual(byPos);
  });
});

describe("matchOutcome", () => {
  it("marks walkover winners and labels the state in words", () => {
    const o = matchOutcome({ status: "walkover", winner_side: 2, score: null, sets_history: null });
    expect(o).toMatchObject({ state: "walkover", statusLabel: "Walkover", decided: true, t1Won: false, t2Won: true, games: [] });
  });
  it("never marks a winner on a live match even if winner_side is set", () => {
    const o = matchOutcome({ status: "in_progress", winner_side: 1, sets_history: ["21-10"] });
    expect(o.t1Won).toBe(false);
    expect(o.statusLabel).toBe("Live");
  });
  it("parses en-dash game scores that a plain split('-') would drop", () => {
    const o = matchOutcome({ status: "completed", winner_side: 1, sets_history: ["21–13", "21–11"] });
    expect(o.games).toEqual([{ side1: 21, side2: 13 }, { side1: 21, side2: 11 }]);
  });
  it("keeps unparseable score text verbatim", () => {
    const o = matchOutcome({ status: "completed", winner_side: 1, score: "21-13, retired" });
    expect(o.games).toEqual([]);
    expect(o.scoreText).toBe("21-13, retired");
  });
  it("distinguishes unscheduled from scheduled", () => {
    expect(matchOutcome({ status: "pending" }).state).toBe("unscheduled");
    expect(matchOutcome({ status: "pending", court_number: "C2" }).state).toBe("scheduled");
  });
});
