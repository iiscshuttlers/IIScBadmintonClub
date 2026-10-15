import { describe, it, expect } from "vitest";
import { computeDeadlineAlerts, effectiveDeadline, type DeadlineTie } from "../../supabase/functions/_shared/lineupDeadline";

const NOW = Date.parse("2026-10-15T10:00:00Z");
const tie = (o: Partial<DeadlineTie>): DeadlineTie => ({
  id: "t1",
  tie_code: "T1",
  state: "SCHEDULED",
  scheduled_at: null,
  lineup_deadline: "2026-10-15T10:40:00Z",
  team_a_id: "A1",
  team_b_id: "B1",
  ...o,
});

describe("lineup deadline alerts", () => {
  it("falls back to 30 min before the tie", () => {
    expect(effectiveDeadline(tie({ lineup_deadline: null, scheduled_at: "2026-10-15T11:00:00Z" }))).toBe("2026-10-15T10:30:00.000Z");
  });

  it("alerts both missing sides in the 60-min bucket", () => {
    const a = computeDeadlineAlerts([tie({})], new Set(), new Set(), NOW);
    expect(a.map((x) => [x.side, x.threshold, x.minsLeft])).toEqual([["A", 60, 40], ["B", 60, 40]]);
  });

  it("skips submitted sides, sent alerts, closed ties and passed deadlines", () => {
    expect(computeDeadlineAlerts([tie({})], new Set(["t1:A"]), new Set(["t1:B:60"]), NOW)).toEqual([]);
    expect(computeDeadlineAlerts([tie({ state: "IN_PROGRESS" })], new Set(), new Set(), NOW)).toEqual([]);
    expect(computeDeadlineAlerts([tie({ lineup_deadline: "2026-10-15T09:59:00Z" })], new Set(), new Set(), NOW)).toEqual([]);
    expect(computeDeadlineAlerts([tie({ lineup_deadline: "2026-10-15T12:00:00Z" })], new Set(), new Set(), NOW)).toEqual([]);
  });

  it("uses the 15-min bucket when close, even if 60 was never sent", () => {
    const a = computeDeadlineAlerts([tie({ lineup_deadline: "2026-10-15T10:10:00Z" })], new Set(), new Set(), NOW);
    expect(a.every((x) => x.threshold === 15)).toBe(true);
  });
});
