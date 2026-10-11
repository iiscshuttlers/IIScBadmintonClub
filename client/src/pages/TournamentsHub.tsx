import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Trophy, Search, Calendar, MapPin, Radio, Clock, CheckCircle2,
  Loader2, SlidersHorizontal, ArrowRight, Sparkles,
} from "lucide-react";
import { getTournaments } from "@/lib/tournaments";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import { EventTypeBadge } from "@/components/tournament/EventTypeBadge";
import { RankedBadge } from "@/components/tournament/RankedBadge";
import { getEventFamily } from "@/lib/tournamentTheme";

type StatusFilter = "all" | "upcoming" | "active" | "completed";
type TypeFilter = "all" | "open" | "team";
type RankedFilter = "all" | "ranked" | "casual";

const STATUS_META: Record<string, { label: string; icon: typeof Radio; cls: string }> = {
  active: { label: "Live", icon: Radio, cls: "text-rose-600 bg-rose-50 dark:bg-rose-950/30" },
  upcoming: { label: "Upcoming", icon: Clock, cls: "text-primary bg-primary/10" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  archived: { label: "Archived", icon: CheckCircle2, cls: "text-slate-500 bg-slate-100 dark:bg-slate-800" },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;

export default function TournamentsHub() {
  usePageMeta({
    title: "Tournaments",
    description: "Browse every IISc Badminton Club tournament — live, upcoming and past.",
  });

  const [, navigate] = useLocation();
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [ranked, setRanked] = useState<RankedFilter>("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTournaments();
      setAll(Array.isArray(data) ? data : []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(
    () => all.filter((t) => t.status !== "draft" && t.status !== "archived"),
    [all],
  );

  const counts = useMemo(() => {
    const c = { all: visible.length, upcoming: 0, active: 0, completed: 0 };
    visible.forEach((t) => {
      if (t.status === "upcoming") c.upcoming++;
      else if (t.status === "active") c.active++;
      else if (t.status === "completed") c.completed++;
    });
    return c;
  }, [visible]);

  const filtered = useMemo(() => {
    let list = visible;
    if (status !== "all") list = list.filter((t) => t.status === status);
    if (type !== "all") list = list.filter((t) => t.tournament_type === type);
    if (ranked !== "all") list = list.filter((t) => (ranked === "ranked" ? t.counts_for_elo : !t.counts_for_elo));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        [t.name, t.venue, t.subtitle, (t.categories ?? []).join(" ")]
          .some((v: string) => (v ?? "").toLowerCase().includes(q)),
      );
    }
    // Live first, then upcoming (soonest), then completed (most recent).
    const rank: Record<string, number> = { active: 0, upcoming: 1, completed: 2 };
    return [...list].sort((a, b) => {
      const ra = rank[a.status] ?? 3, rb = rank[b.status] ?? 3;
      if (ra !== rb) return ra - rb;
      const da = new Date(a.startDate || a.created_at || 0).getTime();
      const db = new Date(b.startDate || b.created_at || 0).getTime();
      return a.status === "completed" ? db - da : da - db;
    });
  }, [visible, status, type, ranked, search]);

  const openTournament = (t: any) => {
    if (t.status === "completed" || t.status === "archived") navigate(`/events/${t.slug}`);
    else navigate(`/pulse?tab=live&id=${t.id}`);
  };

  const STATUS_TABS: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "active", label: "Live", count: counts.active },
    { key: "upcoming", label: "Upcoming", count: counts.upcoming },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  const pill = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
      active ? "bg-primary text-primary-foreground" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Hero */}
      <section className="bg-gradient-to-tr from-violet-800 via-violet-700 to-indigo-500 text-white py-10 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-30" />
        <div className="container mx-auto px-4 max-w-5xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 border border-white/20 text-sm font-bold mb-3">
            <Sparkles className="w-4 h-4" /> Tournaments
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-2" style={{ fontFamily: "Playfair Display, serif" }}>
            Find your next match
          </h1>
          <p className="text-violet-100 max-w-xl mx-auto text-sm sm:text-base">
            Browse live, upcoming and past tournaments — individual and team events.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-5xl -mt-6 relative z-20 pb-16 space-y-5">
        {/* Search + filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, venue or category…"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <button key={s.key} onClick={() => setStatus(s.key)} className={pill(status === s.key)}>
                {s.label}
                <span className={`px-1.5 rounded-full text-[10px] ${status === s.key ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700"}`}>{s.count}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
            </span>
            {([["all", "All types"], ["open", "Individual"], ["team", "Team"]] as [TypeFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setType(k)} className={pill(type === k)}>{label}</button>
            ))}
            <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
            {([["all", "Any"], ["ranked", "★ Ranked"], ["casual", "Casual"]] as [RankedFilter, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setRanked(k)} className={pill(ranked === k)}>{label}</button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : loadError ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load tournaments.</p>
            <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No tournaments found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {visible.length === 0 ? "There are no tournaments yet — check back soon." : "Try clearing filters or searching differently."}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filtered.map((t, i) => {
              const sm = STATUS_META[t.status] ?? STATUS_META.completed;
              const Icon = sm.icon;
              return (
                <ThemeScope key={t.id} family={getEventFamily(t)}>
                  <motion.button
                    onClick={() => openTournament(t)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className="group w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/40 transition-all overflow-hidden"
                  >
                    <div className="h-1.5 bg-primary" />
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-black text-slate-800 dark:text-foreground leading-tight min-w-0">
                          {t.name}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${sm.cls}`}>
                          <Icon className={`w-3 h-3 ${t.status === "active" ? "animate-pulse" : ""}`} /> {sm.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EventTypeBadge tournament_type={t.tournament_type} format_family={t.format_family} compact />
                        <RankedBadge ranked={t.counts_for_elo} compact />
                        {(t.categories ?? []).slice(0, 4).map((c: string) => (
                          <span key={c} className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">{c}</span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {fmtDate(t.startDate) && (
                          <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(t.startDate)}</span>
                        )}
                        {t.venue && (
                          <span className="inline-flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{t.venue}</span></span>
                        )}
                      </div>
                      <div className="flex items-center justify-end pt-1 text-primary text-xs font-black">
                        <span className="inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                          {t.status === "completed" ? "View results" : t.status === "active" ? "Watch live" : "View details"}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </motion.button>
                </ThemeScope>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
