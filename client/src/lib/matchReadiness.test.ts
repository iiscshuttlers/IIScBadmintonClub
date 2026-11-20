import { describe, expect, it } from "vitest";
import {
  assessMatch,
  buildReadinessBoard,
  buildReadinessContext,
  courtBoard,
  freeCourts,
  hereSummary,
  matchTimeline,
  nextMatchFor,
  playerPresence,
  presenceLabel,
  rosterPlayerIds,
  spectatorLabel,
  suggestCourts,
  type CheckinRow,
  type CourtCallRow,
  type ReadinessMatch,
} from "@/lib/matchReadiness";
import { restEndsAt } from "@/lib/restConflicts";

const NOW = Date.parse("2026-11-20T11:00:00.000Z"); // 4:30 pm IST
const iso = (minsFromNow: number) => new Date(NOW + minsFromNow * 60_000).toISOString();

function match(id: string, overrides: Partial<ReadinessMatch> = {}): ReadinessMatch {
  return {
    id,
    status: "scheduled",
    match_code: id.toUpperCase(),
    category: "MS",
    round: 2,
    match_number: 1,
    scheduled_at: iso(0),
    started_at: null,
    ended_at: null,
    court_number: null,
    team1_label: "A",
    team2_label: "B",
    player1_id: "a",
    player2_id: "b",
    player3_id: null,
    player4_id: null,
    ...overrides,
  };
}

function here(player: string, overrides: Partial<CheckinRow> = {}): CheckinRow {
  return {
    tournament_id: "t",
    player_id: player,
    state: "here",
    checked_in_at: iso(-20),
    here_since: iso(-20),
    break_until: null,
    break_started_at: null,
    checked_in_by: player,
    expires_at: iso(200),
    ...overrides,
  };
}

describe("matchReadiness", () => {
  it("is ready when both players are here, rested and free", () => {
    const m = match("ms_r2_03");
    const ctx = buildReadinessContext([m], [here("a"), here("b", { checked_in_at: iso(-5), here_since: iso(-5) })], { now: NOW });
    const r = assessMatch(ctx, m);
    expect(r.state).toBe("ready");
    expect(r.allHere).toBe(true);
    expect(hereSummary(r)).toBe("All here");
    // Ready since the later check-in.
    expect(r.readySince).toBe(NOW - 5 * 60_000);
  });

  it("waits for a player who hasn't checked in, and lets them be called", () => {
    const m = match("m");
    const r = assessMatch(buildReadinessContext([m], [here("a")], { now: NOW }), m);
    expect(r.state).toBe("waiting");
    expect(r.missing).toEqual(["b"]);
    expect(r.callable).toEqual(["b"]);
    expect(hereSummary(r)).toBe("1 of 2 here");
  });

  it("ignores expired check-ins even before the job removes them", () => {
    const m = match("m");
    const ctx = buildReadinessContext([m], [here("a"), here("b", { expires_at: iso(-1) })], { now: NOW });
    expect(playerPresence(ctx, "b").kind).toBe("not_here");
    expect(assessMatch(ctx, m).state).toBe("waiting");
  });

  it("treats a break as not here, and an ended timed break as here again", () => {
    const m = match("m");
    const onBreak = buildReadinessContext([m], [here("a"), here("b", { state: "break", break_until: iso(10), break_started_at: iso(-5) })], { now: NOW });
    expect(assessMatch(onBreak, m).state).toBe("waiting");
    expect(presenceLabel(playerPresence(onBreak, "b"))).toMatch(/^On a break · back /);
    // A declared break isn't "missing" for "Call missing"; organisers can still call them one by one.
    expect(assessMatch(onBreak, m).callable).toEqual([]);

    const open = buildReadinessContext([m], [here("a"), here("b", { state: "break", break_until: null, break_started_at: iso(-5) })], { now: NOW });
    expect(presenceLabel(playerPresence(open, "b"))).toMatch(/^On a break · since /);

    const ended = buildReadinessContext([m], [here("a"), here("b", { state: "break", break_until: iso(-1) })], { now: NOW });
    expect(playerPresence(ended, "b")).toEqual({ kind: "here", since: iso(-1) });
    expect(assessMatch(ended, m).state).toBe("ready");
  });

  it("shows a player live on another court as on court, not callable", () => {
    const m = match("md_qf_02", { player1_id: "a", player3_id: "c", player2_id: "b", player4_id: "d" });
    const live = match("ms_r2_01", { status: "in_progress", player1_id: "b", player2_id: "x", court_number: "3" });
    const ctx = buildReadinessContext([m, live], [here("a"), here("b"), here("c"), here("d")], { now: NOW });
    const r = assessMatch(ctx, m);
    expect(r.state).toBe("waiting");
    expect(r.allHere).toBe(false);
    expect(hereSummary(r)).toBe("3 of 4 here");
    expect(r.callable).toEqual([]);
    expect(presenceLabel(playerPresence(ctx, "b", m.id))).toBe("On court · MS_R2_01 · C3");
    // On their own live match they're not "elsewhere".
    expect(playerPresence(ctx, "b", live.id).kind).toBe("here");
  });

  it("holds a match while a player rests, using the tournament's rest time", () => {
    const done = match("r1", { status: "completed", ended_at: iso(-10), player1_id: "a", player2_id: "z" });
    const m = match("r2");
    const ctx = buildReadinessContext([done, m], [here("a"), here("b")], { now: NOW, minRestMinutes: 15 });
    const r = assessMatch(ctx, m);
    expect(r.state).toBe("resting");
    expect(r.allHere).toBe(true); // spectators: both sides here
    expect(r.restOkAt).toBe(NOW + 5 * 60_000);
    expect(restEndsAt("a", [done], 15)).toBe(NOW + 5 * 60_000);

    const later = buildReadinessContext([done, m], [here("a"), here("b")], { now: NOW + 6 * 60_000, minRestMinutes: 15 });
    const ready = assessMatch(later, m);
    expect(ready.state).toBe("ready");
    expect(ready.readySince).toBe(NOW + 5 * 60_000);
  });

  it("skips matches that can't be called yet: TBD, byes, live and finished", () => {
    const ctx = buildReadinessContext([], [here("a"), here("b")], { now: NOW });
    expect(assessMatch(ctx, match("m", { player2_id: null })).state).toBe("not_applicable");
    expect(assessMatch(ctx, match("m", { team2_label: "BYE" })).state).toBe("not_applicable");
    expect(assessMatch(ctx, match("m", { team2_label: "TBD" })).state).toBe("not_applicable");
    expect(assessMatch(ctx, match("m", { status: "in_progress" })).state).toBe("not_applicable");
    expect(assessMatch(ctx, match("m", { status: "walkover" })).state).toBe("not_applicable");
  });

  it("orders the ready list like the court queue", () => {
    const later = match("late", { scheduled_at: iso(30), player1_id: "a", player2_id: "b" });
    const r1 = match("r1", { scheduled_at: null, round: 1, player1_id: "c", player2_id: "d" });
    const early = match("early", { scheduled_at: iso(-10), player1_id: "e", player2_id: "f" });
    const ctx = buildReadinessContext([later, r1, early], ["a", "b", "c", "d", "e", "f"].map((p) => here(p)), { now: NOW });
    const board = buildReadinessBoard(ctx);
    expect(board.ready.map((m) => m.id)).toEqual(["early", "late", "r1"]);
    expect(Object.keys(board.byMatch)).toHaveLength(3);
  });

  it("finds free courts: scheduled courts minus live and just-called ones", () => {
    const matches = [
      match("live", { status: "in_progress", court_number: "3" }),
      match("called", { court_number: "6" }),
      match("old-call", { court_number: "2" }),
      match("waiting", { court_number: "1" }),
      match("ten", { court_number: "10", status: "completed" }),
    ];
    const calls: CourtCallRow[] = [
      { id: "c1", match_id: "called", called_at: iso(-3) },
      { id: "c2", match_id: "old-call", called_at: iso(-40) },
    ];
    const board = courtBoard(matches, calls, NOW);
    expect(board.map((c) => `${c.court}:${c.kind}`)).toEqual(["1:free", "2:free", "3:live", "6:called", "10:free"]);
    expect(freeCourts(board)).toEqual(["1", "2", "10"]);
  });

  it("suggests a match's own free court first, then the next free one", () => {
    const a = match("a", { court_number: "2" });
    const b = match("b");
    const c = match("c");
    expect(suggestCourts([a, b, c], ["1", "2"])).toEqual({ a: "2", b: "1", c: null });
  });

  it("finds a player's next match and the roster", () => {
    const m1 = match("m1", { scheduled_at: iso(60) });
    const m2 = match("m2", { scheduled_at: iso(10), player1_id: "a", player2_id: "c" });
    const done = match("m0", { status: "completed", player1_id: "a", player2_id: "q" });
    expect(nextMatchFor([m1, m2, done], "a")?.id).toBe("m2");
    expect(rosterPlayerIds([m1, m2, done]).sort()).toEqual(["a", "b", "c"]);
  });

  it("builds a timeline of check-ins, readiness and calls", () => {
    const m = match("xd", { court_number: "1" });
    const ctx = buildReadinessContext([m], [here("a", { checked_in_at: iso(-30), here_since: iso(-30) }), here("b", { checked_in_at: iso(-20), here_since: iso(-20) })], { now: NOW });
    const events = matchTimeline(ctx, m, [
      { id: "c", match_id: "xd", called_at: iso(-2), player_ids: null },
      { id: "d", match_id: "other", called_at: iso(-1) },
    ]);
    expect(events.map((e) => e.kind)).toEqual(["checked_in", "checked_in", "ready", "called"]);
    expect(events[3]).toMatchObject({ everyone: true, court: "1" });
  });

  it("tells spectators only a flag", () => {
    expect(spectatorLabel(true)).toBe("Both sides here");
    expect(spectatorLabel(false)).toBe("Waiting for players");
  });

  it("survives a poisoned (non-array) check-in cache", () => {
    const ctx = buildReadinessContext([match("m")], {} as unknown as CheckinRow[], { now: NOW });
    expect(ctx.checkins.size).toBe(0);
  });
});
