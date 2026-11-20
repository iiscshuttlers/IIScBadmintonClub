import { useEffect, useRef } from "react";
import { LayoutGrid } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { courtLabel } from "@/lib/matchView";
import {
  CALLED_HOLD_MS,
  assessMatch,
  clockLabel,
  isActiveCheckin,
  isLiveStatus,
  latestCallByMatch,
  matchPlayerIds,
  matchTimeline,
  playerPresence,
  presenceTone,
  sideOf,
  type TimelineEvent,
} from "@/lib/matchReadiness";
import { useCheckinAction, useTournamentReadiness, type TournamentReadiness } from "@/hooks/queries/useCheckins";
import { PresenceChip } from "./CheckinBits";

const RING: Record<ReturnType<typeof presenceTone>, string> = {
  here: "ring-emerald-400",
  court: "ring-cyan-300",
  break: "ring-amber-300",
  rest: "ring-violet-300",
  none: "ring-slate-700",
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function eventText(e: TimelineEvent, data: TournamentReadiness, myPlayerId: string | null, total: number): string {
  switch (e.kind) {
    case "checked_in":
      return e.playerId === myPlayerId ? "You checked in" : `${data.names[e.playerId] ?? "A player"} checked in`;
    case "ready":
      return `${total > 2 ? "All players" : "Both players"} here, so the match is in the umpires' Ready list`;
    case "called":
      if (e.everyone) return `Called to ${e.court ? courtLabel(e.court) : "court"}`;
      return `${(e.playerIds ?? []).map((id) => (id === myPlayerId ? "You" : data.names[id] ?? "A player")).join(", ")} called`;
  }
}

/**
 * Match page: who's here for this match, plus check-in and call times.
 * Signed-in viewers only; signed-out viewers never see names or times.
 * Opening the "Still at the venue?" push (…?checkin=renew) renews the
 * viewer's check-in with that one tap.
 */
export function MatchWhosHere({ tournamentId, matchId }: { tournamentId: string; matchId: string }) {
  const { session, profile } = useAuth();
  const myPlayerId = profile?.id ?? null;
  const data = useTournamentReadiness(tournamentId, !!session);
  const action = useCheckinAction(tournamentId);
  const renewed = useRef(false);

  const myRow = myPlayerId ? data.checkins.find((r) => r.player_id === myPlayerId) ?? null : null;
  useEffect(() => {
    if (renewed.current || !myPlayerId || data.loading) return;
    let params: URLSearchParams;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return;
    }
    if (params.get("checkin") !== "renew") return;
    renewed.current = true;
    const active = !!myRow && isActiveCheckin(myRow, Date.now());
    action.mutate({
      playerId: myPlayerId,
      action: active ? "renew" : "check_in",
      label: active ? "You're still checked in" : "You're checked in again",
    });
    params.delete("checkin");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [myPlayerId, data.loading, myRow, action]);

  if (!session) return null;
  const match = data.matches.find((m) => m.id === matchId);
  if (!match) return null;
  if (!["scheduled", "pending"].includes(match.status) && !isLiveStatus(match.status)) return null;
  const ids = matchPlayerIds(match);
  if (ids.length < 2) return null;

  const r = assessMatch(data.ctx, match);
  const events = matchTimeline(data.ctx, match, data.calls);
  const lastCall = latestCallByMatch(data.calls)[match.id];
  const called = !!lastCall && data.now - Date.parse(lastCall) < CALLED_HOLD_MS && !isLiveStatus(match.status);
  const ordered = [...ids].sort((a, b) => sideOf(match, a) - sideOf(match, b));

  return (
    <div className="space-y-3">
      {called && (
        <div className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground">
          <LayoutGrid className="h-6 w-6 shrink-0" aria-hidden />
          <div>
            <p className="text-base font-black">Go to {match.court_number ? courtLabel(match.court_number) : "your court"}</p>
            <p className="text-sm font-semibold">Called at {clockLabel(lastCall)} by the umpire</p>
          </div>
        </div>
      )}
      <section aria-labelledby="whos-here-heading" className="rounded-3xl border border-slate-800 bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="whos-here-heading" className="text-base font-black text-white">Who's here</h2>
          <span className={`text-xs font-black ${r.hereCount === r.total ? "text-emerald-300" : "text-amber-300"}`}>
            {r.hereCount} of {r.total}
          </span>
        </div>
        <ul className={`grid gap-2.5 ${ordered.length > 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {ordered.map((id) => {
            const presence = isLiveStatus(match.status) ? null : playerPresence(data.ctx, id, match.id);
            const name = data.names[id] ?? "Player";
            return (
              <li key={id} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-2 py-3 text-center">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-base font-black text-white ring-[3px] ${
                    RING[presence ? presenceTone(presence) : "court"]
                  }`}
                  aria-hidden
                >
                  {initials(name) || "?"}
                </span>
                <span className="w-full truncate text-sm font-bold text-white">
                  {id === myPlayerId ? `${name} (you)` : name}
                </span>
                {presence ? (
                  <PresenceChip presence={presence} />
                ) : (
                  <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-black text-cyan-300">Playing</span>
                )}
              </li>
            );
          })}
        </ul>
        {events.length > 0 && (
          <ol className="space-y-2 border-t border-slate-800 pt-3" aria-label="Check-in and call times">
            {events.map((e, i) => (
              <li key={`${e.kind}-${i}`} className="flex gap-3 text-sm">
                <span className="w-16 shrink-0 text-slate-400 tabular-nums">{clockLabel(e.at)}</span>
                <span className={e.kind === "called" ? "font-bold text-primary" : "text-slate-100"}>
                  {eventText(e, data, myPlayerId, r.total)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
