import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { courtLabel } from "@/lib/matchView";
import {
  clockLabel,
  matchPlayerIds,
  minutesSince,
  nextMatchFor,
  playerPresence,
  rosterPlayerIds,
  rosterRank,
  suggestCourts,
  type PlayerPresence,
} from "@/lib/matchReadiness";
import type { TournamentReadiness } from "@/hooks/queries/useCheckins";
import { CallButton, MatchCodeChip, PresenceChip, SmallButton } from "./CheckinBits";
import { CourtsStrip, hereCounts, sidesLabel, useOfficialActions, waitingWorthShowing } from "./OfficialBoard";

/**
 * Organiser panel pieces (OrganiserBoard mockup): new stat cards, courts with
 * the ready queue, and the "Who's here" roster with check-in on behalf.
 */

export function CheckinStatCards({ data }: { data: TournamentReadiness }) {
  const { here, expected } = hereCounts(data);
  const items = [
    { label: "Players here", value: `${here}`, sub: `/ ${expected}`, tone: "text-success" },
    { label: "Ready to play", value: `${data.board.ready.length}`, tone: "text-primary" },
    { label: "Waiting for players", value: `${waitingWorthShowing(data).length}`, tone: "text-warning" },
    { label: "Free courts", value: `${data.free.length}`, sub: `/ ${data.courts.length}`, tone: "text-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Check-in at a glance">
      {items.map((i) => (
        <div key={i.label} className="rounded-2xl border border-border bg-card p-3">
          <p className="text-[11px] font-bold text-muted-foreground">{i.label}</p>
          <p className={`text-2xl font-black leading-tight ${i.tone}`}>
            {i.value}
            {i.sub && <span className="text-sm font-bold text-muted-foreground"> {i.sub}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CourtsAndQueue({ data, tournamentId }: { data: TournamentReadiness; tournamentId: string }) {
  const actions = useOfficialActions(tournamentId);
  const suggested = useMemo(() => suggestCourts(data.board.ready, data.free), [data.board.ready, data.free]);
  const readyByCourt = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const m of data.board.ready) {
      const c = suggested[m.id];
      if (c && !out[c]) out[c] = m.match_code ?? null;
    }
    return out;
  }, [data.board.ready, suggested]);
  const waiting = waitingWorthShowing(data).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="space-y-2 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h3 className="text-sm font-black text-foreground">Courts</h3>
        <CourtsStrip courts={data.courts} readyByCourt={readyByCourt} columns={2} />
      </div>
      <div className="space-y-2 rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h3 className="text-sm font-black text-foreground">Ready queue</h3>
        {data.board.ready.length === 0 && waiting.length === 0 ? (
          <p className="text-xs text-muted-foreground">Matches appear here as players check in.</p>
        ) : (
          <ul className="space-y-2">
            {data.board.ready.map((m) => {
              const r = data.board.byMatch[m.id];
              const c = suggested[m.id];
              return (
                <li key={m.id} className="space-y-1.5 rounded-xl border border-primary/40 bg-background/60 p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <MatchCodeChip code={m.match_code} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{sidesLabel(m)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black text-success">
                      {r.total > 2 ? `All ${r.total} here` : "All here"} · {minutesSince(r.readySince, data.now)} min
                    </span>
                    {c ? (
                      <SmallButton tone="primary" busy={actions.busyKey === `court:${m.id}`} onClick={() => actions.putOnCourt(m, c)}>
                        Put on {courtLabel(c)}
                      </SmallButton>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No court free</span>
                    )}
                  </div>
                </li>
              );
            })}
            {waiting.map((m) => {
              const r = data.board.byMatch[m.id];
              const why = r.players
                .filter((p) => r.missing.includes(p.playerId))
                .map((p) => `${(data.names[p.playerId] ?? "Player").split(" ")[0]} ${shortReason(p.presence)}`)
                .join(", ");
              return (
                <li key={m.id} className="space-y-1.5 rounded-xl border border-border bg-background/60 p-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <MatchCodeChip code={m.match_code} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{sidesLabel(m)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-warning">
                    {r.hereCount} of {r.total} · {why}
                  </span>
                  {r.callable.length > 0 && (
                    <CallButton busy={actions.busyKey?.startsWith(`call:${m.id}`)} onClick={() => actions.call(m, r.callable, data.names)}>
                      Call missing
                    </CallButton>
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function shortReason(p: PlayerPresence): string {
  switch (p.kind) {
    case "on_court":
      return p.court ? `on ${/^\d+$/.test(p.court) ? `C${p.court}` : p.court}` : "on court";
    case "break":
      return "on a break";
    case "resting":
      return "resting";
    case "not_here":
      return "not here";
    default:
      return "";
  }
}

type RosterFilter = "all" | "here" | "not_here" | "break";

export function WhosHereRoster({ data, tournamentId }: { data: TournamentReadiness; tournamentId: string }) {
  const actions = useOfficialActions(tournamentId);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<RosterFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const entries = useMemo(() => {
    return rosterPlayerIds(data.matches)
      .map((id) => {
        const presence = playerPresence(data.ctx, id);
        const next = nextMatchFor(data.matches, id);
        return { id, name: data.names[id] ?? "Player", presence, next };
      })
      .sort((a, b) => rosterRank(a.presence) - rosterRank(b.presence) || a.name.localeCompare(b.name));
  }, [data.matches, data.ctx, data.names]);

  const counts = useMemo(() => {
    const c = { all: entries.length, here: 0, not_here: 0, break: 0 };
    for (const e of entries) {
      if (e.presence.kind === "not_here") c.not_here++;
      else if (e.presence.kind === "break") c.break++;
      else if (e.presence.kind === "here" || e.presence.kind === "resting") c.here++;
    }
    return c;
  }, [entries]);

  const shown = entries.filter((e) => {
    if (filter === "here" && !(e.presence.kind === "here" || e.presence.kind === "resting")) return false;
    if (filter === "not_here" && e.presence.kind !== "not_here") return false;
    if (filter === "break" && e.presence.kind !== "break") return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return e.name.toLowerCase().includes(s) || (e.next?.match_code ?? "").toLowerCase().includes(s);
  });
  const limited = showAll ? shown : shown.slice(0, 12);

  const detail = (e: (typeof entries)[number]) => {
    const next = e.next?.match_code ? `next ${e.next.match_code}` : "no match left";
    switch (e.presence.kind) {
      case "not_here":
        return `Not here · ${next}`;
      case "break":
        return `${e.presence.until ? `Back ${clockLabel(e.presence.until)}` : `Since ${clockLabel(e.presence.since)}`} · ${next}`;
      case "on_court":
        return `${e.presence.matchCode ?? "Playing"}${e.presence.court ? ` on ${courtLabel(e.presence.court)}` : ""}${e.next?.match_code ? ` · then ${e.next.match_code}` : ""}`;
      case "resting":
        return `Free from ${clockLabel(e.presence.until)} · ${next}`;
      default:
        return `Since ${clockLabel(e.presence.since)} · ${next}`;
    }
  };

  return (
    <section aria-labelledby="whos-here-roster" className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h3 id="whos-here-roster" className="text-sm font-black text-foreground">
          Who's here
        </h3>
        <span className="text-[11px] font-bold text-muted-foreground">Updates live</span>
      </div>
      <label className="relative block">
        <span className="sr-only">Find a player</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or match code"
          className="min-h-[44px] w-full rounded-xl border border-border-strong bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </label>
      <div role="group" aria-label="Show" className="flex gap-1.5 overflow-x-auto">
        {(
          [
            ["all", `All ${counts.all}`],
            ["here", `Here ${counts.here}`],
            ["not_here", `Not here ${counts.not_here}`],
            ["break", `Break ${counts.break}`],
          ] as Array<[RosterFilter, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`min-h-[40px] shrink-0 rounded-full px-3 text-xs font-black ${
              filter === k ? "bg-primary text-primary-foreground" : "border border-border-strong bg-background text-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {limited.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{entries.length === 0 ? "No players with matches left." : "Nobody matches."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {limited.map((e) => {
            const checkedIn = data.ctx.checkins.has(e.id);
            const open = openId === e.id;
            return (
              <li key={e.id} className="py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : e.id)}
                    aria-expanded={open}
                    className="min-h-[44px] min-w-0 flex-1 text-left"
                  >
                    <strong className="block truncate text-sm text-foreground">{e.name}</strong>
                    <span className="block truncate text-xs text-muted-foreground">{detail(e)}</span>
                  </button>
                  {e.presence.kind === "not_here" ? (
                    <SmallButton busy={actions.checkinBusy} onClick={() => actions.checkIn(e.id, e.name)} label={`Check in ${e.name}`}>
                      Check in
                    </SmallButton>
                  ) : (
                    <PresenceChip presence={e.presence} withTime={false} />
                  )}
                </div>
                {open && (
                  <div className="mt-2 space-y-2 rounded-xl bg-background/60 p-2.5">
                    <p className="text-xs text-soft">
                      Matches left:{" "}
                      {data.matches
                        .filter((m) => matchPlayerIds(m).includes(e.id) && ["scheduled", "pending", "in_progress"].includes(m.status))
                        .map((m) => m.match_code ?? "—")
                        .join(", ") || "none"}
                    </p>
                    {checkedIn && (
                      <SmallButton busy={actions.checkinBusy} onClick={() => actions.checkOut(e.id, e.name)}>
                        Check {e.name.split(" ")[0]} out
                      </SmallButton>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > limited.length && (
        <SmallButton className="w-full" onClick={() => setShowAll(true)}>
          Show all {shown.length}
        </SmallButton>
      )}
      <p className="text-xs text-muted-foreground">Players who aren't here are listed first. Tap a name to check them out or see all their matches.</p>
    </section>
  );
}
