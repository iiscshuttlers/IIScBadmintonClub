import { describe, expect, it } from "vitest";
import * as shared from "@/lib/badmintonScore";
import {
  autoWinnerFromSets,
  bulkSchedulePatch,
  cleanCourt,
  csvRowsToBulkLines,
  isValidBadmintonGame,
  parseBulkSchedule,
  roundListPriority,
  scheduleTemplateRows,
  statusAfterScheduleEdit,
  validateEditScore,
} from "./tournamentMatchesLogic";

const local = (s: string) => new Date(s).toISOString(); // "YYYY-MM-DDTHH:mm" read as local time
const bo = (bestOfSets: number) => ({ bestOfSets, pointsToWin: 21, cap: 30 });

describe("autoWinnerFromSets", () => {
  it("names the side that reached a majority of games", () => {
    expect(autoWinnerFromSets("21-15, 21-18", bo(3))).toBe(1);
    expect(autoWinnerFromSets("15-21, 21-18, 19-21", bo(3))).toBe(2);
    expect(autoWinnerFromSets("30-29", bo(1))).toBe(1);
    expect(autoWinnerFromSets("21-1, 21-2, 21-3", bo(5))).toBe(1);
  });

  it("returns null while the match is undecided", () => {
    expect(autoWinnerFromSets("", bo(3))).toBeNull();
    expect(autoWinnerFromSets("21-15", bo(3))).toBeNull();
    expect(autoWinnerFromSets("21-15, 15-21", bo(3))).toBeNull();
    expect(autoWinnerFromSets("21-1, 21-2", bo(5))).toBeNull();
  });

  it("names no winner when a game is malformed or impossible", () => {
    expect(autoWinnerFromSets("21-15, abc, 21-10", bo(3))).toBeNull();
    expect(autoWinnerFromSets("21-15, 20-20, 21-10", bo(3))).toBeNull();
    expect(autoWinnerFromSets("21-20, 21-10", bo(3))).toBeNull();
  });
});

describe("shared rules", () => {
  it("re-exports the shared game validator, so there is one rule set", () => {
    expect(isValidBadmintonGame).toBe(shared.isValidBadmintonGame);
  });
});

describe("isValidBadmintonGame", () => {
  it("accepts finished games to 21 with a cap at 30", () => {
    for (const [a, b] of [[21, 0], [21, 19], [19, 21], [22, 20], [29, 27], [30, 28], [30, 29], [29, 30]]) {
      expect(isValidBadmintonGame(a, b, 21, 30), `${a}-${b}`).toBe(true);
    }
  });

  it("rejects games that are unfinished or could not have happened", () => {
    for (const [a, b] of [[21, 20], [20, 18], [23, 20], [25, 21], [30, 27], [31, 29], [0, 0]]) {
      expect(isValidBadmintonGame(a, b, 21, 30), `${a}-${b}`).toBe(false);
    }
  });

  it("follows the event's own points and cap", () => {
    expect(isValidBadmintonGame(11, 9, 11, 15)).toBe(true);
    expect(isValidBadmintonGame(14, 12, 11, 15)).toBe(true);
    expect(isValidBadmintonGame(15, 14, 11, 15)).toBe(true);
    expect(isValidBadmintonGame(21, 19, 11, 15)).toBe(false);
  });
});

describe("validateEditScore", () => {
  const rules = bo(3);
  const sets = (...pairs: [string, string][]) => pairs.map(([t1, t2]) => ({ t1, t2 }));

  it("returns the filled games as the stored score, with the side they decide", () => {
    expect(validateEditScore(sets(["21", "15"], ["19", "21"], ["30", "29"]), rules)).toEqual({
      ok: true,
      sets: ["21-15", "19-21", "30-29"],
      score: "21-15, 19-21, 30-29",
      winnerSide: 1,
    });
    expect(validateEditScore(sets(["15", "21"], ["18", "21"], ["", ""]), rules)).toMatchObject({ ok: true, winnerSide: 2 });
  });

  it("reports an incomplete score with no winner", () => {
    expect(validateEditScore(sets(["21", "10"], ["", ""], ["", ""]), rules)).toEqual({
      ok: true,
      sets: ["21-10"],
      score: "21-10",
      winnerSide: null,
    });
    expect(validateEditScore(sets(["21", "10"], ["15", "21"], ["", ""]), rules)).toMatchObject({ ok: true, winnerSide: null });
  });

  it("skips half-filled rows and a 0-0 row at the end", () => {
    expect(validateEditScore(sets(["21", "15"], ["21", "18"], ["5", ""]), rules)).toMatchObject({
      ok: true,
      score: "21-15, 21-18",
      winnerSide: 1,
    });
    expect(validateEditScore(sets(["21", "15"], ["0", "0"], ["", ""]), rules)).toMatchObject({
      ok: true,
      sets: ["21-15"],
      winnerSide: null,
    });
  });

  it("refuses a game that follows a blank one", () => {
    expect(validateEditScore(sets(["21", "15"], ["", "4"], ["21", "18"]), rules)).toEqual({
      ok: false,
      error: "Fill in game 2 before game 3.",
    });
    expect(validateEditScore(sets(["0", "0"], ["21", "18"]), rules)).toMatchObject({ ok: false });
  });

  it("rejects an impossible game and says which one", () => {
    expect(validateEditScore(sets(["21", "15"], ["21", "20"]), rules)).toEqual({
      ok: false,
      error: "Game 2: 21-20 isn't a possible score (first to 21, win by 2, 30 wins).",
    });
  });

  it("rejects non-numeric and negative points", () => {
    expect(validateEditScore(sets(["21", "x"]), rules)).toEqual({ ok: false, error: "Game 1: enter the points as whole numbers." });
    expect(validateEditScore(sets(["21", "-1"]), rules)).toMatchObject({ ok: false });
    expect(validateEditScore(sets(["21", "10.5"]), rules)).toMatchObject({ ok: false });
  });

  it("rejects a game entered after the match was already won", () => {
    expect(validateEditScore(sets(["21", "10"], ["21", "12"], ["10", "21"]), rules)).toEqual({
      ok: false,
      error: "The match was already won after game 2. Remove game 3.",
    });
  });

  it("rejects more games than the format allows", () => {
    expect(validateEditScore(sets(["21", "10"], ["10", "21"]), bo(1))).toMatchObject({ ok: false });
  });

  it("uses the event's rules for what counts as a finished game", () => {
    const short = { bestOfSets: 1, pointsToWin: 15, cap: 21 };
    expect(validateEditScore(sets(["15", "13"]), short)).toMatchObject({ ok: true, score: "15-13", winnerSide: 1 });
    expect(validateEditScore(sets(["21", "13"]), short)).toMatchObject({ ok: false });
  });

  it("needs at least one game", () => {
    expect(validateEditScore(sets(["", ""], ["", ""]), rules)).toEqual({ ok: false, error: "Enter at least one set score" });
  });
});

describe("cleanCourt", () => {
  it("strips zero-width characters and spaces, leaving blank as empty", () => {
    expect(cleanCourt("\u200B")).toBe("");
    expect(cleanCourt("  C4\u200B ")).toBe("C4");
    expect(cleanCourt("\uFEFFAnnex 2")).toBe("Annex 2");
    expect(cleanCourt(null)).toBe("");
  });
});

describe("bulkSchedulePatch", () => {
  const at = "2026-06-30T04:30:00.000Z";
  const scheduled = { status: "scheduled", court_number: "C1", scheduled_at: "2026-06-30T04:30:00+00:00" };

  it("schedules a pending match and resets the reminder", () => {
    expect(bulkSchedulePatch({ status: "pending", court_number: null, scheduled_at: null }, { court: "C2", at })).toEqual({
      court_number: "C2",
      scheduled_at: at,
      status: "scheduled",
      reminder_sent: false,
    });
  });

  it("keeps the time on a court-only line and the court on a time-only line", () => {
    expect(bulkSchedulePatch(scheduled, { court: "C3", at: "" })).toEqual({
      court_number: "C3",
      status: "scheduled",
      reminder_sent: false,
    });
    const later = "2026-06-30T06:00:00.000Z";
    expect(bulkSchedulePatch(scheduled, { court: "", at: later })).toEqual({
      scheduled_at: later,
      status: "scheduled",
      reminder_sent: false,
    });
  });

  it("schedules a pending match from a court-only line", () => {
    expect(bulkSchedulePatch({ status: "pending", court_number: null, scheduled_at: null }, { court: "C2", at: "" }))
      .toMatchObject({ status: "scheduled" });
  });

  it("changes nothing when the slot is the same, so no reminder is re-sent", () => {
    expect(bulkSchedulePatch(scheduled, { court: "C1", at })).toBeNull();
    expect(bulkSchedulePatch(scheduled, { court: "", at: "" })).toBeNull();
    // "1", "C1" and "Court 1" are the same court: no change, no re-sent reminder.
    expect(bulkSchedulePatch(scheduled, { court: "1", at: "" })).toBeNull();
    expect(bulkSchedulePatch(scheduled, { court: "Court 1", at: "" })).toBeNull();
    expect(bulkSchedulePatch(scheduled, { court: "\u200B", at: "" })).toBeNull();
  });

  it("never moves a live or finished match's status", () => {
    expect(bulkSchedulePatch({ ...scheduled, status: "in_progress" }, { court: "C5", at: "" }))
      .toMatchObject({ status: "in_progress" });
  });
});

describe("statusAfterScheduleEdit", () => {
  it("schedules a pending match that gets a court or a time", () => {
    expect(statusAfterScheduleEdit("pending", null, "C2")).toBe("scheduled");
    expect(statusAfterScheduleEdit("pending", "2026-11-22T04:30:00.000Z", "")).toBe("scheduled");
    expect(statusAfterScheduleEdit("pending", null, "")).toBe("pending");
  });

  it("returns a scheduled match to pending only when both are cleared", () => {
    expect(statusAfterScheduleEdit("scheduled", null, null)).toBe("pending");
    expect(statusAfterScheduleEdit("scheduled", "", "C1")).toBe("scheduled");
  });

  it("never touches a live or finished match", () => {
    expect(statusAfterScheduleEdit("in_progress", null, null)).toBe("in_progress");
    expect(statusAfterScheduleEdit("completed", null, null)).toBe("completed");
    expect(statusAfterScheduleEdit(undefined, "x", "y")).toBeUndefined();
  });
});

describe("roundListPriority", () => {
  it("lists live matches first and finished ones last, keeping order within a band", () => {
    const ms = ["completed", "scheduled", "IN_PROGRESS", "walkover", "pending", "in_progress", "COMPLETED"]
      .map((status, i) => ({ status, i }));
    const sorted = [...ms].sort((a, b) => roundListPriority(a.status) - roundListPriority(b.status));
    expect(sorted.map((m) => m.status)).toEqual([
      "IN_PROGRESS", "in_progress", "scheduled", "pending", "completed", "walkover", "COMPLETED",
    ]);
  });
});

describe("schedule template and CSV upload", () => {
  const m = (o: Record<string, unknown>) => ({
    category: "MS",
    round: 1,
    match_number: 1,
    team1_label: "A",
    team2_label: "B",
    court_number: null,
    scheduled_at: null,
    ...o,
  }) as Parameters<typeof scheduleTemplateRows>[0][number];

  it("lists the category's real matches in draw order", () => {
    const rows = scheduleTemplateRows(
      [
        m({ match_code: "MS_QF_02", round: 2, match_number: 2 }),
        m({ match_code: "MS_R1_03", round: 1, match_number: 3, court_number: "C2" }),
        m({ match_code: "MS_R1_01", round: 1, match_number: 1 }),
        m({ match_code: "MS_R1_02", round: 1, match_number: 2, team2_label: "BYE" }),
        m({ match_code: "WS_R1_01", category: "WS" }),
      ],
      "MS",
    );
    expect(rows).toEqual([
      ["MS_R1_01", "", "", ""],
      ["MS_R1_03", "C2", "", ""],
      ["MS_QF_02", "", "", ""],
    ]);
  });

  it("writes local date and time, so a download → upload round trip keeps every slot", () => {
    const scheduled = "2026-06-30T04:30:00+00:00";
    const matches = [m({ match_code: "MS_R1_01", court_number: "C3", scheduled_at: scheduled })];
    const [row] = scheduleTemplateRows(matches, "MS");
    const d = new Date(scheduled);
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(row).toEqual([
      "MS_R1_01",
      "C3",
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    ]);

    const text = csvRowsToBulkLines([["MatchCode", "Court", "Date (YYYY-MM-DD)", "Time (HH:MM)"], row]).join("\n");
    const [parsed] = parseBulkSchedule(text, matches, "MS");
    expect(parsed).toEqual({ matchCode: "MS_R1_01", court: "C3", at: d.toISOString(), found: true, wrongCategory: false });
  });

  it("turns CSV rows into bulk lines, with or without a header", () => {
    expect(csvRowsToBulkLines([
      ["MatchCode", "Court", "Date", "Time"],
      ["ms_r1_01", "C1", "2026-06-30", "10:00"],
      ["MS_R1_02", "", "2026-06-30", ""],
      ["MS_R1_03", "C2"],
      ["", "C9", "2026-06-30", "12:00"],
    ])).toEqual([
      "MS_R1_01 court=C1 date=2026-06-30 time=10:00",
      "MS_R1_02 date=2026-06-30",
      "MS_R1_03 court=C2",
    ]);
    expect(csvRowsToBulkLines([["MS_R1_01", "C1", "", ""]])).toEqual(["MS_R1_01 court=C1"]);
  });
});

describe("parseBulkSchedule", () => {
  const matches = [
    { match_code: "MS_QF_01", category: "MS" },
    { match_code: "MS_QF_02", category: "MS" },
    { match_code: "MS_SF_01", category: "MS" },
    { match_code: "WS_SF_01", category: "WS" },
  ];

  it("reads all three documented line formats as local times", () => {
    const rows = parseBulkSchedule(
      [
        "MS_QF_01: Court 3, 2026-06-30 10:00",
        "MS_QF_02 court=4 date=2026-06-30 time=11:30",
        "MS_SF_01, Court 1, 30/06/2026 14:00",
      ].join("\n"),
      matches,
      "MS",
    );
    expect(rows).toEqual([
      { matchCode: "MS_QF_01", court: "C3", at: local("2026-06-30T10:00"), found: true, wrongCategory: false },
      { matchCode: "MS_QF_02", court: "C4", at: local("2026-06-30T11:30"), found: true, wrongCategory: false },
      { matchCode: "MS_SF_01", court: "C1", at: local("2026-06-30T14:00"), found: true, wrongCategory: false },
    ]);
  });

  it("stores numbered courts in the preset form C<n>; placeholders blank, names as typed", () => {
    const rows = parseBulkSchedule(["MS_QF_01 court=3", "MS_QF_02: Court 7", "MS_SF_01 court=c02", "WS_SF_01 court=Centre"].join("\n"), matches, "MS");
    expect(rows.map((r) => r.court)).toEqual(["C3", "C7", "C2", "Centre"]);
    expect(parseBulkSchedule("MS_QF_01 court=TBD", matches, "MS")[0].court).toBe("");
  });

  it("accepts day-first dates and bare hours in key=value lines", () => {
    const [row] = parseBulkSchedule("ms_qf_01 court=C2 date=30/06/2026 time=9", matches, "MS");
    expect(row).toMatchObject({ matchCode: "MS_QF_01", court: "C2", at: local("2026-06-30T09:00") });
  });

  it("keeps a court-only or time-only line", () => {
    const rows = parseBulkSchedule("MS_QF_01 court=4\nMS_QF_02 2026-06-30 08:15", matches, "MS");
    expect(rows[0]).toMatchObject({ court: "C4", at: "" });
    expect(rows[1]).toMatchObject({ court: "", at: local("2026-06-30T08:15") });
  });

  it("skips comments and blank lines, and merges a repeated code", () => {
    const rows = parseBulkSchedule(
      "# order of play\n\n// day 2\nMS_QF_01: Court 3\nMS_QF_01: 2026-06-30 10:00\nMS_QF_01: Court 5",
      matches,
      "MS",
    );
    expect(rows).toEqual([{ matchCode: "MS_QF_01", court: "C5", at: local("2026-06-30T10:00"), found: true, wrongCategory: false }]);
  });

  it("flags unknown codes and codes from another category", () => {
    const rows = parseBulkSchedule("MS_QF_09 court=1\nWS_SF_01 court=2", matches, "MS");
    expect(rows.map((r) => [r.matchCode, r.found, r.wrongCategory])).toEqual([
      ["MS_QF_09", false, false],
      ["WS_SF_01", true, true],
    ]);
  });
});
