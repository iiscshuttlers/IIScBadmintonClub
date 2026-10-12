import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { SendReminderSheet } from "@/components/tournament/SendReminderSheet";
import { TieUmpireConsole } from "@/components/umpire/TieUmpireConsole";
import { TeamLogo } from "@/components/events/TeamLogo";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import {
  Loader2, Gavel, Radio, Clock, CheckCircle2, AlertTriangle, CalendarClock,
  MapPin, Bell, Search, RefreshCw, Swords, Flag, LayoutGrid, Eye,
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
}

interface RefTournament extends TournamentThemeInput {
  id: string;
  name?: string | null;
  slug?: string | null;
  format_family?: string;
  tournament_type?: string;
}

type StatusFilter = "all" | "attention" | "live" | "upcoming" | "completed";

export function RefereeDashboard({ tournament }: { tournament: RefTournament }) {
  const isTeamEvent = tournament.format_family === "TEAM" || tournament.tournament_type === "TEAM";
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [ties, setTies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("attention");
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMatchId, setNotifyMatchId] = useState<string | null>(null);
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<any | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Load tournament_matches
      const matchesQuery = supabase
        .from("tournament_matches")
        .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, player1_id, player2_id, court_number, scheduled_at, status, score, winner_side, reminder_sent")
        .eq("tournament_id", tournament.id)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });

      // 2. If team tournament, also load ties
      const tiesQuery = isTeamEvent
        ? supabase
            .from("tournament_ties" as any)
            .select(`
              *,
              team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
              team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url)
            `)
            .eq("tournament_id", tournament.id)
            .order("created_at", { ascending: true })
        : null;

      const [matchesRes, tiesRes] = await Promise.all([
        matchesQuery,
        tiesQuery ? tiesQuery : Promise.resolve({ data: [], error: null })
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
    const channel = supabase
      .channel(`referee_matches_${tournament.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournament.id}` }, () => load(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_ties", filter: `tournament_id=eq.${tournament.id}` }, () => load(true))
      .subscribe();
    const iv = setInterval(() => load(true), 30000);
    return () => { supabase.removeChannel(channel); clearInterval(iv); };
  }, [tournament.id, load]);

  const now = Date.now();
  const isOverdue = (m: MatchRow) =>
    m.status === "scheduled" && !!m.scheduled_at && new Date(m.scheduled_at).getTime() < now;
  const needsCourt = (m: MatchRow) =>
    m.status !== "completed" && !m.court_number && !!m.team1_label && m.team1_label !== "TBD";

  // Tie counts
  const tiesAwaitingReveal = useMemo(() => {
    return ties.filter((t: any) => t.lineup_locked_a && t.lineup_locked_b && !t.lineup_revealed && t.state !== 'COMPLETED');
  }, [ties]);

  const tiesPendingLineup = useMemo(() => {
    return ties.filter((t: any) => (!t.lineup_locked_a || !t.lineup_locked_b) && t.state !== 'COMPLETED');
  }, [ties]);

  const liveTies = useMemo(() => {
    return ties.filter((t: any) => t.state === 'IN_PROGRESS');
  }, [ties]);

  const isTieOverdue = (t: any) =>
    t.state !== "COMPLETED" && !!t.scheduled_at && new Date(t.scheduled_at).getTime() < now;
  const tieNeedsCourt = (t: any) =>
    t.state !== "COMPLETED" && !t.court_number;

  const stats = useMemo(() => {
    let live = 0, upcoming = 0, completed = 0, overdue = 0, noCourt = 0;
    for (const m of matches) {
      if (m.status === "in_progress") live++;
      else if (m.status === "completed") completed++;
      else if (m.status === "scheduled") { upcoming++; if (isOverdue(m)) overdue++; }
      if (needsCourt(m)) noCourt++;
    }

    const completedTiesCount = ties.filter((t: any) => t.state === "COMPLETED").length;
    const overdueTiesCount = ties.filter(isTieOverdue).length;
    const noCourtTiesCount = ties.filter(tieNeedsCourt).length;

    return { 
      total: matches.length > 0 ? matches.length : ties.length, 
      live: matches.length > 0 ? live : liveTies.length, 
      upcoming: matches.length > 0 ? upcoming : ties.filter((t: any) => t.state !== "IN_PROGRESS" && t.state !== "COMPLETED").length, 
      completed: matches.length > 0 ? completed : completedTiesCount, 
      overdue: matches.length > 0 ? overdue : overdueTiesCount, 
      noCourt: matches.length > 0 ? noCourt : noCourtTiesCount 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, liveTies.length, ties]);

  const categories = useMemo(
    () => Array.from(new Set(matches.map((m) => m.category))).sort(),
    [matches],
  );

  const attentionItems = useMemo(
    () => matches.filter((m) => isOverdue(m) || needsCourt(m) || m.status === "in_progress"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches],
  );

  const filteredMatches = useMemo(() => {
    let list = matches;
    if (filter === "attention") list = attentionItems;
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
  }, [matches, attentionItems, filter, category, search]);

  const attentionTies = useMemo(() => {
    return ties.filter((t: any) => 
      (t.lineup_locked_a && t.lineup_locked_b && !t.lineup_revealed) ||
      (!t.lineup_locked_a || !t.lineup_locked_b) ||
      t.state === "IN_PROGRESS" ||
      isTieOverdue(t)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ties]);

  const filteredTies = useMemo(() => {
    if (!isTeamEvent) return [];
    let list = ties;
    if (filter === "attention") list = attentionTies;
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
      const { error } = await supabase.functions.invoke("match-notifier", {
        body: { type: "manual", match_id: m.id },
      });
      if (error) throw error;
      toast.success("Players notified", { description: "Sent via in-app, email & push." });
    } catch (e: any) {
      toast.error(e?.message || "Could not send reminder");
    } finally {
      setNotifyMatchId(null);
    }
  };

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm";

  const STAT_CARDS: { label: string; value: number; icon: typeof Radio; cls: string; onClick?: () => void }[] = [
    { label: "Live now", value: stats.live, icon: Radio, cls: "text-rose-600 bg-rose-50 dark:bg-rose-950/30", onClick: () => setFilter("live") },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30", onClick: () => setFilter("attention") },
    { label: "Upcoming", value: stats.upcoming, icon: CalendarClock, cls: "text-primary bg-primary/10", onClick: () => setFilter("upcoming") },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30", onClick: () => setFilter("completed") },
  ];

  const statusChip = (m: MatchRow) => {
    if (m.status === "in_progress")
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/30"><Radio className="w-3 h-3 animate-pulse" /> Live</span>;
    if (m.status === "completed")
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"><CheckCircle2 className="w-3 h-3" /> Done</span>;
    if (isOverdue(m))
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30"><AlertTriangle className="w-3 h-3" /> Overdue</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800"><Clock className="w-3 h-3" /> Scheduled</span>;
  };

  const tieStatusChip = (t: any) => {
    if (t.state === "IN_PROGRESS")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20"><Radio className="w-3 h-3 animate-pulse" /> Live Tie</span>;
    if (t.state === "COMPLETED")
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Final</span>;
    if (t.lineup_locked_a && t.lineup_locked_b && !t.lineup_revealed)
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30"><Eye className="w-3 h-3" /> Ready to Reveal</span>;
    if (!t.lineup_locked_a || !t.lineup_locked_b)
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20"><Clock className="w-3 h-3" /> Missing Lineup</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800"><Clock className="w-3 h-3" /> Scheduled</span>;
  };

  const FILTERS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "attention", label: "Needs attention", count: matches.length > 0 ? attentionItems.length : attentionTies.length },
    { key: "live", label: "Live", count: stats.live },
    { key: "upcoming", label: "Upcoming", count: stats.upcoming },
    { key: "completed", label: "Completed", count: stats.completed },
    { key: "all", label: "All", count: stats.total },
  ];

  return (
    <ThemeScope {...tournament} className="space-y-4">
      {/* Header */}
      <div className={`${cardCls} flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gavel className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-slate-800 dark:text-foreground truncate">Referee Oversight</h3>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <EventTypeBadge tournament_type={tournament.tournament_type} format_family={tournament.format_family} />
            <RankedBadge ranked={tournament.counts_for_elo} />
          </div>
        </div>
        <button
          onClick={() => load(true)}
          className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition shrink-0"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={() => setNotifyOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition shrink-0"
        >
          <Bell className="w-3.5 h-3.5" /> Notify
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_CARDS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.label} onClick={s.onClick} className={`${cardCls} flex items-center gap-3 text-left hover:ring-2 hover:ring-primary/30 transition`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.cls}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black text-slate-800 dark:text-foreground leading-none">{s.value}</div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">{s.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {stats.noCourt > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
          <LayoutGrid className="w-4 h-4 shrink-0" />
          {stats.noCourt} match{stats.noCourt === 1 ? "" : "es"} without an assigned court.
        </div>
      )}

      {/* Filters */}
      <div className={`${cardCls} space-y-3`}>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {f.label}
                <span className={`px-1.5 rounded-full text-[10px] ${active ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700"}`}>{f.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search match, player, round…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="ALL">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{CAT_LABELS[c] ?? c}</option>)}
          </select>
        </div>
      </div>

      {/* Team Tournament Ties Quick Action & Status Banner */}
      {isTeamEvent && (
        <div className={`${cardCls} space-y-3 bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-900/30`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-indigo-400" />
                Team Ties Status ({ties.length} Total)
              </h4>
              <p className="text-xs text-slate-400">
                Oversight for tie lineup submissions, reveals, and match schedules
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {tiesAwaitingReveal.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {tiesAwaitingReveal.length} Ready to Reveal
                </span>
              )}
              {tiesPendingLineup.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {tiesPendingLineup.length} Missing Lineups
                </span>
              )}
              {liveTies.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {liveTies.length} Live
                </span>
              )}
            </div>
          </div>

          {tiesAwaitingReveal.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Action Needed: Lineups Locked &amp; Ready for Referee Reveal
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {tiesAwaitingReveal.map((t: any) => (
                  <div key={t.id} className="p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {t.tie_code}
                        </span>
                        <span className="text-xs font-black text-white truncate">
                          {t.team_a?.name || 'TBD'} vs {t.team_b?.name || 'TBD'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Both lineups locked</p>
                    </div>
                    <button
                      onClick={() => setSelectedTieForConsole(t)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition shrink-0 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Reveal Lineup
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match / Ties list */}
      <div className={cardCls}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : loadError ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">Couldn't load data</p>
            <button
              onClick={() => load()}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : filteredMatches.length === 0 && filteredTies.length === 0 ? (
          <div className="text-center py-10">
            <Swords className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "attention" 
                ? "Nothing needs attention — all clear."
                : `No ${filter} matches or ties found.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 1. Team Ties List (when present in team tournaments) */}
            {filteredTies.length > 0 && (
              <div className="space-y-2">
                {filteredMatches.length > 0 && (
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5 text-primary" /> Team Ties ({filteredTies.length})
                    </span>
                  </div>
                )}
                {filteredTies.map((t: any) => {
                  const hasCourt = !!t.court_number;
                  const courtDisplay = t.court_number
                    ? (t.court_number.toUpperCase().startsWith('COURT') || t.court_number.toUpperCase().startsWith('C') ? t.court_number : `Court ${t.court_number}`)
                    : "No court";
                  const canReveal = t.lineup_locked_a && t.lineup_locked_b && !t.lineup_revealed && t.state !== 'COMPLETED';

                  return (
                    <div
                      key={t.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3 sm:p-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      {/* Top Header Row */}
                      <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
                        <span className="text-[11px] font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                          {t.tie_code}
                        </span>
                        {t.round_name && (
                          <span className="text-[11px] font-bold text-slate-500">
                            {t.round_name}
                          </span>
                        )}
                        <div className="ml-auto">{tieStatusChip(t)}</div>
                      </div>

                      {/* Team vs Team Row */}
                      <div className="py-2.5 flex items-center justify-between gap-3">
                        {/* Team A */}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <TeamLogo
                            name={t.team_a?.name || "Team A"}
                            shortName={t.team_a?.short_name}
                            logoUrl={t.team_a?.logo_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate block">
                              {t.team_a?.name || "Team A"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {t.lineup_locked_a ? "Lineup Locked" : "Lineup Pending"}
                            </span>
                          </div>
                        </div>

                        {/* Score or VS */}
                        <div className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white shadow-2xs">
                          {t.state === "COMPLETED" || t.state === "IN_PROGRESS"
                            ? `${t.score_team_a ?? 0} - ${t.score_team_b ?? 0}`
                            : "vs"}
                        </div>

                        {/* Team B */}
                        <div className="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
                          <div className="min-w-0">
                            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate block">
                              {t.team_b?.name || "Team B"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {t.lineup_locked_b ? "Lineup Locked" : "Lineup Pending"}
                            </span>
                          </div>
                          <TeamLogo
                            name={t.team_b?.name || "Team B"}
                            shortName={t.team_b?.short_name}
                            logoUrl={t.team_b?.logo_url}
                            size="sm"
                          />
                        </div>
                      </div>

                      {/* Footer Row: Court, Time & Referee Actions */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-3 text-slate-500 text-[11px] flex-wrap">
                          <span className={`inline-flex items-center gap-1 ${!hasCourt && t.state !== "COMPLETED" ? "text-amber-600 font-bold" : ""}`}>
                            <MapPin className="w-3 h-3" /> {courtDisplay}
                          </span>
                          {t.scheduled_at ? (
                            <span className={`inline-flex items-center gap-1 ${isTieOverdue(t) ? "text-amber-600 font-bold" : ""}`}>
                              <Clock className="w-3 h-3" />
                              {new Date(t.scheduled_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(t.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-slate-400">Time not scheduled</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          {canReveal && (
                            <button
                              onClick={() => setSelectedTieForConsole(t)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5" /> Reveal Lineups
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedTieForConsole(t)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
                          >
                            <Gavel className="w-3.5 h-3.5" /> Referee Console
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. Individual Matches List */}
            {filteredMatches.length > 0 && (
              <div className="space-y-2">
                {filteredTies.length > 0 && (
                  <div className="flex items-center justify-between pt-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                      Individual Rubbers ({filteredMatches.length})
                    </span>
                  </div>
                )}
                {filteredMatches.map((m) => {
                  const canRemind = m.status === "scheduled" && !!m.player1_id;
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{m.match_code}</span>
                        <span className="text-[11px] font-bold text-slate-500">{CAT_LABELS[m.category] ?? m.category}</span>
                        <span className="text-[11px] text-muted-foreground">· {m.round_name}</span>
                        <div className="ml-auto">{statusChip(m)}</div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate flex-1 text-right">
                          {m.team1_label ?? "TBD"}
                        </span>
                        <span className="text-[11px] font-black text-slate-400 shrink-0">
                          {m.status === "completed" && m.score ? m.score : "vs"}
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate flex-1">
                          {m.team2_label ?? "TBD"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        <span className={`inline-flex items-center gap-1 ${!m.court_number && m.status !== "completed" ? "text-amber-600 font-bold" : ""}`}>
                          <MapPin className="w-3 h-3" /> {m.court_number ? `Court ${m.court_number}` : "No court"}
                        </span>
                        {m.scheduled_at && (
                          <span className={`inline-flex items-center gap-1 ${isOverdue(m) ? "text-amber-600 font-bold" : ""}`}>
                            <Clock className="w-3 h-3" />
                            {new Date(m.scheduled_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        )}
                        {m.status === "completed" && m.winner_side ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <Flag className="w-3 h-3" /> {m.winner_side === 1 ? m.team1_label : m.team2_label} won
                          </span>
                        ) : null}
                        {canRemind && (
                          <button
                            onClick={() => remindMatch(m)}
                            disabled={notifyMatchId === m.id}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-black transition disabled:opacity-50"
                          >
                            {notifyMatchId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />} Remind
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
