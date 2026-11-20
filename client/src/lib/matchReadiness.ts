/**
 * Player check-in readiness: one pure model every surface uses (player card,
 * match page, umpire Ready list, organiser board, spectator chip), so they
 * never disagree. No React, no Supabase.
 *
 * A match is READY when:
 *   1. both sides are known (no TBD, no bye) and it is waiting to be played
 *      (scheduled / pending, not live, finished or a walkover);
 *   2. every player in it is checked in (row not expired) and not on a break;
 *   3. none of them is playing another match right now;
 *   4. each has had the tournament's rest time since their last finished
 *      match (lib/restConflicts.ts `restEndsAt`).
 * Ready matches are queued like the court queue (lib/matchView.ts and
 * supabase/functions/_shared/courtQueue.ts): scheduled time (nulls last),
 * round, match number.
 *
 * The SQL twin is tournament_checkin_readiness() in migration
 * 20261120160000; `allHere` (rules 1–3) is what spectators see as
 * "Both sides here", `ready` (1–4) drives the umpire push.
 *
 * Expired check-ins are ignored here, so a late clean-up job can't show
 * someone as present. A timed break that has run out counts as "here".
 */

import { LIVE_STATUSES } from "@/lib/matchView";
import { DEFAULT_MIN_REST_MINS, restEndsAt } from "@/lib/restConflicts";

export interface CheckinRow {
  tournament_id: string;
  player_id: string;
  state: "here" | "break";
  checked_in_at: string;
  break_until: string | null;
  break_started_at?: string | null;
  here_since?: string | null;
  checked_in_by?: string | null;
  expires_at: string;
}

export interface CourtCallRow {
  id: string;
  match_id: string;
  called_at: string;
  called_by?: string | null;
  /** Who was called; null on older rows means everyone in the match. */
  player_ids?: string[] | null;
}

/** The match columns readiness needs (a subset of MatchRow). */
export interface ReadinessMatch {
  id: string;
  status: string;
  match_code?: string | null;
  category?: string | null;
  round?: number | null;
  round_name?: string | null;
  match_number?: number | null;
  scheduled_at: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  court_number?: string | null;
  team1_label?: string | null;
  team2_label?: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player3_id?: string | null;
  player4_id?: string | null;
}

export type PlayerPresence =
  | { kind: "on_court"; matchId: string; matchCode: string | null; court: string | null }
  | { kind: "break"; until: string | null; since: string | null }
  | { kind: "resting"; until: string; since: string }
  | { kind: "here"; since: string }
  | { kind: "not_here" };

export type ReadinessState = "ready" | "resting" | "waiting" | "not_applicable";

export interface MatchPlayerStatus {
  playerId: string;
  side: 1 | 2;
  presence: PlayerPresence;
}

export interface MatchReadiness {
  matchId: string;
  state: ReadinessState;
  /** Every player checked in, not on a break, not on court elsewhere. Spectators see this. */
  allHere: boolean;
  players: MatchPlayerStatus[];
  hereCount: number;
  total: number;
  /** Players keeping the match from being ready (any reason, including rest). */
  missing: string[];
  /** Missing players an official can call: not checked in (not on court, not on a declared break). */
  callable: string[];
  /** When the match became ready (epoch ms), if it is. */
  readySince: number | null;
  /** For a resting match: when the last player's rest ends (epoch ms). */
  restOkAt: number | null;
}

export interface ReadinessOptions {
  now?: number;
  minRestMinutes?: number | null;
}

export interface ReadinessContext {
  now: number;
  minRestMinutes: number;
  matches: ReadinessMatch[];
  /** Unexpired rows by player id. Built in memory, never cached by react-query. */
  checkins: Map<string, CheckinRow>;
  liveByPlayer: Map<string, ReadinessMatch>;
  restEnds: Map<string, number | null>;
}

const BYE_RE = /\bbye\b/i;
const TBD_RE = /^\s*tbd\s*$/i;
const WAITING = new Set(["scheduled", "pending"]);

export const isLiveStatus = (status: string | null | undefined) => LIVE_STATUSES.has((status ?? "").toLowerCase());

export function matchPlayerIds(m: ReadinessMatch): string[] {
  return [m.player1_id, m.player2_id, m.player3_id ?? null, m.player4_id ?? null].filter(
    (x): x is string => !!x && x !== "assigned",
  );
}

export function sideOf(m: ReadinessMatch, playerId: string): 1 | 2 {
  return m.player1_id === playerId || m.player3_id === playerId ? 1 : 2;
}

const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN);

/** A row counts only until it expires. */
export function isActiveCheckin(row: CheckinRow, now: number): boolean {
  const exp = ts(row.expires_at);
  return Number.isFinite(exp) && exp > now;
}

/** On a break right now (a timed break that has run out is over). */
export function isOnBreak(row: CheckinRow, now: number): boolean {
  if (row.state !== "break") return false;
  if (!row.break_until) return true;
  return ts(row.break_until) > now;
}

export function buildReadinessContext(
  matches: ReadinessMatch[],
  checkins: CheckinRow[],
  opts: ReadinessOptions = {},
): ReadinessContext {
  const now = opts.now ?? Date.now();
  const minRestMinutes = opts.minRestMinutes ?? DEFAULT_MIN_REST_MINS;
  const active = new Map<string, CheckinRow>();
  for (const row of Array.isArray(checkins) ? checkins : []) {
    if (isActiveCheckin(row, now)) active.set(row.player_id, row);
  }
  const liveByPlayer = new Map<string, ReadinessMatch>();
  for (const m of matches) {
    if (!isLiveStatus(m.status)) continue;
    for (const p of matchPlayerIds(m)) liveByPlayer.set(p, m);
  }
  return { now, minRestMinutes, matches, checkins: active, liveByPlayer, restEnds: new Map() };
}

function restEnd(ctx: ReadinessContext, playerId: string): number | null {
  if (!ctx.restEnds.has(playerId)) ctx.restEnds.set(playerId, restEndsAt(playerId, ctx.matches, ctx.minRestMinutes));
  return ctx.restEnds.get(playerId) ?? null;
}

/**
 * A player's status. `forMatchId` is the match being looked at: being live on
 * that very match is not "on court elsewhere".
 */
export function playerPresence(ctx: ReadinessContext, playerId: string, forMatchId?: string): PlayerPresence {
  const live = ctx.liveByPlayer.get(playerId);
  if (live && live.id !== forMatchId) {
    return { kind: "on_court", matchId: live.id, matchCode: live.match_code ?? null, court: live.court_number?.trim() || null };
  }
  const row = ctx.checkins.get(playerId);
  if (!row) return { kind: "not_here" };
  if (isOnBreak(row, ctx.now)) {
    return { kind: "break", until: row.break_until, since: row.break_started_at ?? null };
  }
  // A timed break that ran out: here again since the break ended.
  const since =
    row.state === "break" && row.break_until ? row.break_until : row.here_since ?? row.checked_in_at;
  const rest = restEnd(ctx, playerId);
  if (rest != null && rest > ctx.now) {
    return { kind: "resting", until: new Date(rest).toISOString(), since };
  }
  return { kind: "here", since };
}

export const isPresent = (p: PlayerPresence) => p.kind === "here" || p.kind === "resting";

/** Waiting to be played with both sides known (no TBD, no bye). */
export function isAssessable(m: ReadinessMatch): boolean {
  if (!WAITING.has((m.status ?? "").toLowerCase())) return false;
  if (!m.player1_id || !m.player2_id) return false;
  for (const label of [m.team1_label, m.team2_label]) {
    if (label && (BYE_RE.test(label) || TBD_RE.test(label))) return false;
  }
  return true;
}

export function assessMatch(ctx: ReadinessContext, m: ReadinessMatch): MatchReadiness {
  const ids = matchPlayerIds(m);
  const players: MatchPlayerStatus[] = ids.map((playerId) => ({
    playerId,
    side: sideOf(m, playerId),
    presence: playerPresence(ctx, playerId, m.id),
  }));
  const hereCount = players.filter((p) => isPresent(p.presence)).length;
  const base = {
    matchId: m.id,
    players,
    hereCount,
    total: players.length,
  };
  if (!isAssessable(m)) {
    return { ...base, state: "not_applicable", allHere: false, missing: [], callable: [], readySince: null, restOkAt: null };
  }
  const allHere = players.length > 0 && hereCount === players.length;
  const resting = players.filter((p) => p.presence.kind === "resting");
  const missing = players.filter((p) => p.presence.kind !== "here").map((p) => p.playerId);
  const callable = players.filter((p) => p.presence.kind === "not_here").map((p) => p.playerId);

  if (allHere && resting.length === 0) {
    const since = Math.max(
      ...players.map((p) => (p.presence.kind === "here" ? ts(p.presence.since) : Number.NEGATIVE_INFINITY)),
      ...players.map((p) => restEnd(ctx, p.playerId) ?? Number.NEGATIVE_INFINITY),
    );
    return { ...base, state: "ready", allHere, missing: [], callable: [], readySince: Number.isFinite(since) ? since : ctx.now, restOkAt: null };
  }
  if (allHere) {
    const restOkAt = Math.max(...resting.map((p) => ts((p.presence as { until: string }).until)));
    return { ...base, state: "resting", allHere, missing, callable, readySince: null, restOkAt };
  }
  return { ...base, state: "waiting", allHere, missing, callable, readySince: null, restOkAt: null };
}

/** Court-queue order (courtQueue.ts compareQueue without the live bucket). */
export function compareQueueOrder(a: ReadinessMatch, b: ReadinessMatch): number {
  const ta = a.scheduled_at ? Date.parse(a.scheduled_at) : Number.POSITIVE_INFINITY;
  const tb = b.scheduled_at ? Date.parse(b.scheduled_at) : Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  if ((a.round ?? 0) !== (b.round ?? 0)) return (a.round ?? 0) - (b.round ?? 0);
  return (a.match_number ?? 0) - (b.match_number ?? 0);
}

export interface ReadinessBoard {
  /** Every assessable match, by id. Plain object so it can be passed around freely. */
  byMatch: Record<string, MatchReadiness>;
  ready: ReadinessMatch[];
  waiting: ReadinessMatch[];
  resting: ReadinessMatch[];
}

/** Ready / waiting / resting lists, each in court-queue order. */
export function buildReadinessBoard(ctx: ReadinessContext): ReadinessBoard {
  const byMatch: Record<string, MatchReadiness> = {};
  const ready: ReadinessMatch[] = [];
  const waiting: ReadinessMatch[] = [];
  const resting: ReadinessMatch[] = [];
  for (const m of [...ctx.matches].sort(compareQueueOrder)) {
    const r = assessMatch(ctx, m);
    if (r.state === "not_applicable") continue;
    byMatch[m.id] = r;
    if (r.state === "ready") ready.push(m);
    else if (r.state === "resting") resting.push(m);
    else waiting.push(m);
  }
  return { byMatch, ready, waiting, resting };
}

// ── Courts ─────────────────────────────────────────────────────────────────

/** A court whose match was called this recently counts as taken, not free. */
export const CALLED_HOLD_MS = 15 * 60_000;

export type CourtState =
  | { court: string; kind: "live"; match: ReadinessMatch }
  | { court: string; kind: "called"; match: ReadinessMatch; calledAt: string }
  | { court: string; kind: "free" };

const normCourt = (c: string | null | undefined) => (c ?? "").trim();

/**
 * Courts strip. The tournament's courts are those any of its matches is
 * scheduled on; free = not live and not holding a match called in the last
 * 15 minutes. Sorted naturally (Court 2 before Court 10).
 */
export function courtBoard(matches: ReadinessMatch[], calls: CourtCallRow[], now: number = Date.now()): CourtState[] {
  const courts = Array.from(new Set(matches.map((m) => normCourt(m.court_number)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const lastCall = latestCallByMatch(calls);
  return courts.map((court): CourtState => {
    const onCourt = matches.filter((m) => normCourt(m.court_number) === court);
    const live = onCourt.find((m) => isLiveStatus(m.status));
    if (live) return { court, kind: "live", match: live };
    const called = onCourt
      .filter((m) => WAITING.has((m.status ?? "").toLowerCase()))
      .map((m) => ({ m, at: lastCall[m.id] }))
      .filter((x) => x.at && now - Date.parse(x.at) < CALLED_HOLD_MS)
      .sort((a, b) => Date.parse(b.at!) - Date.parse(a.at!))[0];
    if (called) return { court, kind: "called", match: called.m, calledAt: called.at! };
    return { court, kind: "free" };
  });
}

export function freeCourts(board: CourtState[]): string[] {
  return board.filter((c) => c.kind === "free").map((c) => c.court);
}

/** Latest call time per match id (ISO). */
export function latestCallByMatch(calls: CourtCallRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of Array.isArray(calls) ? calls : []) {
    if (!out[c.match_id] || Date.parse(c.called_at) > Date.parse(out[c.match_id])) out[c.match_id] = c.called_at;
  }
  return out;
}

export function callsForMatch(calls: CourtCallRow[], matchId: string): CourtCallRow[] {
  return (Array.isArray(calls) ? calls : [])
    .filter((c) => c.match_id === matchId)
    .sort((a, b) => Date.parse(a.called_at) - Date.parse(b.called_at));
}

/** "Everyone called" for a call that went to the whole match, else who. */
export function callCoversEveryone(call: CourtCallRow, m: ReadinessMatch): boolean {
  if (!call.player_ids) return true;
  const ids = matchPlayerIds(m);
  return ids.every((id) => call.player_ids!.includes(id));
}

/**
 * Suggested court for a ready match: its own court if free, else the first
 * free court not already suggested for a match higher in the queue.
 */
export function suggestCourts(ready: ReadinessMatch[], free: string[]): Record<string, string | null> {
  const left = [...free];
  const out: Record<string, string | null> = {};
  for (const m of ready) {
    const own = normCourt(m.court_number);
    const idx = own ? left.indexOf(own) : -1;
    if (idx >= 0) {
      out[m.id] = left.splice(idx, 1)[0];
    } else {
      out[m.id] = left.shift() ?? null;
    }
  }
  return out;
}

// ── Players ────────────────────────────────────────────────────────────────

/** A player's next open match in court-queue order (the SQL twin is tournament_player_next_match). */
export function nextMatchFor(matches: ReadinessMatch[], playerId: string): ReadinessMatch | null {
  return (
    matches
      .filter((m) => WAITING.has((m.status ?? "").toLowerCase()) && matchPlayerIds(m).includes(playerId))
      .sort(compareQueueOrder)[0] ?? null
  );
}

/** Every player with an open (or live) match, for the "Who's here" roster. */
export function rosterPlayerIds(matches: ReadinessMatch[]): string[] {
  const ids = new Set<string>();
  for (const m of matches) {
    const s = (m.status ?? "").toLowerCase();
    if (!WAITING.has(s) && !isLiveStatus(s)) continue;
    for (const p of matchPlayerIds(m)) ids.add(p);
  }
  return Array.from(ids);
}

/** Roster order: people who aren't here first (they need action), then breaks, then the rest. */
export function rosterRank(p: PlayerPresence): number {
  switch (p.kind) {
    case "not_here":
      return 0;
    case "break":
      return 1;
    case "on_court":
      return 2;
    case "resting":
      return 3;
    default:
      return 4;
  }
}

// ── Labels ─────────────────────────────────────────────────────────────────

export function clockLabel(iso: string | number | null | undefined): string {
  if (iso == null) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** Short status text, as on the mockups: "Here · 4:11 pm", "On court · MS_R2_01 · C3". */
export function presenceLabel(p: PlayerPresence, opts: { withTime?: boolean } = {}): string {
  const withTime = opts.withTime ?? true;
  switch (p.kind) {
    case "on_court": {
      const court = p.court ? (/^\d+$/.test(p.court) ? `C${p.court}` : p.court) : null;
      return ["On court", p.matchCode, court].filter(Boolean).join(" · ");
    }
    case "break":
      return p.until ? `On a break · back ${clockLabel(p.until)}` : p.since ? `On a break · since ${clockLabel(p.since)}` : "On a break";
    case "resting":
      return `Resting · free ${clockLabel(p.until)}`;
    case "here":
      return withTime ? `Here · ${clockLabel(p.since)}` : "Here";
    default:
      return "Not here yet";
  }
}

/** Visual tone for a presence chip. */
export function presenceTone(p: PlayerPresence): "here" | "court" | "break" | "rest" | "none" {
  switch (p.kind) {
    case "here":
      return "here";
    case "on_court":
      return "court";
    case "break":
      return "break";
    case "resting":
      return "rest";
    default:
      return "none";
  }
}

/** What a spectator may see: a flag only, never who or why. */
export function spectatorLabel(ready: boolean): string {
  return ready ? "Both sides here" : "Waiting for players";
}

/** "2 of 4 here" / "All here" summary. */
export function hereSummary(r: MatchReadiness): string {
  if (r.total > 0 && r.hereCount === r.total) return r.total > 2 ? `All ${r.total} here` : "All here";
  return `${r.hereCount} of ${r.total} here`;
}

export function minutesSince(epochMs: number | null, now: number = Date.now()): number | null {
  if (epochMs == null || !Number.isFinite(epochMs)) return null;
  return Math.max(0, Math.round((now - epochMs) / 60_000));
}

// ── Match timeline (signed-in match page, walkover sheet) ───────────────────

export type TimelineEvent =
  | { at: string; kind: "checked_in"; playerId: string }
  | { at: string; kind: "ready" }
  | { at: string; kind: "called"; everyone: boolean; playerIds: string[] | null; court: string | null };

/**
 * Check-in and call events for one match, oldest first. Check-in history is
 * the current rows only (a check-out clears it), which is what the
 * no-show decision needs: who is here now, and since when.
 */
export function matchTimeline(ctx: ReadinessContext, m: ReadinessMatch, calls: CourtCallRow[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const id of matchPlayerIds(m)) {
    const row = ctx.checkins.get(id);
    if (row) events.push({ at: row.checked_in_at, kind: "checked_in", playerId: id });
  }
  const r = assessMatch(ctx, m);
  if (r.state === "ready" && r.readySince != null) events.push({ at: new Date(r.readySince).toISOString(), kind: "ready" });
  for (const c of callsForMatch(calls, m.id)) {
    events.push({
      at: c.called_at,
      kind: "called",
      everyone: callCoversEveryone(c, m),
      playerIds: c.player_ids ?? null,
      court: m.court_number?.trim() || null,
    });
  }
  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
