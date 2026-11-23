import { describe, expect, it } from "vitest";
import type { TournamentMatchForUmpire } from "@/components/umpire/UmpireTournamentTab";
import type { BwfMatchState, MatchEditState } from "@/types/umpire";
import { computeAddPoint } from "./umpireMutations";
import {
  buildInitialUmpireMatch,
  deleteSetUpdates,
  editModeSets,
  isByeLabel,
  pointFeedback,
  reopenSetUpdates,
  savedWinnerSide,
  scoreAlertMessage,
  serveInfo,
  splitTeamLabel,
  startErrorToast,
  startingRightCourts,
  undoLastSetUpdates,
} from "./umpireStateLogic";

const newId = () => "new-id";

const tm = (o: Partial<TournamentMatchForUmpire> = {}): TournamentMatchForUmpire => ({
  id: "tm1",
  tournament_id: "t1",
  tournament_name: "Club Open",
  category: "XD",
  match_code: "XD_QF_01",
  round_name: "Quarter-final",
  player1_id: "p1",
  player3_id: "p3",
  team1_label: "Kriti Kalia & Deepak Kumar",
  player2_id: "p2",
  player4_id: null,
  team2_label: "Asha Rao & Vikram Iyer",
  court_number: "2",
  scheduled_at: null,
  status: "scheduled",
  locked: false,
  points_to_win: 21,
  best_of_sets: 3,
  golden_point: 30,
  ...o,
});

const playing = (o: Partial<BwfMatchState> = {}): BwfMatchState => ({
  id: "m1",
  umpireId: "u1",
  umpireName: "Umpire",
  isFriendly: false,
  category: "Doubles",
  pointsToWin: 21,
  bestOfSets: 3,
  goldenPoint: 30,
  t1: { p1Id: "a", p1Name: "Asha", p2Name: "Bina", score: 0, games: 0 },
  t2: { p1Id: "c", p1Name: "Chitra", p2Name: "Deepa", score: 0, games: 0 },
  serverTeam: 1,
  serverPlayerIndex: 0,
  receiverPlayerIndex: 0,
  t1LastServedBy: 0,
  t2LastServedBy: 0,
  endsSwapped: false,
  pointLog: [],
  status: "playing",
  setsHistory: [],
  ...o,
});

describe("isByeLabel", () => {
  it("is true only for a label that reads BYE as a whole", () => {
    expect(isByeLabel("BYE")).toBe(true);
    expect(isByeLabel("bye")).toBe(true);
    expect(isByeLabel("  Bye ")).toBe(true);
    expect(isByeLabel("Abbye Thomas")).toBe(false);
    expect(isByeLabel("Byers")).toBe(false);
    expect(isByeLabel("BYE BYE")).toBe(false);
    expect(isByeLabel("")).toBe(false);
    expect(isByeLabel(null)).toBe(false);
    expect(isByeLabel(undefined)).toBe(false);
  });
});

describe("splitTeamLabel", () => {
  it("splits a pair on & or a comma", () => {
    expect(splitTeamLabel("Kriti Kalia & Deepak Kumar")).toEqual(["Kriti Kalia", "Deepak Kumar"]);
    expect(splitTeamLabel("Kriti Kalia,Deepak Kumar")).toEqual(["Kriti Kalia", "Deepak Kumar"]);
  });

  it("returns a single name and blanks for nothing", () => {
    expect(splitTeamLabel("Asha Rao")).toEqual(["Asha Rao", ""]);
    expect(splitTeamLabel(null)).toEqual(["", ""]);
    expect(splitTeamLabel(" & ")).toEqual(["", ""]);
  });
});

describe("buildInitialUmpireMatch: tournament pre-fill", () => {
  it("fills both pairs from the bracket labels and the round's rules", () => {
    const m = buildInitialUmpireMatch({ tournamentMatch: tm({ points_to_win: 15, best_of_sets: 1, golden_point: 21 }), userId: "u1", userName: "Ump", newId });
    expect(m).toMatchObject({
      id: "tm1",
      isFriendly: false,
      isTournamentMatch: true,
      tournamentId: "t1",
      matchNumber: "XD_QF_01",
      category: "Doubles",
      pointsToWin: 15,
      bestOfSets: 1,
      goldenPoint: 21,
      status: "setup",
      setsHistory: [],
    });
    expect(m.t1).toEqual({ p1Id: "p1", p1Name: "Kriti Kalia", p2Id: "p3", p2Name: "Deepak Kumar", score: 0, games: 0 });
    // A partner known only by name still shows as the second player.
    expect(m.t2).toEqual({ p1Id: "p2", p1Name: "Asha Rao", p2Id: undefined, p2Name: "Vikram Iyer", score: 0, games: 0 });
    expect(m.winner).toBeUndefined();
  });

  it("keeps singles names whole and treats unknown categories as singles", () => {
    const ms = buildInitialUmpireMatch({
      tournamentMatch: tm({ category: "MS", team1_label: "Asha Rao", team2_label: "Bina Das", player3_id: null }),
      userId: "u1", userName: "Ump", newId,
    });
    expect(ms.category).toBe("Singles");
    expect([ms.t1.p1Name, ms.t1.p2Name, ms.t2.p1Name, ms.t2.p2Name]).toEqual(["Asha Rao", "", "Bina Das", ""]);

    const odd = buildInitialUmpireMatch({ tournamentMatch: tm({ category: "BS" }), userId: "u1", userName: "Ump", newId });
    expect(odd.category).toBe("Singles");
    expect(odd.t1.p2Name).toBe("");
  });

  it("finishes a bye at once, with the real side as the winner", () => {
    const t1Bye = buildInitialUmpireMatch({ tournamentMatch: tm({ team1_label: "BYE" }), userId: "u1", userName: "Ump", newId });
    expect(t1Bye).toMatchObject({ status: "finished", winner: 2, setsHistory: ["BYE"] });
    expect([t1Bye.t1.games, t1Bye.t2.games]).toEqual([0, 2]);

    const t2Bye = buildInitialUmpireMatch({ tournamentMatch: tm({ team2_label: "bye" }), userId: "u1", userName: "Ump", newId });
    expect(t2Bye).toMatchObject({ status: "finished", winner: 1 });
    expect([t2Bye.t1.games, t2Bye.t2.games]).toEqual([2, 0]);

    const spaced = buildInitialUmpireMatch({ tournamentMatch: tm({ team2_label: " Bye " }), userId: "u1", userName: "Ump", newId });
    expect(spaced).toMatchObject({ status: "finished", winner: 1 });
  });

  it("starts a real match for players whose names contain 'bye'", () => {
    const pairs: [string, string][] = [["Abbye Thomas", "Asha Rao"], ["Asha Rao", "Byers"], ["Abbye Thomas & Ravi Byers", "Asha Rao & Bina Das"]];
    for (const [team1_label, team2_label] of pairs) {
      const m = buildInitialUmpireMatch({ tournamentMatch: tm({ team1_label, team2_label }), userId: "u1", userName: "Ump", newId });
      expect(m).toMatchObject({ status: "setup", setsHistory: [] });
      expect(m.winner).toBeUndefined();
      expect([m.t1.games, m.t2.games]).toEqual([0, 0]);
    }
  });

  it("falls back to Team 1 / Team 2 and blank ids when the bracket has no names yet", () => {
    const m = buildInitialUmpireMatch({
      tournamentMatch: tm({ team1_label: null, team2_label: null, player1_id: null, player2_id: null, player3_id: null, id: "" }),
      userId: "u1", userName: "Ump", newId,
    });
    expect(m.id).toBe("new-id");
    expect([m.t1.p1Id, m.t1.p1Name, m.t2.p1Id, m.t2.p1Name]).toEqual(["", "Team 1", "", "Team 2"]);
  });
});

describe("buildInitialUmpireMatch: edit mode and resume", () => {
  const edit = (o: Partial<MatchEditState> = {}): MatchEditState => ({
    is_edit_mode: true,
    id: "db1",
    player1_id: "p1",
    player2_id: "p2",
    team1_label: "Asha & Bina",
    team2_label: "Chitra & Deepa",
    ...o,
  });

  it("rebuilds a finished match from its stored games and names the winner", () => {
    const m = buildInitialUmpireMatch({
      initialMatchState: edit({ sets_history: ["21-15", "18-21", "21-19"], is_tournament_match: true, is_friendly: false }),
      userId: "u1", userName: "Ump", newId,
    });
    expect(m).toMatchObject({ id: "db1", dbId: "db1", status: "finished", winner: 1, isFriendly: false, isTournamentMatch: true });
    expect([m.t1.games, m.t2.games]).toEqual([2, 1]);
    expect([m.t1.p1Name, m.t1.p2Name, m.t2.p1Name, m.t2.p2Name]).toEqual(["Asha", "Bina", "Chitra", "Deepa"]);
  });

  it("edits a match under its own scoring rules, not a fixed 21 × 3", () => {
    const m = buildInitialUmpireMatch({
      initialMatchState: edit({ sets_history: ["15-9"], best_of_sets: 1, points_to_win: 15, golden_point: 21 }),
      userId: "u1", userName: "Ump", newId,
    });
    expect([m.pointsToWin, m.bestOfSets, m.goldenPoint]).toEqual([15, 1, 21]);

    const plain = buildInitialUmpireMatch({ initialMatchState: edit({ sets_history: ["21-15"] }), userId: "u1", userName: "Ump", newId });
    expect([plain.pointsToWin, plain.bestOfSets, plain.goldenPoint]).toEqual([21, 3, 30]);
  });

  it("parses the display score when sets_history is missing", () => {
    expect(editModeSets({ sets_history: null, score: "15-21, 19-21 (W/O)" })).toEqual(["15-21", "19-21"]);
    expect(editModeSets({ sets_history: [], match_score: "21-10" })).toEqual(["21-10"]);
    expect(editModeSets({ score: "Walkover" })).toEqual([]);

    const m = buildInitialUmpireMatch({ initialMatchState: edit({ score: "15-21, 19-21" }), userId: "u1", userName: "Ump", newId });
    expect(m.winner).toBe(2);
  });

  it("leaves the winner unset when the stored games are level", () => {
    const m = buildInitialUmpireMatch({ initialMatchState: edit({ sets_history: ["21-15", "15-21"] }), userId: "u1", userName: "Ump", newId });
    expect(m.winner).toBeUndefined();
    // ...so there is no side to save it for.
    expect(savedWinnerSide(m)).toBeNull();
  });

  it("prefers linked player names over the label", () => {
    const m = buildInitialUmpireMatch({
      initialMatchState: edit({ player1: { full_name: "Asha Rao" }, partner2: { full_name: "Deepa Nair" } }),
      userId: "u1", userName: "Ump", newId,
    });
    expect(m.t1.p1Name).toBe("Asha Rao");
    expect(m.t2.p2Name).toBe("Deepa Nair");
  });

  it("resumes a live match under its own broadcast id", () => {
    const live = playing({ id: "live-key", umpireId: "", umpireName: "", t1: { p1Id: "a", p1Name: "Asha", score: 7, games: 1 } });
    const m = buildInitialUmpireMatch({ initialMatchState: live, tournamentMatch: tm(), userId: "u2", userName: "New Umpire", newId });
    expect(m).toMatchObject({ id: "live-key", umpireId: "u2", umpireName: "New Umpire", status: "playing" });
    expect(m.t1.score).toBe(7);
  });

  it("starts a blank friendly when there is nothing to load", () => {
    const m = buildInitialUmpireMatch({ userId: "u1", userName: "Ump", newId });
    expect(m).toMatchObject({ id: "new-id", isFriendly: true, status: "setup", category: "Singles", pointsToWin: 21, bestOfSets: 3, goldenPoint: 30 });
  });
});

describe("startingRightCourts", () => {
  it("puts the server and the chosen receiver in their right courts", () => {
    expect(startingRightCourts({ serverTeam: 1, serverPlayerIndex: 1, receiverPlayerIndex: 0 })).toEqual({ t1RightCourt: 1, t2RightCourt: 0 });
    expect(startingRightCourts({ serverTeam: 2, serverPlayerIndex: 0, receiverPlayerIndex: 1 })).toEqual({ t1RightCourt: 1, t2RightCourt: 0 });
  });
});

describe("set history edits", () => {
  const twoGamesIn = playing({
    setsHistory: ["21-15", "19-21"],
    t1: { p1Id: "a", p1Name: "Asha", score: 4, games: 1 },
    t2: { p1Id: "c", p1Name: "Chitra", score: 6, games: 1 },
  });

  it("undoes the last game back to its final score", () => {
    expect(undoLastSetUpdates(twoGamesIn)).toMatchObject({
      status: "playing",
      winner: undefined,
      setsHistory: ["21-15"],
      t1: { score: 19, games: 1 },
      t2: { score: 21, games: 0 },
    });
    expect(undoLastSetUpdates(playing())).toBeNull();
  });

  it("re-opens a finished match when its last game is undone", () => {
    const finished = playing({
      status: "finished",
      winner: 1,
      retiredTeam: undefined,
      setsHistory: ["21-15", "21-18"],
      t1: { p1Id: "a", p1Name: "Asha", score: 0, games: 2 },
    });
    expect(undoLastSetUpdates(finished)).toMatchObject({ status: "playing", winner: undefined, t1: { score: 21, games: 1 }, t2: { score: 18 } });
  });

  it("deletes a game without touching the current score", () => {
    expect(deleteSetUpdates(twoGamesIn, 0)).toMatchObject({
      setsHistory: ["19-21"],
      t1: { score: 4, games: 0 },
      t2: { score: 6, games: 1 },
      status: "playing",
    });
    expect(deleteSetUpdates(twoGamesIn, 2)).toBeNull();
    expect(deleteSetUpdates(twoGamesIn, -1)).toBeNull();
  });

  it("never lets games won go below zero", () => {
    const odd = playing({ setsHistory: ["21-15"], t1: { p1Id: "a", p1Name: "Asha", score: 0, games: 0 } });
    expect(undoLastSetUpdates(odd)?.t1).toMatchObject({ games: 0 });
  });

  it("reopens a game, drops the later ones and recounts games won", () => {
    const three = playing({
      status: "finished",
      winner: 2,
      setsHistory: ["21-15", "19-21", "17-21"],
      t1: { p1Id: "a", p1Name: "Asha", score: 0, games: 1 },
      t2: { p1Id: "c", p1Name: "Chitra", score: 0, games: 2 },
    });
    expect(reopenSetUpdates(three, 1)).toMatchObject({
      status: "playing",
      winner: undefined,
      setsHistory: ["21-15"],
      t1: { score: 19, games: 1 },
      t2: { score: 21, games: 0 },
    });
    expect(reopenSetUpdates(three, 3)).toBeNull();
  });
});

describe("pointFeedback and scoreAlertMessage", () => {
  const at = (s1: number, s2: number, o: Partial<BwfMatchState> = {}) =>
    playing({ t1: { p1Id: "a", p1Name: "Asha", p2Name: "Bina", score: s1, games: 0 }, t2: { p1Id: "c", p1Name: "Chitra", score: s2, games: 0 }, ...o });

  it("plays the match-won effect when the match ends", () => {
    expect(pointFeedback(at(20, 10), { status: "finished", winner: 1 })).toBe("matchWon");
  });

  it("marks the first side to reach the interval and a game won as milestones", () => {
    const m = at(10, 8);
    expect(pointFeedback(m, { t1: { ...m.t1, score: 11 } })).toBe("milestone");
    expect(pointFeedback(m, { t1: { ...m.t1, score: 0, games: 1 }, t2: { ...m.t2, score: 0 } })).toBe("milestone");
    expect(pointFeedback(at(5, 3), { t1: { ...at(5, 3).t1, score: 6 } })).toBe("point");
  });

  it("does not replay the interval once a side is past it", () => {
    const m = at(11, 10);
    expect(pointFeedback(m, { t2: { ...m.t2, score: 11 } })).toBe("point");
    expect(scoreAlertMessage(m, { t2: { ...m.t2, score: 11 } })).toBeNull();
  });

  it("uses the event's game length for the interval (8 in a 15-point game)", () => {
    const m = at(7, 3, { pointsToWin: 15 });
    expect(pointFeedback(m, { t1: { ...m.t1, score: 8 } })).toBe("milestone");
  });

  it("announces the interval with both pairs and the score", () => {
    const m = at(10, 8);
    expect(scoreAlertMessage(m, { t1: { ...m.t1, score: 11 } }))
      .toBe("🏆 Doubles Match: Half-time interval! Asha & Bina [11 - 8] Chitra");
  });

  it("announces the side that won a game", () => {
    const m = at(19, 20);
    const msg = scoreAlertMessage(m, { t1: { ...m.t1, score: 0 }, t2: { ...m.t2, score: 0, games: 1 } });
    expect(msg).toContain("Set won by Chitra!");
    expect(scoreAlertMessage(at(3, 2), { t1: { ...at(3, 2).t1, score: 4 } })).toBeNull();
  });

  it("shows the finished game's score, not the 0-0 of the next game", () => {
    // Without the game in the update, the score is the one before the rally plus the winning point.
    const m = at(19, 20);
    expect(scoreAlertMessage(m, { t1: { ...m.t1, score: 0 }, t2: { ...m.t2, score: 0, games: 1 } }))
      .toBe("🏆 Doubles Match: Set won by Chitra! Asha & Bina [19 - 21] Chitra");

    // The real update from a game-winning rally resets the scores before the alert is built.
    const atGamePoint = at(20, 18, { setsHistory: [] });
    const updates = computeAddPoint(atGamePoint, 1)!;
    expect([updates.t1?.score, updates.t2?.score]).toEqual([0, 0]);
    expect(scoreAlertMessage(atGamePoint, updates)).toBe("🏆 Doubles Match: Set won by Asha & Bina! Asha & Bina [21 - 18] Chitra");

    // A deuce game in the second game reads its score from the history it appended.
    const deuce = at(28, 29, {
      setsHistory: ["21-15"],
      t1: { p1Id: "a", p1Name: "Asha", p2Name: "Bina", score: 28, games: 1 },
    });
    const won = computeAddPoint(deuce, 2)!;
    expect(scoreAlertMessage(deuce, won)).toContain("[28 - 30]");
  });
});

describe("savedWinnerSide", () => {
  it("returns the winning side, or null when the match has no winner", () => {
    expect(savedWinnerSide({ winner: 1 })).toBe(1);
    expect(savedWinnerSide({ winner: 2 })).toBe(2);
    expect(savedWinnerSide({ winner: undefined })).toBeNull();
    expect(savedWinnerSide({})).toBeNull();
  });
});

describe("startErrorToast", () => {
  it("explains each refusal from the checked start", () => {
    expect(startErrorToast("court_in_use: Court 2 is running XD_QF_01")).toEqual({ title: "Court is not available", description: "Court 2 is running XD_QF_01" });
    expect(startErrorToast("court_conflict: C2 at 10:00")).toEqual({ title: "Court is not available", description: "C2 at 10:00" });
    expect(startErrorToast("player_in_use: Asha Rao")).toEqual({ title: "A player is already on court", description: "Asha Rao" });
    expect(startErrorToast("player_rest_conflict: Asha Rao: 12 min")).toEqual({ title: "Minimum rest has not elapsed", description: "Asha Rao: 12 min" });
    expect(startErrorToast("match_schedule_changed: x")).toEqual({ title: "Schedule changed", description: "Refresh the match list before starting." });
    expect(startErrorToast("scorer_locked: x")).toMatchObject({ title: "Another scorer is active" });
  });

  it("passes any other error through as the title", () => {
    expect(startErrorToast("Network request failed")).toEqual({ title: "Network request failed" });
  });
});

describe("serveInfo", () => {
  it("names the server and receiver from the serving side's player indexes", () => {
    const m = playing({
      serverTeam: 2,
      serverPlayerIndex: 1,
      receiverPlayerIndex: 0,
      t1: { p1Id: "a", p1Name: "Asha", p2Name: "Bina", score: 5, games: 1 },
      t2: { p1Id: "c", p1Name: "Chitra", p2Name: "Deepa", score: 7, games: 0 },
    });
    expect(serveInfo(m)).toEqual({
      currentGameNum: 2,
      serverScore: 7,
      receiverScore: 5,
      serverName: "Deepa",
      receiverName: "Asha",
      isDoubles: true,
    });
  });

  it("falls back to player 1 in singles and counts a name-only partner as doubles", () => {
    const singles = playing({
      serverPlayerIndex: 1,
      receiverPlayerIndex: 1,
      t1: { p1Id: "a", p1Name: "Asha", score: 0, games: 0 },
      t2: { p1Id: "c", p1Name: "Chitra", score: 0, games: 0 },
    });
    expect(serveInfo(singles)).toMatchObject({ serverName: "Asha", receiverName: "Chitra", isDoubles: false });
    expect(serveInfo(playing({ t1: { p1Id: "a", p1Name: "Asha", p2Name: "Bina", score: 0, games: 0 }, t2: { p1Id: "c", p1Name: "Chitra", score: 0, games: 0 } })).isDoubles).toBe(true);
  });
});
