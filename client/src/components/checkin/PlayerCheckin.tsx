import { useMemo, useState, type ReactNode } from "react";
import { Check, Clock3, Coffee, Home, LayoutGrid } from "lucide-react";
import type { MatchView } from "@/lib/matchView";
import {
  assessMatch,
  CALLED_HOLD_MS,
  clockLabel,
  hereSummary,
  isActiveCheckin,
  isLiveStatus,
  isOnBreak,
  latestCallByMatch,
  matchPlayerIds,
  nextMatchFor,
  playerPresence,
  sideOf,
  type ReadinessMatch,
} from "@/lib/matchReadiness";
import { courtLabel } from "@/lib/matchView";
import { useCheckinAction, useTournamentReadiness, type CheckinTournament, type TournamentReadiness } from "@/hooks/queries/useCheckins";
import { PresenceChip, SmallButton } from "./CheckinBits";

/**
 * Player side of check-in: the "I'm here" panel and each match's
 * opponent/partner status. Shown on the "Your next match" card (Home and
 * above the tournament tabs) and in My matches. Manual tap only: no location.
 */

const CLOSED = new Set(["draft", "deleted", "completed", "archived"]);
const EXPIRY_WARN_MS = 10 * 60_000;

function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Match day: a match of theirs is scheduled today, or play spans today. */
export function isMatchDay(mine: ReadinessMatch[], tournament: CheckinTournament | null, now: number): boolean {
  if (!tournament || CLOSED.has(tournament.status ?? "")) return false;
  const today = localDay(new Date(now));
  if (mine.some((m) => m.scheduled_at && localDay(new Date(m.scheduled_at)) === today)) return true;
  if (tournament.status === "active") return true;
  const start = tournament.start_date ?? null;
  const end = tournament.end_date ?? tournament.start_date ?? null;
  return !!start && !!end && start <= today && today <= end;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function nameOr(names: Record<string, string>, id: string, fallback = "Player") {
  return names[id] ?? fallback;
}

function firstNames(names: Record<string, string>, ids: string[]) {
  const list = ids.map((id) => nameOr(names, id).split(" ")[0]);
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function CheckinPanel({
  data,
  tournamentId,
  myPlayerId,
}: {
  data: TournamentReadiness;
  tournamentId: string;
  myPlayerId: string;
}) {
  const action = useCheckinAction(tournamentId);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMins, setCustomMins] = useState("20");
  const { now } = data;
  const row = data.checkins.find((r) => r.player_id === myPlayerId && isActiveCheckin(r, now)) ?? null;
  const mine = data.matches.filter((m) => !["completed", "walkover", "cancelled"].includes(m.status) && matchPlayerIds(m).includes(myPlayerId));
  const codes = mine.filter((m) => !isLiveStatus(m.status)).map((m) => m.match_code).filter(Boolean) as string[];
  const busy = action.isPending;
  const act = (a: Parameters<typeof action.mutate>[0]) => action.mutate(a);

  if (!row) {
    return (
      <div className="flex flex-col gap-3 border-b border-foreground/10 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Home className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-base font-black text-foreground">Are you at the venue?</p>
            <p className="text-sm leading-snug text-soft">
              Tap when you arrive. Your opponents and the umpires will see you're ready for all your matches today.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => act({ playerId: myPlayerId, action: "check_in", label: "You're checked in" })}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-black text-primary-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
        >
          <Check className="h-5 w-5" strokeWidth={3} aria-hidden /> I'm here, ready to play
        </button>
        <p className="text-center text-xs text-muted-foreground">No location is used. Check-in lasts 4 hours and renews after each match.</p>
      </div>
    );
  }

  const expiringSoon = Date.parse(row.expires_at) - now <= EXPIRY_WARN_MS;
  const onBreak = isOnBreak(row, now);

  return (
    <div className={`flex flex-col gap-3 border-b p-4 ${onBreak ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${onBreak ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}`}>
          {onBreak ? <Coffee className="h-5 w-5" aria-hidden /> : <Check className="h-5 w-5" strokeWidth={3} aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="text-base font-black text-foreground">{onBreak ? "You're on a break" : "You're checked in"}</p>
          <p className={`text-sm leading-snug ${onBreak ? "text-foreground" : "text-foreground"}`}>
            {onBreak
              ? row.break_until
                ? `Back at ${clockLabel(row.break_until)}. Umpires see you as away until then.`
                : `Since ${clockLabel(row.break_started_at)}. Tap "I'm back" when you return.`
              : `Since ${clockLabel(row.checked_in_at)}, until ${clockLabel(row.expires_at)} (renews after each match).${
                  codes.length ? ` Umpires can see you for ${codes.join(" and ")}.` : ""
                }`}
          </p>
        </div>
      </div>

      {expiringSoon && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <span className="text-sm font-bold text-foreground">Still at the venue? Your check-in ends at {clockLabel(row.expires_at)}.</span>
          <SmallButton tone="primary" busy={busy} onClick={() => act({ playerId: myPlayerId, action: "renew" })}>
            Stay checked in
          </SmallButton>
        </div>
      )}

      {onBreak ? (
        <div className="grid grid-cols-2 gap-2">
          <SmallButton tone="primary" busy={busy} onClick={() => act({ playerId: myPlayerId, action: "back" })}>
            I'm back
          </SmallButton>
          <SmallButton busy={busy} onClick={() => act({ playerId: myPlayerId, action: "check_out", label: "Checked out. Safe travels!" })}>
            Leaving venue
          </SmallButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-success">Take a break</p>
          <div className="grid grid-cols-2 gap-1.5">
            <SmallButton tone="warning" busy={busy} onClick={() => act({ playerId: myPlayerId, action: "break", minutes: 15, label: "Break until " + clockLabel(now + 15 * 60_000) })}>
              15 min
            </SmallButton>
            <SmallButton tone="warning" busy={busy} onClick={() => act({ playerId: myPlayerId, action: "break", minutes: 30, label: "Break until " + clockLabel(now + 30 * 60_000) })}>
              30 min
            </SmallButton>
            <SmallButton tone="warning" busy={busy} onClick={() => setCustomOpen((v) => !v)}>
              Any length…
            </SmallButton>
            <SmallButton tone="warning" busy={busy} onClick={() => act({ playerId: myPlayerId, action: "break", minutes: null, label: "On a break until you're back" })}>
              Until I'm back
            </SmallButton>
          </div>
          {customOpen && (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const mins = Math.round(Number(customMins));
                if (!Number.isFinite(mins) || mins < 1 || mins > 240) return;
                act({ playerId: myPlayerId, action: "break", minutes: mins, label: "Break until " + clockLabel(now + mins * 60_000) });
                setCustomOpen(false);
              }}
            >
              <label className="flex flex-1 flex-col gap-1 text-xs font-bold text-soft">
                Minutes (1–240)
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={240}
                  value={customMins}
                  onChange={(e) => setCustomMins(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-border-strong bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
              >
                Start break
              </button>
            </form>
          )}
          <SmallButton busy={busy} onClick={() => act({ playerId: myPlayerId, action: "check_out", label: "Checked out. Safe travels!" })}>
            Leaving venue
          </SmallButton>
        </div>
      )}
    </div>
  );
}

/** One match's status for the player: court call, readiness banner, everyone's status. */
export function MatchStatusForPlayer({
  data,
  match,
  myPlayerId,
  compact = false,
}: {
  data: TournamentReadiness;
  match: ReadinessMatch;
  myPlayerId: string;
  compact?: boolean;
}) {
  const r = assessMatch(data.ctx, match);
  const lastCall = latestCallByMatch(data.calls)[match.id];
  const calledRecently = !!lastCall && data.now - Date.parse(lastCall) < CALLED_HOLD_MS && !isLiveStatus(match.status);
  const mySide = sideOf(match, myPlayerId);
  const ids = matchPlayerIds(match);
  if (ids.length < 2) return null;
  const position = data.board.ready.findIndex((m) => m.id === match.id) + 1;
  const others = r.missing.filter((id) => id !== myPlayerId);

  let banner: ReactNode = null;
  if (calledRecently) {
    banner = (
      <div className="flex items-center gap-3 rounded-2xl bg-primary p-3 text-primary-foreground">
        <LayoutGrid className="h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="text-sm font-black">Go to {match.court_number ? courtLabel(match.court_number) : "your court"}</p>
          <p className="text-xs font-semibold">Called at {clockLabel(lastCall)} by the umpire</p>
        </div>
      </div>
    );
  } else if (r.state === "ready") {
    banner = (
      <div className="flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-3">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-black text-primary">{r.total > 2 ? `All ${r.total} here` : "Both players here"}</p>
          <p className="text-xs text-soft">
            {position > 0 ? `${ordinal(position)} in line for the next free court. ` : ""}Keep your phone close for the court call.
          </p>
        </div>
      </div>
    );
  } else if (r.state === "resting") {
    banner = (
      <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-2 text-sm">
        <span className="font-black text-info">Everyone's here</span>
        <span className="text-foreground"> · resting until {clockLabel(r.restOkAt)}, then it's in the ready list</span>
      </div>
    );
  } else if (r.state === "waiting" && r.hereCount > 0) {
    banner = (
      <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
        <span className="font-black text-warning">{hereSummary(r)}</span>
        {others.length > 0 && <span className="text-foreground"> · waiting for {firstNames(data.names, others)}</span>}
      </div>
    );
  }

  const ordered = [...ids].sort((a, b) => {
    const rank = (id: string) => (id === myPlayerId ? 0 : sideOf(match, id) === mySide ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="flex flex-col gap-2">
      {banner}
      <ul className={`flex flex-col gap-2 rounded-2xl border border-border bg-background/60 ${compact ? "p-2.5" : "p-3"}`}>
        {ordered.map((id) => {
          const role = id === myPlayerId ? "You" : sideOf(match, id) === mySide ? "Partner" : "Opponent";
          const presence = playerPresence(data.ctx, id, match.id);
          return (
            <li key={id} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                {!compact && <span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{role}</span>}
                <span className="block truncate text-sm font-bold text-foreground">
                  {id === myPlayerId && compact ? "You" : nameOr(data.names, id, role)}
                  {compact && role === "Partner" && <span className="font-normal text-muted-foreground"> (partner)</span>}
                </span>
              </span>
              <PresenceChip presence={presence} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * For MyTournamentCard: the panel plus a per-match status renderer, or null
 * when check-in doesn't apply (not a match day, tournament finished, signed out).
 */
export function useMyTournamentCheckin(tournamentId: string | null | undefined, myPlayerId: string | null | undefined) {
  const data = useTournamentReadiness(tournamentId, !!tournamentId && !!myPlayerId);
  return useMemo(() => {
    if (!tournamentId || !myPlayerId || data.loading || data.error || !data.tournament) return null;
    const mine = data.matches.filter((m) => matchPlayerIds(m).includes(myPlayerId));
    const open = mine.filter((m) => !["completed", "walkover", "cancelled"].includes(m.status));
    const checkedIn = data.checkins.some((r) => r.player_id === myPlayerId && isActiveCheckin(r, data.now));
    if (open.length === 0 && !checkedIn) return null;
    if (!checkedIn && !isMatchDay(open, data.tournament, data.now)) return null;
    const byId = new Map(data.matches.map((m) => [m.id, m] as const));
    return {
      panel: <CheckinPanel data={data} tournamentId={tournamentId} myPlayerId={myPlayerId} />,
      statusFor: (view: MatchView, compact = false) => {
        const m = byId.get(view.id);
        if (!m || view.tournamentId !== tournamentId) return null;
        if (["completed", "walkover", "cancelled"].includes(m.status)) return null;
        return <MatchStatusForPlayer data={data} match={m} myPlayerId={myPlayerId} compact={compact} />;
      },
      nextMatch: nextMatchFor(data.matches, myPlayerId),
    };
  }, [data, tournamentId, myPlayerId]);
}

export type MyTournamentCheckin = NonNullable<ReturnType<typeof useMyTournamentCheckin>>;
