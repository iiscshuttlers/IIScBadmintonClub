import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRefereeMatches, notifyTournamentMatch, subscribeToRefereeBoard } from "@/services/tournamentService";
import { teamService } from "@/services/teamService";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { SendReminderSheet } from "@/components/tournament/SendReminderSheet";
import { TieUmpireConsole } from "@/components/umpire/TieUmpireConsole";
import { TeamLogo } from "@/components/events/TeamLogo";
import { isTieRevealed, tieCourts } from "@/components/events/organizerTieStatus";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import { courtKey, courtLabel } from "@/lib/matchView";
import { useTournamentReadiness } from "@/hooks/queries/useCheckins";
import { isReadyNow } from "@/components/tournament/AllMatchesList";
import {
  Loader2, Gavel, Radio, Clock, CheckCircle2, AlertTriangle, MapPin, Bell, Search, RefreshCw, Swords, Eye,
} from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", XD: "Mixed Doubles", BS: "Boys' Singles",
  GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};

interface MatchRow {
  id: string;
  match_code: string;
  category: string;
  round_name: string;
  round: number;
  match_number: number;
  team1_label: string | null;
  team2_label: string | null;
  player1_id: string | null;
  player2_id: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  score: string | null;
  winner_side: number | null;
  reminder_sent: boolean | null;
  /** Rubbers of a team tie: their courts and players say where the tie is and whether it was revealed. */
  tie_id: string | null;
  is_decider_tiebreaker: boolean | null;
}

interface RefTournament extends TournamentThemeInput {
  id: string;
  name?: string | null;
  slug?: string | null;
  format_family?: string;
  tournament_type?: string;
}

type StatusFilter = "all" | "attention" | "ready" | "live" | "upcoming" | "completed";

/** "Quarterfinal" → "QF", "Round of 16" stays; keeps the first row of a match short. */
const roundShort = (name: string | null | undefined, round: number | null | undefined) =>
  (name ?? (round != null ? `Round ${round}` : ""))
    .replace(/^Quarter-?finals?$/i, "QF")
    .replace(/^Semi-?finals?$/i, "SF")
    .replace(/^Round (\d+)$/i, "R$1");

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const chipBase = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black whitespace-nowrap";

/**
 * Referee desk: one header with the counts that matter, one filter bar and one
 * list. It opens on what needs attention, or on the whole list when nothing does.
 */
export function RefereeDashboard({ tournament }: { tournament: RefTournament }) {
  const isTeamEvent = tournament.format_family === "TEAM" || tournament.tournament_type === "TEAM";
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [ties, setTies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // null = follow the default (attention when anything needs it, else everything).
  const [chosenFilter, setChosenFilter] = useState<StatusFilter | null>(null);
  // Check-in readiness for the "Ready" filter (shared with Umpire and Organiser panels).
  const readiness = useTournamentReadiness(tournament.id);
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMatchId, setNotifyMatchId] = useState<string | null>(null);
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<any | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [matchesRes, tiesRes] = await Promise.all([
        fetchRefereeMatches(tournament.id),
        isTeamEvent ? teamService.getRefereeTies(tournament.id) : Promise.resolve({ data: [], error: null }),
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (tiesRes && tiesRes.error) {
        console.error("Error loading ties in RefereeDashboard:", tiesRes.error);
      }

      setLoadError(false);
      setMatches((matchesRes.data as any) ?? []);
      setTies(((tiesRes as any)?.data as any) ?? []);
    } catch (error: any) {
      if (!silent) toast.error(error?.message || "Failed to load referee data");
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tournament.id, isTeamEvent]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: realtime on matches & ties
  useEffect(() => {
    const unsubscribe = subscribeToRefereeBoard(tournament.id, () => load(true));
    const iv = setInterval(() => load(true), 30000);
    return () => { unsubscribe(); clearInterval(iv); };
  }, [tournament.id, load]);

  const now = Date.now();
  const isOverdue = (m: MatchRow) =>
    m.status === "scheduled" && !!m.scheduled_at && new Date(m.scheduled_at).getTime() < now;
  // "Court" / "TBD" placeholders count as no court.
  const needsCourt = (m: MatchRow) =>
    m.status !== "completed" && !courtKey(m.court_number) && !!m.team1_label && m.team1_label !== "TBD";

  // Ties: tournament_ties has no court or reveal columns; both come from the tie's rubbers.
  const tieRevealed = (t: any) => isTieRevealed(t.id, matches);
  const lineupsLocked = (t: any) => !!t.lineup_locked_a && !!t.lineup_locked_b;
  const canReveal = (t: any) => lineupsLocked(t) && !tieRevealed(t) && t.state !== "COMPLETED";
  const isTieOverdue = (t: any) =>
    t.state !== "COMPLETED" && !!t.scheduled_at && new Date(t.scheduled_at).getTime() < now;

  const tiesAwaitingReveal = useMemo(() => ties.filter(canReveal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ties, matches]);
  const tiesPendingLineup = useMemo(() => ties.filter((t: any) => !lineupsLocked(t) && t.state !== "COMPLETED"), [ties]);
  const liveTies = useMemo(() => ties.filter((t: any) => t.state === "IN_PROGRESS"), [ties]);

  const stats = useMemo(() => {
    let live = 0, upcoming = 0, completed = 0, overdue = 0, noCourt = 0;
    for (const m of matches) {
      if (m.status === "in_progress") live++;
      else if (m.status === "completed") completed++;
      else if (m.status === "scheduled") { upcoming++; if (isOverdue(m)) overdue++; }
      if (needsCourt(m)) noCourt++;
    }
    const useTies = matches.length === 0;
    return {
      total: useTies ? ties.length : matches.length,
      live: useTies ? liveTies.length : live,
      upcoming: useTies ? ties.filter((t: any) => t.state !== "IN_PROGRESS" && t.state !== "COMPLETED").length : upcoming,
      completed: useTies ? ties.filter((t: any) => t.state === "COMPLETED").length : completed,
      overdue: useTies ? ties.filter(isTieOverdue).length : overdue,
      noCourt: useTies ? ties.filter((t: any) => t.state !== "COMPLETED" && tieCourts(t.id, matches).length === 0).length : noCourt,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, liveTies.length, ties]);

  const categories = useMemo(
    () => Array.from(new Set(matches.map((m) => m.category))).filter(Boolean).sort(),
    [matches],
  );

  const attentionItems = useMemo(
    () => matches.filter((m) => isOverdue(m) || needsCourt(m) || m.status === "in_progress"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches],
  );
  const attentionTies = useMemo(
    () => ties.filter((t: any) => t.state !== "COMPLETED" && (canReveal(t) || !lineupsLocked(t) || t.state === "IN_PROGRESS" || isTieOverdue(t))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ties, matches],
  );
  const attentionCount = matches.length > 0 ? attentionItems.length : attentionTies.length;
  const readyCount = matches.filter((m) => isReadyNow(readiness, m.id)).length;

  const filter: StatusFilter =
    chosenFilter ?? (attentionCount > 0 ? "attention" : stats.live > 0 ? "live" : stats.upcoming > 0 ? "upcoming" : "all");

  const filteredMatches = useMemo(() => {
    let list = matches;
    if (filter === "attention") list = attentionItems;
    else if (filter === "ready") list = list.filter((m) => isReadyNow(readiness, m.id));
    else if (filter === "live") list = list.filter((m) => m.status === "in_progress");
    else if (filter === "upcoming") list = list.filter((m) => m.status === "scheduled");
    else if (filter === "completed") list = list.filter((m) => m.status === "completed");
    if (category !== "ALL") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        [m.match_code, m.team1_label, m.team2_label, m.round_name, CAT_LABELS[m.category] ?? m.category]
          .some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    return list;
  }, [matches, attentionItems, filter, category, search, readiness]);

  const filteredTies = useMemo(() => {
    if (!isTeamEvent) return [];
    let list = ties;
    if (filter === "attention") list = attentionTies;
    else if (filter === "ready") list = []; // check-in readiness is per rubber, not per tie
    else if (filter === "live") list = list.filter((t: any) => t.state === "IN_PROGRESS");
    else if (filter === "upcoming") list = list.filter((t: any) => t.state !== "IN_PROGRESS" && t.state !== "COMPLETED");
    else if (filter === "completed") list = list.filter((t: any) => t.state === "COMPLETED");

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t: any) =>
        [t.tie_code, t.round_name, t.team_a?.name, t.team_a?.short_name, t.team_b?.name, t.team_b?.short_name]
          .some((v) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    return list;
  }, [isTeamEvent, ties, filter, attentionTies, search]);

  const remindMatch = async (m: MatchRow) => {
    setNotifyMatchId(m.id);
    try {
      await notifyTournamentMatch(m.id, "manual");
      toast.success("Players notified", { description: "Sent via in-app, email & push." });
    } catch (e: any) {
      toast.error(e?.message || "Could not send reminder");
    } finally {
      setNotifyMatchId(null);
    }
  };

  const cardCls = "bg-card rounded-2xl border border-border p-3 sm:p-4 shadow-sm";

  const statusChip = (m: MatchRow) => {
    if (m.status === "in_progress")
      return <span className={`${chipBase} text-live bg-live/10`}><Radio className="w-3 h-3 animate-pulse" aria-hidden /> Live</span>;
    if (m.status === "completed")
      return <span className={`${chipBase} text-success bg-success/10`}><CheckCircle2 className="w-3 h-3" aria-hidden /> Done</span>;
    if (isOverdue(m))
      return <span className={`${chipBase} text-warning bg-warning/10`}><AlertTriangle className="w-3 h-3" aria-hidden /> Overdue</span>;
    return <span className={`${chipBase} text-muted-foreground bg-muted`}><Clock className="w-3 h-3" aria-hidden /> Scheduled</span>;
  };

  const tieStatusChip = (t: any) => {
    if (t.state === "IN_PROGRESS")
      return <span className={`${chipBase} text-live bg-live/10`}><Radio className="w-3 h-3 animate-pulse" aria-hidden /> Live</span>;
    if (t.state === "COMPLETED")
      return <span className={`${chipBase} text-success bg-success/10`}><CheckCircle2 className="w-3 h-3" aria-hidden /> Final</span>;
    if (canReveal(t))
      return <span className={`${chipBase} text-warning bg-warning/10`}><Eye className="w-3 h-3" aria-hidden /> Ready to reveal</span>;
    if (!lineupsLocked(t))
      return <span className={`${chipBase} text-danger bg-danger/10`}><Clock className="w-3 h-3" aria-hidden /> Lineup missing</span>;
    return <span className={`${chipBase} text-muted-foreground bg-muted`}><Clock className="w-3 h-3" aria-hidden /> Scheduled</span>;
  };

  // Empty filters are left out, except Needs attention (0 there means all clear) and the one you're on.
  const FILTERS = ([
    { key: "attention", label: "Needs attention", count: attentionCount },
    // Every player checked in, nobody busy or resting (lib/matchReadiness).
    { key: "ready", label: "Ready", count: readyCount },
    { key: "live", label: "Live", count: stats.live },
    { key: "upcoming", label: "Upcoming", count: stats.upcoming },
    { key: "completed", label: "Completed", count: stats.completed },
    { key: "all", label: "All", count: stats.total },
  ] as { key: StatusFilter; label: string; count: number }[]).filter(
    (f) => f.count > 0 || f.key === "attention" || f.key === "all" || f.key === filter,
  );

  // One line under the title with only the counts that are not zero.
  const summary = [
    isTeamEvent && ties.length > 0 ? `${ties.length} tie${ties.length === 1 ? "" : "s"}` : `${matches.length} match${matches.length === 1 ? "" : "es"}`,
    stats.live > 0 && `${stats.live} live`,
    stats.overdue > 0 && `${stats.overdue} overdue`,
    stats.noCourt > 0 && `${stats.noCourt} without a court`,
    tiesAwaitingReveal.length > 0 && `${tiesAwaitingReveal.length} ready to reveal`,
    tiesPendingLineup.length > 0 && `${tiesPendingLineup.length} missing a lineup`,
  ].filter(Boolean).join(" · ");

  const emptyText =
    filter === "attention" ? "Nothing needs attention — all clear."
    : filter === "ready" ? "No match has every player checked in yet."
    : search.trim() || category !== "ALL" ? "Nothing matches your search."
    : `No ${filter === "all" ? "" : `${filter} `}matches yet.`;

  return (
    <ThemeScope {...tournament} className="space-y-3">
      {/* Header + filters in one card */}
      <div className={`${cardCls} space-y-3`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Gavel className="w-[18px] h-[18px] text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-foreground leading-tight">Referee desk</h3>
            {!loading && !loadError && <p className="text-xs text-muted-foreground">{summary}</p>}
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition shrink-0"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setNotifyOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shrink-0"
          >
            <Bell className="w-3.5 h-3.5" aria-hidden /> Notify
          </button>
        </div>

        <div role="tablist" aria-label="Show" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setChosenFilter(f.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 min-h-[36px] px-3 rounded-full text-xs font-black whitespace-nowrap transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-soft hover:bg-muted-strong"
                }`}
              >
                {f.label}
                <span className={active ? "opacity-80" : "text-muted-foreground"}>{f.count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Search</span>
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full min-h-[40px] pl-9 pr-3 bg-muted border border-border-strong rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          {categories.length > 1 && (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Format"
              className="shrink-0 max-w-[40%] min-h-[40px] bg-muted border border-border-strong rounded-xl px-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="ALL">All formats</option>
              {categories.map((c) => <option key={c} value={c}>{CAT_LABELS[c] ?? c}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Match / tie list */}
      <div className={cardCls}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : loadError ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
            <p className="text-sm text-soft font-bold">Couldn't load data</p>
            <button
              type="button"
              onClick={() => load()}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : filteredMatches.length === 0 && filteredTies.length === 0 ? (
          <div className="text-center py-10">
            {filter === "attention" ? (
              <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
            ) : (
              <Swords className="w-8 h-8 text-faint mx-auto mb-2" />
            )}
            <p className="text-sm text-muted-foreground">{emptyText}</p>
            {filter !== "all" && stats.total > 0 && (
              <button type="button" onClick={() => setChosenFilter("all")} className="mt-2 text-xs font-black text-primary hover:underline">
                Show all {stats.total}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Team ties */}
            {filteredTies.length > 0 && (
              <section aria-label="Ties">
                {filteredMatches.length > 0 && (
                  <h4 className="pb-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Ties · {filteredTies.length}</h4>
                )}
                <ul className="divide-y divide-border">
                  {filteredTies.map((t: any) => {
                    const courts = tieCourts(t.id, matches);
                    const started = t.state === "COMPLETED" || t.state === "IN_PROGRESS";
                    const side = (team: any, locked: boolean, align: "left" | "right") => (
                      <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
                        <TeamLogo name={team?.name || "TBD"} shortName={team?.short_name} logoUrl={team?.logo_url} size="sm" />
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-black text-foreground">{team?.name || "TBD"}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${locked ? "text-muted-foreground" : "text-warning"}`}>
                            {locked ? "Lineup locked" : "Lineup pending"}
                          </span>
                        </div>
                      </div>
                    );
                    return (
                      <li key={t.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{t.tie_code}</span>
                          {t.round_name && <span className="truncate text-[11px] font-bold text-muted-foreground">{t.round_name}</span>}
                          <span className="ml-auto shrink-0">{tieStatusChip(t)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {side(t.team_a, !!t.lineup_locked_a, "left")}
                          <span className="shrink-0 px-2 font-mono text-sm font-black text-foreground">
                            {started ? `${t.score_team_a ?? 0}–${t.score_team_b ?? 0}` : "vs"}
                          </span>
                          {side(t.team_b, !!t.lineup_locked_b, "right")}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                          {/* Courts of the rubbers still to play; a finished tie has none to show. */}
                          {t.state !== "COMPLETED" && (
                            <span className={`inline-flex items-center gap-1 ${courts.length === 0 ? "text-warning font-bold" : ""}`}>
                              <MapPin className="w-3 h-3" aria-hidden />
                              {courts.length > 0 ? courts.map((c) => courtLabel(c)).join(", ") : "No court"}
                            </span>
                          )}
                          {t.scheduled_at && (
                            <span className={`inline-flex items-center gap-1 ${isTieOverdue(t) ? "text-warning font-bold" : ""}`}>
                              <Clock className="w-3 h-3" aria-hidden /> {timeLabel(t.scheduled_at)}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1.5">
                            {canReveal(t) && (
                              <button
                                type="button"
                                onClick={() => setSelectedTieForConsole(t)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-warning hover:bg-warning/90 text-warning-foreground text-xs font-black transition"
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden /> Reveal
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedTieForConsole(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
                            >
                              <Gavel className="w-3.5 h-3.5" aria-hidden /> Console
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Matches (rubbers in a team event) */}
            {filteredMatches.length > 0 && (
              <section aria-label={isTeamEvent ? "Rubbers" : "Matches"}>
                {filteredTies.length > 0 && (
                  <h4 className="pb-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">Rubbers · {filteredMatches.length}</h4>
                )}
                <ul className="divide-y divide-border">
                  {filteredMatches.map((m) => {
                    const canRemind = m.status === "scheduled" && !!m.player1_id;
                    const done = m.status === "completed";
                    const court = courtKey(m.court_number);
                    const name = (side: 1 | 2) => {
                      const label = (side === 1 ? m.team1_label : m.team2_label) ?? "TBD";
                      const won = done && m.winner_side === side;
                      return (
                        <span className={`min-w-0 truncate text-sm ${won ? "font-black text-foreground" : done ? "font-bold text-muted-foreground" : "font-black text-foreground"}`}>
                          {label}
                          {won && <span className="sr-only"> (won)</span>}
                        </span>
                      );
                    };
                    return (
                      <li key={m.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 text-[11px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{m.match_code}</span>
                          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                            <span title={CAT_LABELS[m.category] ?? m.category}>{m.category}</span>
                            {" · "}{roundShort(m.round_name, m.round)}
                            {(court || !done) && (
                              <>
                                {" · "}
                                <span className={!court ? "font-bold text-warning" : ""}>
                                  {court ? courtLabel(m.court_number!) : "No court"}
                                </span>
                              </>
                            )}
                            {m.scheduled_at && !done && (
                              <>
                                {" · "}
                                <span className={isOverdue(m) ? "font-bold text-warning" : ""}>{timeLabel(m.scheduled_at)}</span>
                              </>
                            )}
                          </span>
                          <span className="ml-auto shrink-0">{statusChip(m)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                            <span className="flex min-w-0 justify-end">{name(1)}</span>
                            <span className="shrink-0 text-[11px] font-black text-muted-foreground">{done && m.score ? m.score : "vs"}</span>
                            <span className="flex min-w-0">{name(2)}</span>
                          </div>
                          {canRemind && (
                            <button
                              type="button"
                              onClick={() => remindMatch(m)}
                              disabled={notifyMatchId === m.id}
                              aria-label={`Remind players of ${m.match_code}`}
                              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-black transition disabled:opacity-50"
                            >
                              {notifyMatchId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />} Remind
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      {notifyOpen && (
        <SendReminderSheet
          open={notifyOpen}
          onClose={() => setNotifyOpen(false)}
          tournament={{ id: tournament.id, name: tournament.name, slug: tournament.slug }}
        />
      )}

      {selectedTieForConsole && (
        <TieUmpireConsole
          tie={selectedTieForConsole}
          tournament={tournament}
          onClose={() => {
            setSelectedTieForConsole(null);
            load(true);
          }}
        />
      )}
    </ThemeScope>
  );
}
