import { describe, it, expect } from "vitest";
import { computeUmpireRecord, type UmpiredMatch } from "./umpireRecord";

let i = 0;
const m = (o: Partial<UmpiredMatch> = {}): UmpiredMatch => {
  i++;
  return {
    id: `m${i}`,
    tournament_id: "t1",
    category: "MS",
    round_name: "Round 1",
    team1_label: "A",
    team2_label: "B",
    score: "21-10, 21-12",
    status: "completed",
    started_at: null,
    ended_at: `2026-10-${String(1 + (i % 20)).padStart(2, "0")}T10:00:00Z`,
    scheduled_at: null,
    ...o,
  };
};

const badge = (r: ReturnType<typeof computeUmpireRecord>, id: string) => r.badges.find((b) => b.id === id)!;

describe("computeUmpireRecord", () => {
  it("counts only finished matches and dates the tier from the Nth match", () => {
    const list = Array.from({ length: 10 }, (_, k) => m({ ended_at: `2026-09-${String(k + 1).padStart(2, "0")}T10:00:00Z` }));
    list.push(m({ status: "scheduled" }));
    const r = computeUmpireRecord(list);
    expect(r.matches).toBe(10);
    expect(badge(r, "ump_first_whistle").earnedAt).toBe("2026-09-01T10:00:00Z");
    expect(badge(r, "ump_regular").earnedAt).toBe("2026-09-10T10:00:00Z");
    expect(badge(r, "ump_seasoned")).toMatchObject({ earned: false, current: 10, target: 25 });
  });

  it("awards Big Stage, Marathon Day and On the Circuit", () => {
    const sameDay = Array.from({ length: 8 }, (_, k) => m({ ended_at: `2026-10-05T0${k + 1}:00:00Z` }));
    const r = computeUmpireRecord([
      ...sameDay,
      m({ round_name: "Final", tournament_id: "t2" }),
      m({ tournament_id: "t3" }),
    ]);
    expect(badge(r, "ump_big_stage").earned).toBe(true);
    expect(badge(r, "ump_marathon")).toMatchObject({ earned: true, earnedAt: "2026-10-05T08:00:00Z" });
    expect(badge(r, "ump_circuit").earned).toBe(true);
    expect(r.busiestDay).toEqual({ date: "2026-10-05", matches: 8 });
    expect(r.finals).toBe(1);
    expect(r.tournaments).toBe(3);
  });

  it("handles an empty record", () => {
    const r = computeUmpireRecord([]);
    expect(r.matches).toBe(0);
    expect(r.badges.every((b) => !b.earned)).toBe(true);
  });
});
