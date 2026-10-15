import { describe, it, expect } from "vitest";
import { computeQueueAlerts, courtLabel, queueAlertText, type QueueMatch } from "../../supabase/functions/_shared/courtQueue";

let n = 0;
const m = (over: Partial<QueueMatch>): QueueMatch => ({
  id: `m${++n}`,
  tournament_id: "t1",
  court_number: "1",
  status: "scheduled",
  scheduled_at: null,
  round: 1,
  match_number: n,
  player1_id: `p${n}a`,
  player2_id: `p${n}b`,
  player3_id: null,
  player4_id: null,
  team1_label: "A",
  team2_label: "B",
  category: "MS",
  ...over,
});

describe("computeQueueAlerts", () => {
  it("alerts positions 1 and 2 behind the live match, ordered by time", () => {
    const live = m({ status: "in_progress" });
    const later = m({ scheduled_at: "2026-10-15T11:00:00Z" });
    const sooner = m({ scheduled_at: "2026-10-15T10:00:00Z" });
    const third = m({ scheduled_at: "2026-10-15T12:00:00Z" });
    const alerts = computeQueueAlerts([live, later, sooner, third]);
    expect(alerts.map((a) => [a.match.id, a.position])).toEqual([
      [sooner.id, 1],
      [later.id, 2],
    ]);
  });

  it("ignores courts with nothing live", () => {
    expect(computeQueueAlerts([m({}), m({})])).toEqual([]);
  });

  it("keeps courts and tournaments separate", () => {
    const alerts = computeQueueAlerts([
      m({ status: "in_progress", court_number: "1" }),
      m({ court_number: "2" }),
      m({ status: "in_progress", court_number: "1", tournament_id: "t2" }),
      m({ court_number: "1", tournament_id: "t2" }),
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].match.tournament_id).toBe("t2");
  });

  it("skips TBD and bye matches but still counts their slot", () => {
    const alerts = computeQueueAlerts([
      m({ status: "in_progress" }),
      m({ player2_id: null, scheduled_at: "2026-10-15T10:00:00Z" }),
      m({ scheduled_at: "2026-10-15T11:00:00Z" }),
      m({ team2_label: "BYE", scheduled_at: "2026-10-15T09:00:00Z" }),
    ]);
    // Bye is first in queue (skipped), TBD second (skipped) — so nobody alerted.
    expect(alerts).toEqual([]);
  });

  it("includes doubles partners", () => {
    const [a] = computeQueueAlerts([
      m({ status: "in_progress" }),
      m({ player3_id: "x3", player4_id: "x4" }),
    ]);
    expect(a.playerIds).toHaveLength(4);
  });

  it("formats messages", () => {
    const [a1, a2] = computeQueueAlerts([m({ status: "in_progress", court_number: "3" }), m({ court_number: "3" }), m({ court_number: "3" })]);
    expect(queueAlertText(a1).title).toBe("⏭️ You're up next on Court 3");
    expect(queueAlertText(a2).title).toBe("🏸 2 matches until you're on Court 3");
  });

  it("normalises court labels", () => {
    expect(courtLabel("C1")).toBe("Court 1");
    expect(courtLabel("court 2")).toBe("Court 2");
    expect(courtLabel("3")).toBe("Court 3");
    expect(courtLabel("Centre Court")).toBe("Centre Court");
  });
});
