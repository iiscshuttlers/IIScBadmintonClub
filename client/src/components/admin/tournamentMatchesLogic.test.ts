import { describe, expect, it } from "vitest";
import {
  autoWinnerFromSets,
  csvRowsToBulkLines,
  isValidBadmintonGame,
  parseBulkSchedule,
  roundListPriority,
  scheduleTemplateRows,
  statusAfterScheduleEdit,
  validateEditScore,
} from "./tournamentMatchesLogic";

const local = (s: string) => new Date(s).toISOString(); // "YYYY-MM-DDTHH:mm" read as local time

describe("autoWinnerFromSets", () => {
  it("names the side that reached a majority of games", () => {
    expect(autoWinnerFromSets("21-15, 21-18", 3)).toBe(1);
    expect(autoWinnerFromSets("15-21, 21-18, 19-21", 3)).toBe(2);
    expect(autoWinnerFromSets("30-29", 1)).toBe(1);
    expect(autoWinnerFromSets("21-1, 21-2, 21-3", 5)).toBe(1);
  });

  it("returns null while the match is undecided", () => {
    expect(autoWinnerFromSets("", 3)).toBeNull();
    expect(autoWinnerFromSets("21-15", 3)).toBeNull();
    expect(autoWinnerFromSets("21-15, 15-21", 3)).toBeNull();
    expect(autoWinnerFromSets("21-1, 21-2", 5)).toBeNull();
  });

  it("skips malformed and level games", () => {
    expect(autoWinnerFromSets("21-15, abc, 20-20, 21-10", 3)).toBe(1);
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
  const rules = { bestOfSets: 3, pointsToWin: 21, goldenPoint: 30 };
  const sets = (...pairs: [string, string][]) => pairs.map(([t1, t2]) => ({ t1, t2 }));

  it("returns the filled games as the stored score", () => {
    expect(validateEditScore(sets(["21", "15"], ["19", "21"], ["30", "29"]), rules)).toEqual({
      ok: true,
      sets: ["21-15", "19-21", "30-29"],
      score: "21-15, 19-21, 30-29",
    });
  });

  it("skips half-filled rows", () => {
    expect(validateEditScore(sets(["21", "15"], ["21", "18"], ["5", ""]), rules)).toMatchObject({
      ok: true,
      score: "21-15, 21-18",
    });
  });

  it("rejects an impossible game and says which one", () => {
    expect(validateEditScore(sets(["21", "15"], ["21", "20"]), rules)).toEqual({
      ok: false,
      error: "Invalid score in set 2: 21-20. Enter a mathematically valid badminton score.",
    });
  });

  it("rejects a game entered after the match was already won", () => {
    expect(validateEditScore(sets(["21", "10"], ["21", "12"], ["10", "21"]), rules)).toEqual({
      ok: false,
      error: "Invalid score: The match was already won in earlier sets. You cannot enter a score for set 3.",
    });
  });

  it("uses the event's rules for what counts as a finished game", () => {
    const short = { bestOfSets: 1, pointsToWin: 15, goldenPoint: 21 };
    expect(validateEditScore(sets(["15", "13"]), short)).toMatchObject({ ok: true, score: "15-13" });
    expect(validateEditScore(sets(["21", "13"]), short)).toMatchObject({ ok: false });
  });

  it("needs at least one game", () => {
    expect(validateEditScore(sets(["", ""], ["", ""]), rules)).toEqual({ ok: false, error: "Enter at least one set score" });
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
      { matchCode: "MS_QF_01", court: "3", at: local("2026-06-30T10:00"), found: true, wrongCategory: false },
      { matchCode: "MS_QF_02", court: "4", at: local("2026-06-30T11:30"), found: true, wrongCategory: false },
      { matchCode: "MS_SF_01", court: "1", at: local("2026-06-30T14:00"), found: true, wrongCategory: false },
    ]);
  });

  it("accepts day-first dates and bare hours in key=value lines", () => {
    const [row] = parseBulkSchedule("ms_qf_01 court=C2 date=30/06/2026 time=9", matches, "MS");
    expect(row).toMatchObject({ matchCode: "MS_QF_01", court: "C2", at: local("2026-06-30T09:00") });
  });

  it("keeps a court-only or time-only line", () => {
    const rows = parseBulkSchedule("MS_QF_01 court=4\nMS_QF_02 2026-06-30 08:15", matches, "MS");
    expect(rows[0]).toMatchObject({ court: "4", at: "" });
    expect(rows[1]).toMatchObject({ court: "", at: local("2026-06-30T08:15") });
  });

  it("skips comments and blank lines, and merges a repeated code", () => {
    const rows = parseBulkSchedule(
      "# order of play\n\n// day 2\nMS_QF_01: Court 3\nMS_QF_01: 2026-06-30 10:00\nMS_QF_01: Court 5",
      matches,
      "MS",
    );
    expect(rows).toEqual([{ matchCode: "MS_QF_01", court: "5", at: local("2026-06-30T10:00"), found: true, wrongCategory: false }]);
  });

  it("flags unknown codes and codes from another category", () => {
    const rows = parseBulkSchedule("MS_QF_09 court=1\nWS_SF_01 court=2", matches, "MS");
    expect(rows.map((r) => [r.matchCode, r.found, r.wrongCategory])).toEqual([
      ["MS_QF_09", false, false],
      ["WS_SF_01", true, true],
    ]);
  });
});
