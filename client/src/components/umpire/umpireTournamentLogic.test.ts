import { describe, expect, it } from "vitest";
import type { TournamentMatchForUmpire } from "./UmpireTournamentTab";
import {
  UMPIRE_ROOT,
  categoryProgress,
  compareUmpireQueue,
  directScorePreview,
  enrichUmpireMatches,
  filterUpcomingMatches,
  hasByeSide,
  orderRoundNames,
  parentNav,
  queueCourts,
  resolveUmpireStep,
  validateDirectScore,
  type UpcomingFilters,
} from "./umpireTournamentLogic";

let seq = 0;
const um = (o: Partial<TournamentMatchForUmpire> = {}): TournamentMatchForUmpire => {
  const n = ++seq;
  return {
    id: `m${n}`,
    tournament_id: "t1",
    tournament_name: "Club Open",
    category: "MS",
    match_code: `MS_R1_${String(n).padStart(2, "0")}`,
    round_name: "Round 1",
    round: 1,
    match_number: n,
    player1_id: null,
    player3_id: null,
    team1_label: `A${n}`,
    player2_id: null,
    player4_id: null,
    team2_label: `B${n}`,
    court_number: null,
    scheduled_at: null,
    status: "scheduled",
    locked: false,
    points_to_win: 21,
    best_of_sets: 3,
    golden_point: 30,
    ...o,
  };
};

const ALL: UpcomingFilters = { status: "ALL", search: "", format: "ALL", court: "ALL" };
const ids = (ms: { id: string }[]) => ms.map((m) => m.id);

describe("umpire drill-down navigation", () => {
  it("climbs confirm → its category → formats", () => {
    expect(parentNav({ step: "confirm", category: "MD", matchId: "m1" })).toEqual({ step: "match", category: "MD", matchId: null });
    expect(parentNav({ step: "confirm", category: null, matchId: "m1" })).toEqual(UMPIRE_ROOT);
    expect(parentNav({ step: "match", category: "MD", matchId: null })).toEqual(UMPIRE_ROOT);
    expect(parentNav(UMPIRE_ROOT)).toBeUndefined();
  });

  it("falls back to the parent view when a restored step has lost its match or category", () => {
    expect(resolveUmpireStep({ step: "confirm", category: "MS", matchId: "gone" }, false)).toBe("match");
    expect(resolveUmpireStep({ step: "confirm", category: null, matchId: "gone" }, false)).toBe("format");
    expect(resolveUmpireStep({ step: "match", category: null, matchId: null }, false)).toBe("format");
    expect(resolveUmpireStep({ step: "confirm", category: null, matchId: "m1" }, true)).toBe("confirm");
    expect(resolveUmpireStep({ step: "match", category: "MS", matchId: null }, false)).toBe("match");
  });
});

describe("compareUmpireQueue", () => {
  it("puts live matches first and finished ones last", () => {
    const done = um({ id: "done", status: "completed" });
    const wo = um({ id: "wo", status: "walkover" });
    const live = um({ id: "live", status: "in_progress", round: 3 });
    const next = um({ id: "next", status: "scheduled" });
    const waiting = um({ id: "waiting", status: "pending" });
    const sorted = [done, wo, next, live, waiting].sort(compareUmpireQueue);
    expect(sorted[0].id).toBe("live");
    expect(ids(sorted.slice(3)).sort()).toEqual(["done", "wo"]);
  });

  it("orders within a band by round, then match number (missing counts as 1)", () => {
    const a = um({ id: "r2m1", round: 2, match_number: 1 });
    const b = um({ id: "r1m3", round: 1, match_number: 3 });
    const c = um({ id: "r1m2", round: 1, match_number: 2 });
    const d = um({ id: "none", round: undefined, match_number: undefined });
    expect(ids([a, b, c, d].sort(compareUmpireQueue))).toEqual(["none", "r1m2", "r1m3", "r2m1"]);
  });
});

describe("enrichUmpireMatches", () => {
  const tournaments = [{ id: "t1", name: "Club Open" }];

  it("applies the round rule for the same tournament, category and round", () => {
    const rows = [
      { id: "sf", tournament_id: "t1", category: "MS", round: 3, points_to_win: 21, best_of_sets: 3, golden_point: 30 },
      { id: "qf", tournament_id: "t1", category: "MS", round: 2, points_to_win: 21, best_of_sets: 3, golden_point: 30 },
      { id: "wd", tournament_id: "t1", category: "WD", round: 3, points_to_win: 21, best_of_sets: 3, golden_point: 30 },
    ];
    const rules = [{ tournament_id: "t1", category: "MS", round: 3, points_to_win: 15, best_of_sets: 1, golden_point: 21 }];
    const [sf, qf, wd] = enrichUmpireMatches(rows, tournaments, rules);
    expect([sf.points_to_win, sf.best_of_sets, sf.golden_point]).toEqual([15, 1, 21]);
    expect([qf.points_to_win, qf.best_of_sets, qf.golden_point]).toEqual([21, 3, 30]);
    expect([wd.points_to_win, wd.best_of_sets, wd.golden_point]).toEqual([21, 3, 30]);
  });

  it("falls back to the match's own columns, then 21 / best of 3 / cap 30", () => {
    const [own, bare] = enrichUmpireMatches(
      [
        { id: "own", tournament_id: "t1", category: "MS", round: 1, points_to_win: 11, best_of_sets: 5, golden_point: 15 },
        { id: "bare", tournament_id: "t1", category: "MS", round: 1 },
      ],
      tournaments,
      null,
    );
    expect([own.points_to_win, own.best_of_sets, own.golden_point]).toEqual([11, 5, 15]);
    expect([bare.points_to_win, bare.best_of_sets, bare.golden_point]).toEqual([21, 3, 30]);
  });

  it("names the tournament, with a generic fallback", () => {
    const [known, unknown] = enrichUmpireMatches(
      [{ id: "a", tournament_id: "t1" }, { id: "b", tournament_id: "t9" }],
      tournaments,
      [],
    );
    expect(known.tournament_name).toBe("Club Open");
    expect(unknown.tournament_name).toBe("Tournament");
  });
});

describe("queue filters", () => {
  it("treats a BYE side as a bye in any case", () => {
    expect(hasByeSide({ team1_label: "BYE", team2_label: "Asha" })).toBe(true);
    expect(hasByeSide({ team1_label: "Asha", team2_label: "bye" })).toBe(true);
    expect(hasByeSide({ team1_label: "Asha", team2_label: null })).toBe(false);
    expect(hasByeSide({ team1_label: "Asha", team2_label: "Bina" })).toBe(false);
  });

  it("lists courts of real matches once, in natural order", () => {
    const ms = [
      um({ court_number: "10" }),
      um({ court_number: "2" }),
      um({ court_number: "2" }),
      um({ court_number: "1" }),
      um({ court_number: "7", team2_label: "BYE" }),
      um({ court_number: null }),
    ];
    expect(queueCourts(ms)).toEqual(["1", "2", "10"]);
  });

  it("drops byes and orders scheduled → live → finished, by time within a band", () => {
    const late = um({ id: "late", scheduled_at: "2026-11-22T11:00:00Z" });
    const early = um({ id: "early", scheduled_at: "2026-11-22T09:00:00Z" });
    const live = um({ id: "live", status: "in_progress" });
    const done = um({ id: "done", status: "completed" });
    const bye = um({ id: "bye", team1_label: "BYE" });
    expect(ids(filterUpcomingMatches([done, live, bye, late, early], ALL))).toEqual(["early", "late", "live", "done"]);
  });

  it("falls back to round then match number when a match has no time", () => {
    const r2 = um({ id: "r2", round: 2, match_number: 1 });
    const r1b = um({ id: "r1b", round: 1, match_number: 2 });
    const r1a = um({ id: "r1a", round: 1, match_number: 1, scheduled_at: "2026-11-22T12:00:00Z" });
    expect(ids(filterUpcomingMatches([r2, r1b, r1a], ALL))).toEqual(["r1a", "r1b", "r2"]);
  });

  it("filters by status", () => {
    const ms = [
      um({ id: "s", status: "scheduled" }),
      um({ id: "p", status: "pending" }),
      um({ id: "l", status: "in_progress" }),
      um({ id: "c", status: "completed" }),
      um({ id: "w", status: "walkover" }),
    ];
    expect(ids(filterUpcomingMatches(ms, { ...ALL, status: "upcoming" })).sort()).toEqual(["p", "s"]);
    expect(ids(filterUpcomingMatches(ms, { ...ALL, status: "live" }))).toEqual(["l"]);
    expect(ids(filterUpcomingMatches(ms, { ...ALL, status: "completed" })).sort()).toEqual(["c", "w"]);
  });

  it("searches names, match code and court, ignoring case and blank queries", () => {
    const ms = [
      um({ id: "name", team2_label: "Kriti Kalia & Deepak Kumar" }),
      um({ id: "code", match_code: "XD_QF_02" }),
      um({ id: "court", court_number: "C3" }),
      um({ id: "other" }),
    ];
    expect(ids(filterUpcomingMatches(ms, { ...ALL, search: "deepak" }))).toEqual(["name"]);
    expect(ids(filterUpcomingMatches(ms, { ...ALL, search: "xd_qf" }))).toEqual(["code"]);
    expect(ids(filterUpcomingMatches(ms, { ...ALL, search: "c3" }))).toEqual(["court"]);
    expect(filterUpcomingMatches(ms, { ...ALL, search: "   " })).toHaveLength(4);
  });

  it("narrows by format and court", () => {
    const ms = [
      um({ id: "ms2", category: "MS", court_number: "2" }),
      um({ id: "ms3", category: "MS", court_number: "3" }),
      um({ id: "xd2", category: "XD", court_number: "2" }),
    ];
    expect(ids(filterUpcomingMatches(ms, { ...ALL, format: "MS" })).sort()).toEqual(["ms2", "ms3"]);
    expect(ids(filterUpcomingMatches(ms, { ...ALL, court: "2" })).sort()).toEqual(["ms2", "xd2"]);
    expect(ids(filterUpcomingMatches(ms, { ...ALL, format: "MS", court: "2" }))).toEqual(["ms2"]);
  });

  it("does not reorder the caller's list", () => {
    const ms = [um({ id: "b", round: 2 }), um({ id: "a", round: 1 })];
    filterUpcomingMatches(ms, ALL);
    expect(ids(ms)).toEqual(["b", "a"]);
  });
});

describe("categoryProgress", () => {
  it("counts upcoming, live and done per category", () => {
    const ms = [
      um({ category: "MS", status: "scheduled" }),
      um({ category: "MS", status: "pending" }),
      um({ category: "MS", status: "in_progress" }),
      um({ category: "MS", status: "completed" }),
      um({ category: "MS", status: "walkover" }),
      um({ category: "WS", status: "scheduled" }),
    ];
    expect(categoryProgress(ms, "MS")).toEqual({ total: 5, upcoming: 2, inProgress: 1, done: 2, allDone: false });
  });

  it("is all done only when nothing is upcoming or live", () => {
    const ms = [um({ category: "XD", status: "completed" }), um({ category: "XD", status: "walkover" })];
    expect(categoryProgress(ms, "XD").allDone).toBe(true);
    expect(categoryProgress(ms, "WD").allDone).toBe(false);
  });
});

describe("orderRoundNames", () => {
  it("lists Final, then 3rd place, then the semifinals and earlier rounds", () => {
    const ms = [
      um({ round_name: "Quarter-final", round: 2 }),
      um({ round_name: "Semi-final", round: 3 }),
      um({ round_name: "Round of 16", round: 1 }),
      um({ round_name: "3rd Place Playoff", round: 3 }),
      um({ round_name: "Final", round: 4 }),
    ];
    expect(orderRoundNames(ms)).toEqual(["Final", "3rd Place Playoff", "Semi-final", "Quarter-final", "Round of 16"]);
  });

  it("keeps 3rd place after the Final when they share a round number", () => {
    const ms = [
      um({ round_name: "Semi-final", round: 1 }),
      um({ round_name: "3rd Place Playoff", round: 2 }),
      um({ round_name: "Final", round: 2 }),
    ];
    expect(orderRoundNames(ms)).toEqual(["Final", "3rd Place Playoff", "Semi-final"]);
  });

  it("lists each round once", () => {
    const ms = [um({ round_name: "Round 1", round: 1 }), um({ round_name: "Round 1", round: 1 }), um({ round_name: "Final", round: 2 })];
    expect(orderRoundNames(ms)).toEqual(["Final", "Round 1"]);
  });
});

describe("validateDirectScore", () => {
  const sets = (...pairs: [string, string][]) => pairs.map(([t1, t2]) => ({ t1, t2 }));

  it("gives a straight-games win to side 1", () => {
    expect(validateDirectScore(sets(["21", "15"], ["21", "18"], ["", ""]), 3)).toEqual({
      ok: true,
      winnerSide: 1,
      sets: ["21-15", "21-18"],
      score: "21-15, 21-18",
    });
  });

  it("gives a three-game win to side 2", () => {
    const r = validateDirectScore(sets(["21", "19"], ["17", "21"], ["25", "27"]), 3);
    expect(r).toMatchObject({ ok: true, winnerSide: 2, score: "21-19, 17-21, 25-27" });
  });

  it("normalises the numbers it stores", () => {
    const r = validateDirectScore(sets([" 21", "07"], ["21 ", "9"]), 3);
    expect(r).toMatchObject({ ok: true, sets: ["21-7", "21-9"] });
  });

  it("needs two sets, except in a best-of-1 (unknown counts as best of 3)", () => {
    expect(validateDirectScore(sets(["21", "10"], ["", ""]), 3)).toEqual({ ok: false, error: "Enter at least 2 sets" });
    expect(validateDirectScore(sets(["21", "10"]), null)).toEqual({ ok: false, error: "Enter at least 2 sets" });
    expect(validateDirectScore(sets(["30", "28"]), 1)).toMatchObject({ ok: true, winnerSide: 1, score: "30-28" });
    expect(validateDirectScore(sets(["", ""]), 1)).toEqual({ ok: false, error: "Enter at least 1 set" });
  });

  it("rejects a half-filled, non-numeric or negative set", () => {
    const error = "All scores must be valid non-negative numbers";
    expect(validateDirectScore(sets(["21", "10"], ["21", ""]), 3)).toEqual({ ok: false, error });
    expect(validateDirectScore(sets(["21", "10"], ["x", "5"]), 3)).toEqual({ ok: false, error });
    expect(validateDirectScore(sets(["21", "10"], ["-1", "21"]), 3)).toEqual({ ok: false, error });
  });

  it("refuses a result without a set majority", () => {
    expect(validateDirectScore(sets(["21", "10"], ["10", "21"]), 3)).toEqual({
      ok: false,
      error: "Scores must produce a winner — tied set count",
    });
  });

  it("refuses a tied set even when one side leads on sets", () => {
    expect(validateDirectScore(sets(["21", "10"], ["20", "20"]), 3)).toEqual({ ok: false, error: "A set cannot be tied" });
  });
});

describe("directScorePreview", () => {
  it("shows the leader once two complete, untied sets are in", () => {
    expect(directScorePreview([{ t1: "21", t2: "10" }, { t1: "", t2: "" }])).toMatchObject({ leader: 1, show: false });
    expect(directScorePreview([{ t1: "21", t2: "10" }, { t1: "15", t2: "21" }, { t1: "19", t2: "21" }])).toEqual({
      leader: 2,
      t1Wins: 1,
      t2Wins: 2,
      show: true,
    });
  });

  it("ignores half-filled and tied sets and shows nothing when level", () => {
    const p = directScorePreview([{ t1: "21", t2: "10" }, { t1: "21", t2: "" }, { t1: "20", t2: "20" }]);
    expect(p).toEqual({ leader: 1, t1Wins: 1, t2Wins: 0, show: false });
    expect(directScorePreview([{ t1: "21", t2: "10" }, { t1: "10", t2: "21" }]).show).toBe(false);
  });
});
