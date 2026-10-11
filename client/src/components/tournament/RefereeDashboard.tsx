import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { SendReminderSheet } from "@/components/tournament/SendReminderSheet";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import {
  Loader2, Gavel, Radio, Clock, CheckCircle2, AlertTriangle, CalendarClock,
  MapPin, Bell, Search, RefreshCw, Swords, Flag, LayoutGrid,
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
}

type StatusFilter = "all" | "attention" | "live" | "upcoming" | "completed";

export function RefereeDashboard({ tournament }: { tournament: RefTournament }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("attention");
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMatchId, setNotifyMatchId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const { data, error } = await supabase
      .from("tournament_matches")
      .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, player1_id, player2_id, court_number, scheduled_at, status, score, winner_side, reminder_sent")
      .eq("tournament_id", tournament.id)
      .order("round", { ascending: true })
      .order("match_number", { ascending: true });
    if (error) {
      if (!silent) toast.error(error.message);
      setLoadError(true);
    } else {
      setLoadError(false);
      setMatches((data as any) ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  // Live refresh: realtime on this tournament's matches + a slow interval fallback.
  useEffect(() => {
    const channel = supabase
      .channel(`referee_matches_${tournament.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournament.id}` }, () => load(true))
      .subscribe();
    const iv = setInterval(() => load(true), 30000);
    return () => { supabase.removeChannel(channel); clearInterval(iv); };
  }, [tournament.id, load]);

  const now = Date.now();
  const isOverdue = (m: MatchRow) =>
    m.status === "scheduled" && !!m.scheduled_at && new Date(m.scheduled_at).getTime() < now;
  const needsCourt = (m: MatchRow) =>
    m.status !== "completed" && !m.court_number && !!m.team1_label && m.team1_label !== "TBD";

  const stats = useMemo(() => {
    let live = 0, upcoming = 0, completed = 0, overdue = 0, noCourt = 0;
    for (const m of matches) {
      if (m.status === "in_progress") live++;
      else if (m.status === "completed") completed++;
      else if (m.status === "scheduled") { upcoming++; if (isOverdue(m)) overdue++; }
      if (needsCourt(m)) noCourt++;
    }
    return { total: matches.length, live, upcoming, completed, overdue, noCourt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  const categories = useMemo(
    () => Array.from(new Set(matches.map((m) => m.category))).sort(),
    [matches],
  );

  const attentionItems = useMemo(
    () => matches.filter((m) => isOverdue(m) || needsCourt(m) || m.status === "in_progress"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches],
  );

  const filtered = useMemo(() => {
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

  const FILTERS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "attention", label: "Needs attention", count: attentionItems.length },
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

      {/* Match list */}
      <div className={cardCls}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : loadError ? (
          <div className="text-center py-10">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">Couldn't load matches</p>
            <button
              onClick={() => load()}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Swords className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {filter === "attention" ? "Nothing needs attention — all clear." : "No matches here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((m) => {
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

      {notifyOpen && (
        <SendReminderSheet
          open={notifyOpen}
          onClose={() => setNotifyOpen(false)}
          tournament={{ id: tournament.id, name: tournament.name, slug: tournament.slug }}
        />
      )}
    </ThemeScope>
  );
}
