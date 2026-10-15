/**
 * Pure logic for captain lineup-deadline reminders (no Deno imports, so vitest
 * covers it: test/lib/lineupDeadline.test.ts).
 *
 * A side is "missing" when it has no tie_lineups rows yet. Deadline is the
 * tie's lineup_deadline, else 30 min before scheduled_at.
 */

export interface DeadlineTie {
  id: string;
  tie_code: string | null;
  state: string;
  scheduled_at: string | null;
  lineup_deadline: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
}

export interface DeadlineAlert {
  tieId: string;
  side: "A" | "B";
  teamId: string;
  /** Minutes-before-deadline bucket this alert belongs to (60 or 15). */
  threshold: number;
  deadline: string;
  minsLeft: number;
}

export const THRESHOLDS = [60, 15] as const;
const OPEN_STATES = new Set(["SCHEDULED", "AWAITING_LINEUPS"]);

export function effectiveDeadline(t: DeadlineTie): string | null {
  if (t.lineup_deadline) return t.lineup_deadline;
  if (!t.scheduled_at) return null;
  return new Date(Date.parse(t.scheduled_at) - 30 * 60_000).toISOString();
}

/**
 * @param submittedSides set of `${tieId}:${side}` that already have a lineup
 * @param sent set of `${tieId}:${side}:${threshold}` already alerted
 */
export function computeDeadlineAlerts(
  ties: DeadlineTie[],
  submittedSides: Set<string>,
  sent: Set<string>,
  now = Date.now(),
): DeadlineAlert[] {
  const out: DeadlineAlert[] = [];
  for (const t of ties) {
    if (!OPEN_STATES.has(t.state)) continue;
    const deadline = effectiveDeadline(t);
    if (!deadline) continue;
    const msLeft = Date.parse(deadline) - now;
    if (msLeft <= 0) continue;
    const minsLeft = Math.ceil(msLeft / 60_000);
    // Tightest threshold we're inside (15 beats 60), so a late cron run
    // doesn't send both at once.
    const threshold = [...THRESHOLDS].sort((a, b) => a - b).find((th) => minsLeft <= th);
    if (threshold == null) continue;
    for (const [side, teamId] of [["A", t.team_a_id], ["B", t.team_b_id]] as const) {
      if (!teamId) continue;
      if (submittedSides.has(`${t.id}:${side}`)) continue;
      if (sent.has(`${t.id}:${side}:${threshold}`)) continue;
      out.push({ tieId: t.id, side, teamId, threshold, deadline, minsLeft });
    }
  }
  return out;
}

export function deadlineText(a: DeadlineAlert, tieCode: string | null, opponent: string | null) {
  const vs = opponent ? ` vs ${opponent}` : "";
  return {
    title: a.threshold <= 15 ? "⏰ Lineup due in 15 minutes" : "📝 Submit your team lineup",
    body: `${tieCode ? tieCode + vs : "Your next tie" + vs}: lineup closes in ${a.minsLeft} min. Captains — submit it in the Team Hub.`,
  };
}
