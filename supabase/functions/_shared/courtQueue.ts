/**
 * Pure court-queue logic for "You're up next" alerts. No Deno/Supabase imports
 * so it can be unit-tested from vitest (test/lib/courtQueue.test.ts).
 *
 * Queue order per (tournament, court) matches the spectator UpNextPanel:
 * live first, then scheduled_at (nulls last), round, match_number.
 */

export interface QueueMatch {
  id: string;
  tournament_id: string;
  court_number: string | null;
  status: string;
  scheduled_at: string | null;
  round: number | null;
  match_number: number | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id: string | null;
  player4_id: string | null;
  team1_label: string | null;
  team2_label: string | null;
  category: string | null;
}

export interface QueueAlert {
  match: QueueMatch;
  court: string;
  /** 1 = next on court after the live match, 2 = two away. */
  position: number;
  playerIds: string[];
}

export const LIVE_STATUSES = new Set(["in_progress", "playing", "live", "ongoing"]);
const WAITING_STATUSES = new Set(["scheduled", "pending"]);

/** How far down the queue we alert. 1 = "you're next", 2 = "2 matches away". */
export const MAX_ALERT_POSITION = 2;

const isBye = (label: string | null) => !!label && /\bbye\b/i.test(label);

export function participantIds(m: QueueMatch): string[] {
  return [m.player1_id, m.player2_id, m.player3_id, m.player4_id].filter((x): x is string => !!x);
}

/** Both sides decided (not TBD, not a bye) — otherwise there's no one to tell. */
function isReady(m: QueueMatch): boolean {
  if (isBye(m.team1_label) || isBye(m.team2_label)) return false;
  return !!m.player1_id && !!m.player2_id;
}

function compareQueue(a: QueueMatch, b: QueueMatch): number {
  const la = LIVE_STATUSES.has(a.status) ? 0 : 1;
  const lb = LIVE_STATUSES.has(b.status) ? 0 : 1;
  if (la !== lb) return la - lb;
  const ta = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.POSITIVE_INFINITY;
  const tb = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);
  return (a.match_number ?? 0) - (b.match_number ?? 0);
}

/**
 * Given every not-yet-completed match of the live tournaments, return who to
 * alert. Only courts with a match in progress are considered — an idle court's
 * queue isn't moving, so "you're next" would be noise.
 */
export function computeQueueAlerts(matches: QueueMatch[]): QueueAlert[] {
  const byCourt = new Map<string, QueueMatch[]>();
  for (const m of matches) {
    const court = courtKey(m.court_number);
    if (!court) continue;
    if (!LIVE_STATUSES.has(m.status) && !WAITING_STATUSES.has(m.status)) continue;
    const key = `${m.tournament_id}::${court}`;
    const list = byCourt.get(key) ?? [];
    list.push(m);
    byCourt.set(key, list);
  }

  const alerts: QueueAlert[] = [];
  for (const [key, list] of byCourt) {
    if (!list.some((m) => LIVE_STATUSES.has(m.status))) continue;
    const court = key.split("::")[1];
    const waiting = list.filter((m) => WAITING_STATUSES.has(m.status)).sort(compareQueue);
    waiting.slice(0, MAX_ALERT_POSITION).forEach((m, i) => {
      if (!isReady(m)) return;
      alerts.push({ match: m, court, position: i + 1, playerIds: participantIds(m) });
    });
  }
  return alerts;
}

const COURT_NUMBER = /^(?:c(?:ourt)?[\s#.-]*)?0*(\d+)$/i;
/** Values organisers type when no court is decided yet. */
const COURT_PLACEHOLDER = /^(?:c|court|courts|tbd|tba|n\/?a|-+)$/i;

/**
 * One key per physical court: "1", "C1", "c 1" and "Court 1" are all "1", so
 * one court is one queue. Placeholders ("Court", "TBD", "-") mean no court.
 * Other names pass through ("Centre Court"). Mirrored in client matchView.ts.
 */
export function courtKey(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t || COURT_PLACEHOLDER.test(t)) return null;
  const m = t.match(COURT_NUMBER);
  return m ? m[1] : t;
}

/** "C1" / "court 1" / "1" → "Court 1"; other names pass through ("Centre Court"). */
export function courtLabel(raw: string): string {
  const key = courtKey(raw);
  if (!key) return raw.trim();
  return /^\d+$/.test(key) ? `Court ${key}` : key;
}

export function queueAlertText(a: QueueAlert): { title: string; body: string } {
  const vs = `${a.match.team1_label || "Team 1"} vs ${a.match.team2_label || "Team 2"}`;
  const cat = a.match.category ? `${a.match.category} · ` : "";
  if (a.position === 1) {
    return {
      title: `⏭️ You're up next on ${courtLabel(a.court)}`,
      body: `${cat}${vs} — right after the match on court now. Time to warm up!`,
    };
  }
  return {
    title: `🏸 ${a.position} matches until you're on ${courtLabel(a.court)}`,
    body: `${cat}${vs}. Stay close to the courts.`,
  };
}
