import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "wouter";
import { adminUpdateTournamentMatch } from "@/services/tournamentService";
import { courtLabel } from "@/lib/matchView";
import { matchPath } from "@/lib/tournamentRoutes";
import {
  assessMatch,
  callsForMatch,
  callCoversEveryone,
  clockLabel,
  hereSummary,
  isActiveCheckin,
  matchPlayerIds,
  minutesSince,
  playerPresence,
  sideOf,
  suggestCourts,
  type CourtState,
  type MatchReadiness,
  type ReadinessMatch,
} from "@/lib/matchReadiness";
import { callPlayers, useCheckinAction, type TournamentReadiness } from "@/hooks/queries/useCheckins";
import { CallButton, CheckInForThemButton, MatchCodeChip, PresenceChip, SectionTitle, SmallButton } from "./CheckinBits";

/**
 * Official (umpire / referee / organiser) check-in surfaces. Nothing here
 * starts a match or records a walkover by itself: every action is a tap.
 */

const shortCourt = (c: string) => (/^\d+$/.test(c) ? `C${c}` : c);

export function sidesLabel(m: ReadinessMatch) {
  return `${m.team1_label || "TBD"} vs ${m.team2_label || "TBD"}`;
}

function eventLine(m: ReadinessMatch) {
  return [m.category, m.round_name, m.scheduled_at ? clockLabel(m.scheduled_at) : null].filter(Boolean).join(" · ");
}

/** Officials' actions: put on court & call, call some players, check in on someone's behalf. */
export function useOfficialActions(tournamentId: string | null | undefined) {
  const qc = useQueryClient();
  const checkin = useCheckinAction(tournamentId);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["court_calls", tournamentId] });
    void qc.invalidateQueries({ queryKey: ["tournament_matches"] });
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setBusyKey(null);
      refresh();
    }
  };

  return {
    busyKey,
    checkinBusy: checkin.isPending,
    putOnCourt: (m: ReadinessMatch, court: string) =>
      run(`court:${m.id}`, async () => {
        if ((m.court_number ?? "").trim() !== court) {
          await adminUpdateTournamentMatch(m.id, { court_number: court } as never, "Put on court from the Ready list");
        }
        const res = await callPlayers(m.id);
        toast.success(`${m.match_code ?? "Match"} is on ${courtLabel(court)}`, {
          description: `Called ${res.notified ?? 0} player${res.notified === 1 ? "" : "s"} to the court.`,
        });
      }),
    call: (m: ReadinessMatch, playerIds?: string[], names?: Record<string, string>) =>
      run(`call:${m.id}:${playerIds?.join(",") ?? "all"}`, async () => {
        const res = await callPlayers(m.id, playerIds);
        const who = (res.called ?? []).map((id) => names?.[id] ?? "a player");
        toast.success(who.length ? `Called ${who.join(", ")}` : "Players called");
        if (res.on_court?.length) toast.message(`${res.on_court.length} on another court, not called`);
      }),
    checkIn: (playerId: string, name: string) =>
      checkin.mutate({ playerId, action: "check_in", label: `${name} checked in` }),
    checkOut: (playerId: string, name: string) =>
      checkin.mutate({ playerId, action: "check_out", label: `${name} checked out` }),
  };
}

export type OfficialActions = ReturnType<typeof useOfficialActions>;

// ── Courts strip ───────────────────────────────────────────────────────────

export function CourtsStrip({ courts, readyByCourt, columns = 3 }: { courts: CourtState[]; readyByCourt?: Record<string, string | null>; columns?: 2 | 3 }) {
  if (courts.length === 0) {
    return <p className="text-xs text-muted-foreground">No courts yet. Courts appear once a match is scheduled on one.</p>;
  }
  return (
    <ul className={`grid gap-1.5 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Courts">
      {courts.map((c) => (
        <li
          key={c.court}
          className={`flex min-w-0 flex-col gap-0.5 rounded-xl border p-2 ${
            c.kind === "free" ? "border-primary/70 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <strong className="truncate text-[13px] text-foreground">{courtLabel(c.court)}</strong>
          {c.kind === "free" ? (
            <span className="truncate text-xs font-black text-primary">
              Free{readyByCourt?.[c.court] ? ` · next ${readyByCourt[c.court]}` : ""}
            </span>
          ) : c.kind === "live" ? (
            <span className="truncate text-xs font-bold text-live">Live · {c.match.match_code ?? "match"}</span>
          ) : (
            <span className="truncate text-xs font-bold text-warning">Called · {c.match.match_code ?? "match"}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Ready / Waiting / Resting ──────────────────────────────────────────────

function ReadyCard({
  m,
  r,
  data,
  suggested,
  actions,
}: {
  m: ReadinessMatch;
  r: MatchReadiness;
  data: TournamentReadiness;
  suggested: string | null;
  actions: OfficialActions;
}) {
  const [court, setCourt] = useState<string | null>(null);
  const pick = court ?? suggested;
  const options = useMemo(() => {
    const list = [...data.free];
    if (suggested && !list.includes(suggested)) list.unshift(suggested);
    return list.slice(0, 4);
  }, [data.free, suggested]);
  const waited = minutesSince(r.readySince, data.now);
  return (
    <li className="space-y-2.5 rounded-2xl border border-primary/40 bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <MatchCodeChip code={m.match_code} />
        <span className="truncate text-xs text-muted-foreground">{eventLine(m)}</span>
      </div>
      <p className="text-sm font-black text-foreground">{sidesLabel(m)}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-black text-success">
          {hereSummary(r)}
          {waited != null ? ` · waiting ${waited} min` : ""}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-soft">Rest OK</span>
      </div>
      {options.length > 0 ? (
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Court" className="flex shrink-0 overflow-hidden rounded-xl border border-border-strong">
            {options.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={pick === c}
                onClick={() => setCourt(c)}
                className={`min-h-[44px] px-3 text-xs font-black ${pick === c ? "bg-primary text-primary-foreground" : "bg-card text-soft"}`}
              >
                {shortCourt(c)}
              </button>
            ))}
          </div>
          <SmallButton
            tone="primary"
            className="flex-1"
            busy={actions.busyKey === `court:${m.id}`}
            disabled={!pick}
            onClick={() => pick && actions.putOnCourt(m, pick)}
          >
            Put on {pick ? courtLabel(pick) : "a court"} &amp; call
          </SmallButton>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No court is free right now. It stays at the top of this list.</p>
      )}
    </li>
  );
}

function WaitingCard({ m, r, data, actions }: { m: ReadinessMatch; r: MatchReadiness; data: TournamentReadiness; actions: OfficialActions }) {
  const calls = callsForMatch(data.calls, m.id);
  const last = calls[calls.length - 1];
  return (
    <li className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <MatchCodeChip code={m.match_code} />
        <span className="text-xs font-black text-warning">{hereSummary(r)}</span>
      </div>
      <p className="text-sm font-black text-foreground">{sidesLabel(m)}</p>
      <ul className="space-y-1.5 text-[13px]">
        {r.players
          .filter((p) => r.missing.includes(p.playerId))
          .map((p) => (
            <li key={p.playerId} className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground">{data.names[p.playerId] ?? "Player"}</span>
              <PresenceChip presence={p.presence} />
            </li>
          ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {calls.length === 0 ? "Not called yet" : `Called ${calls.length === 1 ? "once" : `${calls.length} times`} · ${clockLabel(last.called_at)}`}
        </span>
        {r.callable.length > 0 ? (
          <CallButton busy={actions.busyKey?.startsWith(`call:${m.id}`)} onClick={() => actions.call(m, r.callable, data.names)}>
            Call missing ({r.callable.length})
          </CallButton>
        ) : (
          <span className="text-xs text-muted-foreground">Nobody to call: everyone missing is busy or on a break.</span>
        )}
      </div>
    </li>
  );
}

/** Matches worth showing as "waiting": someone is here, or they've been called. */
export function waitingWorthShowing(data: TournamentReadiness): ReadinessMatch[] {
  return data.board.waiting.filter((m) => {
    const r = data.board.byMatch[m.id];
    return (r?.hereCount ?? 0) > 0 || callsForMatch(data.calls, m.id).length > 0;
  });
}

/** Players here out of everyone with a match left today. */
export function hereCounts(data: TournamentReadiness) {
  const ids = new Set<string>();
  for (const m of data.matches) {
    if (!["scheduled", "pending", "in_progress", "playing", "live", "ongoing"].includes(m.status)) continue;
    for (const p of matchPlayerIds(m)) ids.add(p);
  }
  let here = 0;
  for (const id of ids) if (data.ctx.checkins.has(id)) here++;
  return { here, expected: ids.size };
}

/**
 * Umpire tab top block (UmpireReady mockup): courts, Ready to play, Waiting
 * for players, Resting. The existing match list continues below.
 */
export function ReadySections({ data, tournamentId, title = true }: { data: TournamentReadiness; tournamentId: string; title?: boolean }) {
  const actions = useOfficialActions(tournamentId);
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const suggested = useMemo(() => suggestCourts(data.board.ready, data.free), [data.board.ready, data.free]);
  const waiting = waitingWorthShowing(data);
  const counts = hereCounts(data);
  if (data.loading || !data.checkinsAvailable) return null;
  if (data.matches.length === 0) return null;

  return (
    <section aria-label="Check-in" className="space-y-4">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Check-in</p>
          <span className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-soft">
            {counts.here} of {counts.expected} here
          </span>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Courts</p>
        <CourtsStrip courts={data.courts} />
      </div>

      <div className="space-y-2">
        <SectionTitle dot="bg-primary" title="Ready to play" count={data.board.ready.length} />
        {data.board.ready.length === 0 ? (
          <p className="text-xs text-muted-foreground">No match has every player here yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.board.ready.map((m) => (
              <ReadyCard key={m.id} m={m} r={data.board.byMatch[m.id]} data={data} suggested={suggested[m.id] ?? null} actions={actions} />
            ))}
          </ul>
        )}
      </div>

      {waiting.length > 0 && (
        <div className="space-y-2">
          <SectionTitle dot="bg-warning" title="Waiting for players" count={waiting.length} />
          <ul className="space-y-2">
            {(showAllWaiting ? waiting : waiting.slice(0, 4)).map((m) => (
              <WaitingCard key={m.id} m={m} r={data.board.byMatch[m.id]} data={data} actions={actions} />
            ))}
          </ul>
          {waiting.length > 4 && !showAllWaiting && (
            <SmallButton className="w-full" onClick={() => setShowAllWaiting(true)}>
              Show {waiting.length - 4} more waiting
            </SmallButton>
          )}
        </div>
      )}

      {data.board.resting.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-card px-3.5 py-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" aria-hidden />
          <div className="text-[13px]">
            <strong className="text-foreground">Resting · {data.board.resting.length}</strong>
            {data.board.resting.slice(0, 3).map((m) => {
              const r = data.board.byMatch[m.id];
              const who = r.players.filter((p) => p.presence.kind === "resting");
              return (
                <span key={m.id} className="block text-soft">
                  {m.match_code ?? "Match"}: {who.map((p) => data.names[p.playerId] ?? "A player").join(", ")} can play from {clockLabel(r.restOkAt)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Selected match (Umpire tab) ────────────────────────────────────────────

/** "Who's here" box with "Check in for them" next to anyone missing. */
export function UmpireWhosHere({ data, match, tournamentId }: { data: TournamentReadiness; match: ReadinessMatch; tournamentId: string }) {
  const actions = useOfficialActions(tournamentId);
  const r = assessMatch(data.ctx, match);
  const calls = callsForMatch(data.calls, match.id);
  const last = calls[calls.length - 1];
  const ids = matchPlayerIds(match);
  if (!data.checkinsAvailable || ids.length < 2 || r.state === "not_applicable") return null;
  return (
    <div className="space-y-2 rounded-lg bg-card p-2.5">
      <div className="flex items-center justify-between">
        <strong className="text-xs text-foreground">Who's here</strong>
        <span className={`text-[11px] font-black ${r.hereCount === r.total ? "text-success" : "text-warning"}`}>
          {r.hereCount} of {r.total}
        </span>
      </div>
      <ul className="space-y-1.5">
        {[...ids]
          .sort((a, b) => sideOf(match, a) - sideOf(match, b))
          .map((id) => {
            const presence = playerPresence(data.ctx, id, match.id);
            const name = data.names[id] ?? "Player";
            return (
              <li key={id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-foreground">{name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Side {sideOf(match, id)}
                    {presence.kind === "not_here" ? " · not here yet" : ""}
                  </span>
                </span>
                {presence.kind === "not_here" ? (
                  <CheckInForThemButton name={name} busy={actions.checkinBusy} onClick={() => actions.checkIn(id, name)} />
                ) : (
                  <PresenceChip presence={presence} />
                )}
              </li>
            );
          })}
      </ul>
      {last && (
        <p className="text-[11px] text-muted-foreground">
          Called {calls.length === 1 ? "once" : `${calls.length} times`} · {clockLabel(last.called_at)} ({minutesSince(Date.parse(last.called_at), data.now)} min ago)
        </p>
      )}
    </div>
  );
}

/** Soft warning under Start: starting is still allowed. */
export function startWarning(data: TournamentReadiness, match: ReadinessMatch): string | null {
  if (!data.checkinsAvailable) return null;
  const r = assessMatch(data.ctx, match);
  if (r.state === "not_applicable" || r.state === "ready") return null;
  const missing = r.players.filter((p) => p.presence.kind !== "here" && p.presence.kind !== "resting").length;
  if (missing === 0) return null;
  return `${missing} player${missing === 1 ? " hasn't" : "s haven't"} checked in. You can still start.`;
}

export function CallMissingButton({ data, match, tournamentId }: { data: TournamentReadiness; match: ReadinessMatch; tournamentId: string }) {
  const actions = useOfficialActions(tournamentId);
  const r = assessMatch(data.ctx, match);
  if (!data.checkinsAvailable || r.state === "not_applicable" || r.callable.length === 0 || r.callable.length === r.total) return null;
  return (
    <button
      type="button"
      disabled={actions.busyKey?.startsWith(`call:${match.id}`)}
      onClick={() => actions.call(match, r.callable, data.names)}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 py-2 text-[10px] font-bold uppercase tracking-wider text-warning transition hover:bg-warning/20 disabled:opacity-50"
    >
      Call missing players ({r.callable.length})
    </button>
  );
}

// ── Walkover record ────────────────────────────────────────────────────────

/** The side whose players are all here while nobody from the other side is. */
export function walkoverHint(data: TournamentReadiness, match: ReadinessMatch): 1 | 2 | null {
  if (!data.checkinsAvailable) return null;
  const ids = matchPlayerIds(match);
  const hereOn = (side: 1 | 2) => ids.filter((id) => sideOf(match, id) === side).map((id) => data.ctx.checkins.has(id));
  const s1 = hereOn(1);
  const s2 = hereOn(2);
  if (s1.length && s1.every(Boolean) && s2.every((x) => !x)) return 1;
  if (s2.length && s2.every(Boolean) && s1.every((x) => !x)) return 2;
  return null;
}

export function WalkoverCheckinRecord({ data, match }: { data: TournamentReadiness; match: ReadinessMatch }) {
  const ids = matchPlayerIds(match);
  if (!data.checkinsAvailable || ids.length < 2) return null;
  const calls = callsForMatch(data.calls, match.id);
  const side = (s: 1 | 2) => {
    const list = ids.filter((id) => sideOf(match, id) === s);
    const here = list.filter((id) => data.ctx.checkins.has(id));
    const tone = here.length === list.length ? "text-success" : here.length === 0 ? "text-danger" : "text-warning";
    const summary =
      here.length === list.length
        ? list.length > 1 ? "both here" : "here"
        : here.length === 0
          ? "nobody checked in"
          : `${here.length} of ${list.length} here`;
    return (
      <div className="space-y-1.5">
        <p className={`text-[11px] font-black uppercase tracking-wider ${tone}`}>
          Side {s} · {summary}
        </p>
        {list.map((id) => {
          const row = data.checkins.find((c) => c.player_id === id && isActiveCheckin(c, data.now));
          const presence = playerPresence(data.ctx, id, match.id);
          return (
            <div key={id} className="flex justify-between gap-2 text-[13px]">
              <span className="truncate text-foreground">{data.names[id] ?? "Player"}</span>
              <span className={`shrink-0 font-bold ${row ? "text-success" : "text-muted-foreground"}`}>
                {row
                  ? presence.kind === "break"
                    ? "On a break"
                    : `Here since ${clockLabel(row.checked_in_at)}`
                  : "Not checked in today"}
              </span>
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-background p-3.5 text-left">
      <strong className="text-sm text-foreground">Check-in record</strong>
      {side(1)}
      <div className="h-px bg-muted" />
      {side(2)}
      <div className="h-px bg-muted" />
      <div className="space-y-1 text-[13px]">
        <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Calls to court</p>
        {calls.length === 0 ? (
          <p className="text-muted-foreground">No calls yet</p>
        ) : (
          calls.map((c) => (
            <div key={c.id} className="flex justify-between">
              <span className="text-foreground">{clockLabel(c.called_at)}</span>
              <span className="text-muted-foreground">{callCoversEveryone(c, match) ? "Everyone called" : "Missing players called"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Organiser: Who's here roster ───────────────────────────────────────────

export function OpenMatchLink({ tournamentId, matchId, children }: { tournamentId: string; matchId: string; children: React.ReactNode }) {
  return (
    <Link href={matchPath(tournamentId, matchId)} className="inline-flex min-h-[44px] items-center rounded-xl border border-border-strong px-3 text-xs font-black text-foreground hover:bg-muted">
      {children}
    </Link>
  );
}
