import { compareUpcoming, type MatchView } from "@/lib/matchView";

/**
 * Personalised Home rail (FotMob favourites, plan item 11). Pure ordering and
 * de-duplication over tournament matches from three sources: my matches,
 * followed players' matches and followed tournaments' matches.
 *
 * Order: my live → my next → followed players live → followed tournaments
 * live → followed players next → recent results (48 h) for me and followed
 * players. A match appears once, under its highest-priority reason.
 */

export type RailReason =
  | "my-live"
  | "my-next"
  | "player-live"
  | "tournament-live"
  | "player-next"
  | "recent";

export interface RailItem {
  view: MatchView;
  reason: RailReason;
  /** Short heading, e.g. "You're on court", "Following Asha". */
  label: string;
}

export const RAIL_MAX = 6;
export const RECENT_MS = 48 * 60 * 60 * 1000;

const PRIORITY: RailReason[] = ["my-live", "my-next", "player-live", "tournament-live", "player-next", "recent"];

export interface RailContext {
  myId: string | null;
  followedPlayers: Record<string, string>; // id → name
  followedTournaments: string[];
  now: number;
}

export function involvedInMatch(v: MatchView, ids: Iterable<string>): string | null {
  const set = new Set(ids);
  for (const s of v.sides) for (const id of s.playerIds) if (set.has(id)) return id;
  return null;
}

function isUpcoming(v: MatchView) {
  return v.state === "scheduled" || v.state === "unscheduled";
}

function isRecent(v: MatchView, now: number) {
  if (v.state !== "completed" && v.state !== "walkover") return false;
  const t = v.endedAt ? Date.parse(v.endedAt) : NaN;
  return Number.isFinite(t) && now - t <= RECENT_MS && t <= now + 60_000;
}

export function buildHomeRail(views: MatchView[], ctx: RailContext, max = RAIL_MAX): RailItem[] {
  const followIds = Object.keys(ctx.followedPlayers);
  const tSet = new Set(ctx.followedTournaments);
  const best = new Map<string, RailItem>();

  const offer = (v: MatchView, reason: RailReason, label: string) => {
    const cur = best.get(v.id);
    if (!cur || PRIORITY.indexOf(reason) < PRIORITY.indexOf(cur.reason)) best.set(v.id, { view: v, reason, label });
  };

  // My next match: only the earliest one, so the rail isn't a fixture list.
  const mine = ctx.myId ? views.filter((v) => involvedInMatch(v, [ctx.myId!])) : [];
  const myNext = mine.filter(isUpcoming).sort(compareUpcoming)[0];

  for (const v of views) {
    const me = ctx.myId ? involvedInMatch(v, [ctx.myId]) : null;
    const followed = involvedInMatch(v, followIds);
    const followedName = followed ? ctx.followedPlayers[followed] : null;
    if (v.state === "live") {
      if (me) offer(v, "my-live", "You're on court");
      if (followed) offer(v, "player-live", `Following ${followedName}`);
      if (tSet.has(v.tournamentId)) offer(v, "tournament-live", "Followed tournament");
    } else if (isUpcoming(v)) {
      if (me && myNext?.id === v.id) offer(v, "my-next", "Your next match");
      if (followed) offer(v, "player-next", `Following ${followedName}`);
    } else if (isRecent(v, ctx.now) && (me || followed)) {
      offer(v, "recent", me ? "Your result" : `Following ${followedName}`);
    }
  }

  // Within a reason: live by court queue order, upcoming soonest first, recent newest first.
  const within = (a: RailItem, b: RailItem) => {
    if (a.reason === "recent") return (Date.parse(b.view.endedAt ?? "") || 0) - (Date.parse(a.view.endedAt ?? "") || 0);
    return compareUpcoming(a.view, b.view) || a.view.id.localeCompare(b.view.id);
  };

  return Array.from(best.values())
    .sort((a, b) => PRIORITY.indexOf(a.reason) - PRIORITY.indexOf(b.reason) || within(a, b))
    .slice(0, max);
}

export interface MyTournamentSummary {
  primary: MatchView;
  /** Other live or upcoming entries, preserving discipline and schedule order. */
  otherMatches: MatchView[];
}

/** Select the player's immediate tournament action without hiding other entries. */
export function buildMyTournamentSummary(views: MatchView[], myId: string | null): MyTournamentSummary | null {
  if (!myId) return null;
  const mine = views.filter((v) => involvedInMatch(v, [myId]));
  const live = mine.filter((v) => v.state === "live").sort(compareUpcoming);
  const upcoming = mine.filter(isUpcoming).sort(compareUpcoming);
  const primary = live[0] ?? upcoming[0];
  if (!primary) return null;
  return {
    primary,
    otherMatches: [...live.slice(1), ...upcoming.filter((v) => v.id !== primary.id)],
  };
}
