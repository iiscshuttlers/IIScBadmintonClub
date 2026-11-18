/**
 * Correction preview model (WP7).
 *
 * The server (`preview_tournament_match_correction`) is authoritative for
 * revision, downstream dependencies and blockers; this module only parses
 * its response, validates the organiser's input and turns codes into plain
 * English. The apply/undo RPCs re-check everything under a row lock, so a
 * stale preview can never commit.
 */

export type CorrectionBlocker =
  | "not_completed"
  | "downstream_started"
  | "ranked_winner_change"
  | "team_winner_change";

export interface DownstreamMatch {
  matchId: string;
  matchCode: string;
  path: "winner" | "loser";
  position: number | null;
  status: string;
  team1Label: string | null;
  team2Label: string | null;
  started: boolean;
}

export interface CorrectionPreview {
  matchId: string;
  tournamentId: string;
  matchCode: string | null;
  status: string;
  revision: number;
  winnerSide: 1 | 2 | null;
  score: string | null;
  sets: string[];
  countsForElo: boolean;
  isTeamRubber: boolean;
  winnerChange: boolean;
  eloEffect: "not_ranked" | "unchanged" | "requires_recalculation";
  downstream: DownstreamMatch[];
  blockers: CorrectionBlocker[];
  undoableEventId: number | null;
}

const KNOWN_BLOCKERS: ReadonlySet<string> = new Set([
  "not_completed",
  "downstream_started",
  "ranked_winner_change",
  "team_winner_change",
]);

function asNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Defensive parse: unknown blocker codes are kept as blocking (fail closed). */
export function parseCorrectionPreview(raw: unknown): CorrectionPreview {
  const r = (raw ?? {}) as Record<string, any>;
  const side = asNumber(r.winner_side);
  const blockers = Array.isArray(r.blockers) ? (r.blockers as unknown[]).map(String) : [];
  return {
    matchId: String(r.match_id ?? ""),
    tournamentId: String(r.tournament_id ?? ""),
    matchCode: r.match_code ?? null,
    status: String(r.status ?? ""),
    revision: asNumber(r.revision) ?? 0,
    winnerSide: side === 1 || side === 2 ? side : null,
    score: r.score ?? null,
    sets: Array.isArray(r.sets) ? r.sets.map(String) : [],
    countsForElo: !!r.counts_for_elo,
    isTeamRubber: !!r.is_team_rubber,
    winnerChange: !!r.winner_change,
    eloEffect:
      r.elo_effect === "unchanged" || r.elo_effect === "requires_recalculation" ? r.elo_effect : "not_ranked",
    downstream: Array.isArray(r.downstream)
      ? r.downstream.map((d: any) => ({
          matchId: String(d.match_id ?? ""),
          matchCode: String(d.match_code ?? ""),
          path: d.path === "loser" ? "loser" : "winner",
          position: asNumber(d.position),
          status: String(d.status ?? ""),
          team1Label: d.team1_label ?? null,
          team2Label: d.team2_label ?? null,
          started: !!d.started,
        }))
      : [],
    blockers: blockers as CorrectionBlocker[],
    undoableEventId: asNumber(r.undoable_event_id),
  };
}

export function blockerMessage(code: string): string {
  switch (code) {
    case "not_completed":
      return "Only a completed result can be corrected. Walkovers and unfinished matches use their own tools.";
    case "downstream_started":
      return "A later match fed by this result has already started or finished. Correcting this result now would silently rewrite that match, so it is locked.";
    case "ranked_winner_change":
      return "This tournament counts for club Elo. Changing the winner needs a coordinated Elo recalculation by a site administrator; score-only corrections are still allowed.";
    case "team_winner_change":
      return "This is a team-event rubber. Changing its winner changes the tie result and needs a coordinated correction; score-only corrections are still allowed.";
    default:
      return `Blocked by the server (${code}).`;
  }
}

export function isKnownBlocker(code: string): boolean {
  return KNOWN_BLOCKERS.has(code);
}

export function eloEffectMessage(p: Pick<CorrectionPreview, "eloEffect">): string {
  switch (p.eloEffect) {
    case "not_ranked":
      return "No Elo effect — this tournament does not count for club Elo.";
    case "unchanged":
      return "No Elo change — the winner stays the same.";
    case "requires_recalculation":
      return "Elo would change — blocked until an administrator recalculation.";
  }
}

/** "21-19, 18-21 21–17" → ["21-19","18-21","21-17"], or an error message. */
export function parseGamesInput(text: string): { games: string[]; error: string | null } {
  const parts = text
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { games: [], error: "Enter at least one game score, e.g. 21-19, 21-17." };
  if (parts.length > 5) return { games: [], error: "At most five games can be entered." };
  const games: string[] = [];
  for (const p of parts) {
    const m = p.match(/^(\d{1,2})[-–:](\d{1,2})$/);
    if (!m) return { games: [], error: `“${p}” is not a game score. Use the form 21-19.` };
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === b) return { games: [], error: `Game ${p} cannot be tied.` };
    games.push(`${a}-${b}`);
  }
  return { games, error: null };
}

/** Side that won more games, or null when level. */
export function winnerFromGames(games: string[]): 1 | 2 | null {
  let s1 = 0;
  let s2 = 0;
  for (const g of games) {
    const [a, b] = g.split("-").map(Number);
    if (a > b) s1++;
    else if (b > a) s2++;
  }
  if (s1 === s2) return null;
  return s1 > s2 ? 1 : 2;
}

/** Blockers that apply to a proposed change (server preview + local input). */
export function blockersFor(
  preview: CorrectionPreview,
  proposedWinner: 1 | 2 | null,
): string[] {
  const out = preview.blockers.filter((b) => b === "not_completed" || b === "downstream_started" || !isKnownBlocker(b));
  const winnerChange = proposedWinner != null && proposedWinner !== preview.winnerSide;
  if (winnerChange && preview.countsForElo) out.push("ranked_winner_change");
  if (winnerChange && preview.isTeamRubber) out.push("team_winner_change");
  return Array.from(new Set(out));
}

/** Map RPC errors to a reason the dialog can act on. */
export type CorrectionFailure = "stale" | "superseded" | "downstream" | "winner_change" | "forbidden" | "other";

export function classifyCorrectionError(err: { code?: string; message?: string } | null | undefined): CorrectionFailure {
  const msg = err?.message ?? "";
  if (msg.startsWith("correction_superseded")) return "superseded";
  if (err?.code === "40001" || msg.startsWith("result_revision_conflict")) return "stale";
  if (msg.startsWith("downstream_match_started")) return "downstream";
  if (err?.code === "0A000" || msg.startsWith("winner_change_requires")) return "winner_change";
  if (err?.code === "42501") return "forbidden";
  return "other";
}

export interface AuditEventRow {
  id: number;
  action: string;
  actor_email: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  undoes_event_id: number | null;
  source: string;
  created_at: string;
}

export function auditActionLabel(action: string): string {
  switch (action) {
    case "result_correction":
      return "Result corrected";
    case "result_correction_undo":
      return "Correction undone";
    case "result_direct_edit":
      return "Result edited directly";
    case "schedule_edit":
      return "Court / time changed";
    case "schedule_override":
      return "Schedule override";
    case "seed_edit":
      return "Seed changed";
    default:
      return action.replace(/_/g, " ");
  }
}
