import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { courtLabel, disciplineOf, DISCIPLINE_LABELS, matchState, type MatchState } from "@/lib/matchView";
import { matchPath, tournamentManagePath, tournamentPath } from "@/lib/tournamentRoutes";
import {
  assessMatch,
  clockLabel,
  compareQueueOrder,
  matchPlayerIds,
  playerPresence,
  sideOf,
  suggestCourts,
  type ReadinessMatch,
} from "@/lib/matchReadiness";
import type { ReadinessMatchRow, TournamentReadiness } from "@/hooks/queries/useCheckins";
import { useOfficialActions } from "@/components/checkin/OfficialBoard";
import { CallButton, MatchCodeChip, PresenceChip, SmallButton } from "@/components/checkin/CheckinBits";

/**
 * All matches (organiser): one list grouped Live / Upcoming / Unscheduled /
 * Completed, with every player's check-in status, a per-player Call button
 * and a row action that follows the match's state. Built from the Referee
 * panel's list (status buckets, search) and the Umpire tab's filters (court,
 * format), on the shared readiness model so it agrees with every other view.
 */

export type ListStatus = "all" | "live" | "upcoming" | "unscheduled" | "completed";
type PlayersFilter = "any" | "here" | "missing";
type SortKey = "status" | "time" | "court" | "round" | "format";

const GROUPS: Array<{ key: Exclude<ListStatus, "all">; label: string; note?: string; dot: string; initial: number; folded?: boolean }> = [
  { key: "live", label: "Live", dot: "bg-cyan-300", initial: 2 },
  { key: "upcoming", label: "Upcoming", note: "by scheduled time", dot: "bg-primary", initial: 3 },
  { key: "unscheduled", label: "Unscheduled", note: "no time set yet", dot: "bg-amber-300", initial: 1 },
  { key: "completed", label: "Completed", note: "newest first, folded", dot: "bg-slate-500", initial: 0, folded: true },
];

function bucket(m: ReadinessMatch): Exclude<ListStatus, "all"> {
  const state: MatchState = matchState({ status: m.status, scheduled_at: m.scheduled_at, court_number: m.court_number ?? null });
  if (state === "live") return "live";
  if (state === "completed" || state === "walkover" || state === "cancelled") return "completed";
  if (state === "unscheduled") return "unscheduled";
  return "upcoming";
}

function formatOf(m: ReadinessMatch): string {
  const d = disciplineOf(m.category, m.match_code);
  return d ? DISCIPLINE_LABELS[d] : m.category ?? "Other";
}

function roundShort(m: ReadinessMatch): string {
  const name = m.round_name ?? (m.round != null ? `Round ${m.round}` : "");
  return name
    .replace(/^Quarter-?finals?$/i, "QF")
    .replace(/^Semi-?finals?$/i, "SF")
    .replace(/^Round (\d+)$/i, "R$1");
}

const STATUS_RANK: Record<Exclude<ListStatus, "all">, number> = { live: 0, upcoming: 1, unscheduled: 2, completed: 3 };

function comparator(sort: SortKey) {
  return (a: ReadinessMatch, b: ReadinessMatch) => {
    switch (sort) {
      case "court": {
        const ca = (a.court_number ?? "").trim() || "￿";
        const cb = (b.court_number ?? "").trim() || "￿";
        return ca.localeCompare(cb, undefined, { numeric: true }) || compareQueueOrder(a, b);
      }
      case "round":
        return (a.round ?? 0) - (b.round ?? 0) || compareQueueOrder(a, b);
      case "format":
        return formatOf(a).localeCompare(formatOf(b)) || compareQueueOrder(a, b);
      case "time":
        return compareQueueOrder(a, b);
      default:
        return STATUS_RANK[bucket(a)] - STATUS_RANK[bucket(b)] || compareQueueOrder(a, b);
    }
  };
}

const selectCls =
  "min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-100 focus:border-primary focus:outline-none";

export function AllMatchesList({
  tournamentId,
  data,
  initialStatus = "all",
  initialCourt = "",
}: {
  tournamentId: string;
  data: TournamentReadiness;
  initialStatus?: ListStatus;
  /** "" = all courts, "none" = no court yet. */
  initialCourt?: string;
}) {
  const { isAdmin } = useAuth();
  const actions = useOfficialActions(tournamentId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListStatus>(initialStatus);
  const [court, setCourt] = useState(initialCourt);
  const [format, setFormat] = useState("");
  const [round, setRound] = useState("");
  const [players, setPlayers] = useState<PlayersFilter>("any");
  const [sort, setSort] = useState<SortKey>("status");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const matches = data.matches as ReadinessMatchRow[];
  const courts = useMemo(
    () => Array.from(new Set(matches.map((m) => (m.court_number ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [matches],
  );
  const formats = useMemo(() => Array.from(new Set(matches.map(formatOf))).sort(), [matches]);
  const rounds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const m of matches) {
      const name = m.round_name ?? (m.round != null ? `Round ${m.round}` : "");
      if (name && !seen.has(name)) seen.set(name, m.round ?? 0);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1] - b[1]).map(([n]) => n);
  }, [matches]);
  const suggested = useMemo(() => suggestCourts(data.board.ready, data.free), [data.board.ready, data.free]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return matches.filter((m) => {
      if (court === "none" ? (m.court_number ?? "").trim() !== "" : court && (m.court_number ?? "").trim() !== court) return false;
      if (format && formatOf(m) !== format) return false;
      if (round && (m.round_name ?? (m.round != null ? `Round ${m.round}` : "")) !== round) return false;
      if (players !== "any") {
        const r = data.board.byMatch[m.id];
        if (!r) return false;
        if (players === "here" && !r.allHere) return false;
        if (players === "missing" && r.allHere) return false;
      }
      if (q) {
        const hay = [m.match_code, m.team1_label, m.team2_label, ...matchPlayerIds(m).map((id) => data.names[id])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matches, search, court, format, round, players, data.board.byMatch, data.names]);

  const counts = useMemo(() => {
    const c: Record<ListStatus, number> = { all: filtered.length, live: 0, upcoming: 0, unscheduled: 0, completed: 0 };
    for (const m of filtered) c[bucket(m)]++;
    return c;
  }, [filtered]);

  const visible = useMemo(() => filtered.filter((m) => status === "all" || bucket(m) === status), [filtered, status]);

  const row = (m: ReadinessMatchRow) => {
    const b = bucket(m);
    const live = b === "live";
    const open = b === "upcoming" || b === "unscheduled";
    const r = open ? assessMatch(data.ctx, m) : null;
    const ids = matchPlayerIds(m);
    const sideIds = (s: 1 | 2) => ids.filter((id) => sideOf(m, id) === s);
    const sideLabel = (s: 1 | 2) => (s === 1 ? m.team1_label : m.team2_label) || "TBD";

    const playerCell = (id: string) => {
      const name = data.names[id] ?? "Player";
      if (live) {
        return (
          <span key={id} className="flex min-w-0 flex-col">
            <strong className="truncate text-[13px] text-white">{name}</strong>
            <span className="text-[11px] font-bold text-cyan-300">Playing</span>
          </span>
        );
      }
      if (!open) {
        return (
          <span key={id} className="truncate text-[13px] font-bold text-slate-200">
            {name}
          </span>
        );
      }
      if (!data.checkinsAvailable) {
        return (
          <span key={id} className="truncate text-[13px] font-bold text-slate-200">
            {name}
          </span>
        );
      }
      const presence = playerPresence(data.ctx, id, m.id);
      const canCall = r?.state !== "not_applicable" && (presence.kind === "not_here" || presence.kind === "break");
      return (
        <span key={id} className="flex min-w-0 flex-wrap items-center gap-1.5">
          <strong className="truncate text-[13px] text-white">{name}</strong>
          <PresenceChip presence={presence} withTime={false} className="!px-2 !py-0.5 !text-[11px]" />
          {canCall && (
            <CallButton name={name} busy={actions.busyKey === `call:${m.id}:${id}`} onClick={() => actions.call(m, [id], data.names)} />
          )}
        </span>
      );
    };

    const side = (s: 1 | 2) => {
      const list = sideIds(s);
      if (list.length === 0) return <span className="truncate text-[13px] text-slate-400">{sideLabel(s)}</span>;
      return <div className="flex min-w-0 flex-col gap-1">{list.map(playerCell)}</div>;
    };

    let action: React.ReactNode = null;
    if (live || b === "completed") {
      action = (
        <Link href={matchPath(tournamentId, m.id)} className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 px-3 text-xs font-black text-slate-100 hover:bg-slate-800">
          Open
        </Link>
      );
    } else if (!data.checkinsAvailable) {
      action = (
        <Link href={matchPath(tournamentId, m.id)} className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 px-3 text-xs font-black text-slate-100 hover:bg-slate-800">
          Open
        </Link>
      );
    } else if (r?.state === "ready") {
      const c = suggested[m.id];
      action = c ? (
        <SmallButton tone="primary" busy={actions.busyKey === `court:${m.id}`} onClick={() => actions.putOnCourt(m, c)}>
          Put on {courtLabel(c)}
        </SmallButton>
      ) : (
        <span className="text-xs font-bold text-emerald-300">All here · no court free</span>
      );
    } else if (b === "unscheduled") {
      action = (
        <Link
          href={isAdmin ? tournamentManagePath(tournamentId, true) : tournamentPath(tournamentId, null, { panel: "umpire" })}
          className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 px-3 text-xs font-black text-slate-100 hover:bg-slate-800"
        >
          Set time &amp; court
        </Link>
      );
    } else if (r && r.callable.length > 0) {
      action = (
        <CallButton busy={actions.busyKey === `call:${m.id}:${r.callable.join(",")}`} onClick={() => actions.call(m, r.callable, data.names)}>
          {r.callable.length === r.total
            ? "Call everyone"
            : r.callable.length === 2 && r.missing.length === 2
              ? "Call both"
              : `Call missing (${r.callable.length})`}
        </CallButton>
      );
    } else if (r && r.state !== "not_applicable") {
      action = <span className="text-xs font-bold text-amber-300">{r.hereCount} of {r.total} here</span>;
    }

    return (
      <li key={m.id} className="grid gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:grid-cols-[8.5rem_6rem_1fr_auto] sm:items-center">
        <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
          <MatchCodeChip code={m.match_code ?? "—"} />
          <span className="text-[11px] text-slate-400">
            {formatOf(m)} · {roundShort(m)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs sm:flex-col sm:items-start sm:gap-0.5">
          <strong className="text-white">
            {live ? (m.court_number ? courtLabel(m.court_number) : "On court") : m.scheduled_at ? clockLabel(m.scheduled_at) : "No time"}
          </strong>
          <span className="text-slate-400">
            {live ? (m as { score?: string | null }).score || "Live" : m.court_number ? courtLabel(m.court_number) : b === "completed" ? "" : "No court yet"}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">{side(1)}</div>
          <span className="shrink-0 text-xs text-slate-500">vs</span>
          <div className="min-w-0 flex-1">{side(2)}</div>
        </div>
        <div className="flex justify-end">{action}</div>
      </li>
    );
  };

  const sorted = useMemo(() => [...visible].sort(comparator(sort)), [visible, sort]);

  return (
    <section aria-label="All matches" className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-black text-white">All matches</h3>
          <p className="text-xs text-slate-400">
            {matches.length} matches · every player's status, and a Call button next to anyone who isn't here
          </p>
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player name or match code"
            className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-white focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      <div role="tablist" aria-label="Status" className="flex gap-1.5 overflow-x-auto pb-1">
        {(["all", "live", "upcoming", "unscheduled", "completed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-xs font-black ${
              status === s ? "bg-primary text-primary-foreground" : "border border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {s === "all" ? "All" : GROUPS.find((g) => g.key === s)!.label} {counts[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
          Court
          <select value={court} onChange={(e) => setCourt(e.target.value)} className={selectCls}>
            <option value="">All courts</option>
            {courts.map((c) => (
              <option key={c} value={c}>
                {courtLabel(c)}
              </option>
            ))}
            <option value="none">No court yet</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={selectCls}>
            <option value="">All formats</option>
            {formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
          Round
          <select value={round} onChange={(e) => setRound(e.target.value)} className={selectCls}>
            <option value="">All rounds</option>
            {rounds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-400">
          Players
          <select value={players} onChange={(e) => setPlayers(e.target.value as PlayersFilter)} className={selectCls}>
            <option value="any">Anyone</option>
            <option value="here">Everyone here</option>
            <option value="missing">Someone missing</option>
          </select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-[11px] font-bold text-slate-400 sm:col-span-1">
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
            <option value="status">Status: live first</option>
            <option value="time">Time</option>
            <option value="court">Court</option>
            <option value="round">Round</option>
            <option value="format">Format</option>
          </select>
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No matches match these filters.</p>
      ) : sort !== "status" ? (
        <ul className="space-y-2">{sorted.slice(0, expanded.flat ? undefined : 30).map(row)}</ul>
      ) : (
        <div className="space-y-3">
          {GROUPS.filter((g) => status === "all" || g.key === status).map((g) => {
            const list = sorted.filter((m) => bucket(m) === g.key);
            if (g.key === "completed") list.sort((a, b) => Date.parse(b.ended_at ?? "") - Date.parse(a.ended_at ?? "") || 0);
            if (list.length === 0) return null;
            const open = expanded[g.key] ?? (status !== "all" || !g.folded);
            const shown = expanded[g.key] || status !== "all" ? list : list.slice(0, g.initial);
            return (
              <div key={g.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${g.dot}`} aria-hidden />
                  <strong className="text-sm text-white">
                    {g.label} · {list.length}
                  </strong>
                  {g.note && <span className="text-xs text-slate-400">· {g.note}</span>}
                  {g.folded && status === "all" && !expanded[g.key] && (
                    <SmallButton className="ml-auto" onClick={() => setExpanded((e) => ({ ...e, [g.key]: true }))}>
                      Show
                    </SmallButton>
                  )}
                </div>
                {open && shown.length > 0 && <ul className="space-y-2">{shown.map(row)}</ul>}
                {open && shown.length < list.length && (
                  <SmallButton className="w-full" onClick={() => setExpanded((e) => ({ ...e, [g.key]: true }))}>
                    Show {list.length - shown.length} more {g.label.toLowerCase()} {list.length - shown.length === 1 ? "match" : "matches"}
                  </SmallButton>
                )}
              </div>
            );
          })}
        </div>
      )}
      {sort !== "status" && sorted.length > 30 && !expanded.flat && (
        <SmallButton className="w-full" onClick={() => setExpanded((e) => ({ ...e, flat: true }))}>
          Show all {sorted.length}
        </SmallButton>
      )}
      <p className="text-xs leading-relaxed text-slate-400">
        "Call" pushes to that one player only. Players who are playing on another court get no Call button.
      </p>
    </section>
  );
}

/** For other panels (Referee "Ready" filter): is this match ready right now? */
export function isReadyNow(data: TournamentReadiness, matchId: string): boolean {
  return data.board.byMatch[matchId]?.state === "ready";
}

