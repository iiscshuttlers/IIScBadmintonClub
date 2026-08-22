import { describe, it, expect } from "vitest";
import { splitSets, recoverMatchFromTournamentRow, type TournamentRowForRecovery } from "./resumeRecovery";

const row: TournamentRowForRecovery = {
  id: "tm-1",
  category: "WD",
  match_code: "WD_SF_01",
  points_to_win: 21,
  best_of_sets: 3,
  golden_point: 30,
  player1_id: "p1",
  player2_id: "p2",
  player3_id: "p3",
  player4_id: "p4",
  team1_label: "Minakshi Jangir & Priya",
  team2_label: "Madhuvanthi & Radhika Dutt",
};

const umpire = { id: "u1", name: "Umpire" };

describe("splitSets", () => {
  it("separates the running game from completed ones", () => {
    expect(splitSets({ score: "13-2", sets_history: ["21-15", "13-2"] }))
      .toEqual({ completed: ["21-15"], current: [13, 2] });
  });

  it("treats every entry as complete when no game is running", () => {
    expect(splitSets({ score: "0-0", sets_history: ["21-15", "18-21"] }))
      .toEqual({ completed: ["21-15", "18-21"], current: [0, 0] });
  });

  it("keeps a trailing set that is not the running score", () => {
    // Row written before the running score was appended.
    expect(splitSets({ score: "5-3", sets_history: ["21-15"] }))
      .toEqual({ completed: ["21-15"], current: [5, 3] });
  });

  it("handles an empty row", () => {
    expect(splitSets({ score: null, sets_history: null }))
      .toEqual({ completed: [], current: [0, 0] });
  });
});

describe("recoverMatchFromTournamentRow", () => {
  it("restores the running score and games won", () => {
    const m = recoverMatchFromTournamentRow(
      row,
      { score: "13-2", sets_history: ["21-15", "13-2"] },
      umpire,
    );

    expect(m.status).toBe("playing");
    expect(m.t1.score).toBe(13);
    expect(m.t2.score).toBe(2);
    expect(m.t1.games).toBe(1);
    expect(m.t2.games).toBe(0);
    expect(m.setsHistory).toEqual(["21-15"]);
  });

  it("keeps the tournament identity so scores keep syncing to the bracket", () => {
    const m = recoverMatchFromTournamentRow(row, { score: "5-5", sets_history: ["5-5"] }, umpire);
    expect(m.id).toBe("tm-1"); // live snapshots are keyed by the tournament row id
    expect(m.isTournamentMatch).toBe(true);
    expect(m.matchNumber).toBe("WD_SF_01");
    expect(m.isFriendly).toBe(false);
    expect(m.pointsToWin).toBe(21);
    expect(m.bestOfSets).toBe(3);
  });

  it("splits doubles team labels into both players", () => {
    const m = recoverMatchFromTournamentRow(row, { score: "1-0", sets_history: ["1-0"] }, umpire);
    expect(m.category).toBe("Doubles");
    expect(m.t1.p1Name).toBe("Minakshi Jangir");
    expect(m.t1.p2Name).toBe("Priya");
    expect(m.t2.p1Name).toBe("Madhuvanthi");
    expect(m.t2.p2Name).toBe("Radhika Dutt");
  });

  it("never invents a partner for a singles match", () => {
    const m = recoverMatchFromTournamentRow(
      { ...row, category: "WS", team1_label: "Sneha S", team2_label: "Tejakshi V" },
      { score: "3-4", sets_history: ["3-4"] },
      umpire,
    );
    expect(m.category).toBe("Singles");
    expect(m.t1.p2Name).toBe("");
    expect(m.t2.p2Name).toBe("");
  });

  it("puts the teams on the ends the completed games imply", () => {
    const noGames = recoverMatchFromTournamentRow(row, { score: "9-4", sets_history: ["9-4"] }, umpire);
    expect(noGames.endsSwapped).toBe(false);

    const oneGame = recoverMatchFromTournamentRow(
      row, { score: "9-4", sets_history: ["21-15", "9-4"] }, umpire,
    );
    expect(oneGame.endsSwapped).toBe(true);
  });

  it("resets serve state to a valid opening line-up", () => {
    const m = recoverMatchFromTournamentRow(row, { score: "13-2", sets_history: ["13-2"] }, umpire);
    expect(m.serverPlayerIndex).toBe(0);
    expect(m.receiverPlayerIndex).toBe(0);
    expect(m.t1RightCourt).toBe(0);
    expect(m.t2RightCourt).toBe(0);
    expect(m.pointLog).toEqual([]); // genuinely unrecoverable
  });
});
