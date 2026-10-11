import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import { toLocalDateTimeInput, localDateTimeInputToIso } from "@/lib/umpire/schedule";
import {
  Loader2, CalendarClock, MapPin, Clock, Check, Swords, LayoutGrid,
  RefreshCw, AlertTriangle, Radio,
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
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  tie_id?: string | null;
}

interface OrderOfPlayProps extends TournamentThemeInput {
  id: string;
}

export function OrderOfPlayPanel({ tournament }: { tournament: OrderOfPlayProps }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [edits, setEdits] = useState<Record<string, { court: string; time: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from("tournament_matches")
      .select("id, match_code, category, round_name, round, match_number, team1_label, team2_label, player1_id, court_number, scheduled_at, status, tie_id")
      .eq("tournament_id", tournament.id)
      .neq("status", "completed")
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
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`oop_matches_${tournament.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournament.id}` }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tournament.id, load]);

  const categories = useMemo(() => Array.from(new Set(matches.map((m) => m.category))).sort(), [matches]);
  const inCat = (m: MatchRow) => category === "ALL" || m.category === category;

  const editFor = (m: MatchRow) =>
    edits[m.id] ?? { court: m.court_number ?? "", time: toLocalDateTimeInput(m.scheduled_at) };

  const setEdit = (id: string, patch: Partial<{ court: string; time: string }>) =>
    setEdits((prev) => ({ ...prev, [id]: { ...editFor(matches.find((m) => m.id === id)!), ...prev[id], ...patch } }));

  const dirty = (m: MatchRow) => {
    const e = edits[m.id];
    if (!e) return false;
    const iso = localDateTimeInputToIso(e.time);
    return (e.court.trim() || null) !== (m.court_number ?? null) || iso !== (m.scheduled_at ?? null);
  };

  const save = async (m: MatchRow) => {
    const e = editFor(m);
    const iso = localDateTimeInputToIso(e.time);
    setSavingId(m.id);
    const { error } = await supabase
      .from("tournament_matches")
      .update({
        court_number: e.court.trim() || null,
        scheduled_at: iso,
        status: "scheduled",
        reminder_sent: false,
      } as any)
      .eq("id", m.id);
    setSavingId(null);
    if (error) return toast.error(error.message || "Could not save");
    toast.success(`${m.match_code} scheduled`);
    setEdits((prev) => { const n = { ...prev }; delete n[m.id]; return n; });
    load(true);
  };

  // Unscheduled = live/scheduled matches missing a court or a time, with competitors assigned.
  const unscheduled = useMemo(
    () =>
      matches.filter(
        (m) =>
          inCat(m) &&
          m.status !== "completed" &&
          (!m.court_number || !m.scheduled_at) &&
          (!!m.player1_id || !!m.team1_label || !!m.tie_id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matches, category],
  );

  // Court overview: scheduled matches grouped by court, ordered by time.
  const byCourt = useMemo(() => {
    const groups: Record<string, MatchRow[]> = {};
    matches
      .filter((m) => inCat(m) && m.court_number && m.scheduled_at && m.status !== "completed")
      .forEach((m) => { (groups[m.court_number!] ??= []).push(m); });
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()),
    );
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, category]);

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm";
  const fieldCls = "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40";

  const matchRow = (m: MatchRow, showEditor: boolean) => {
    const e = editFor(m);
    const live = m.status === "in_progress";
    return (
      <div key={m.id} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{m.match_code}</span>
          <span className="text-[11px] font-bold text-slate-500">{CAT_LABELS[m.category] ?? m.category}</span>
          <span className="text-[11px] text-muted-foreground">· {m.round_name}</span>
          {live && <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-black text-rose-600"><Radio className="w-3 h-3 animate-pulse" /> Live</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2 min-w-0">
          <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate flex-1 text-right">{m.team1_label ?? "TBD"}</span>
          <span className="text-[11px] font-black text-slate-400 shrink-0">vs</span>
          <span className="text-sm font-black text-slate-800 dark:text-slate-100 truncate flex-1">{m.team2_label ?? "TBD"}</span>
        </div>
        {showEditor ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <input
                value={e.court}
                onChange={(ev) => setEdit(m.id, { court: ev.target.value })}
                placeholder="Court"
                className={`${fieldCls} w-16`}
              />
            </div>
            <input
              type="datetime-local"
              value={e.time}
              onChange={(ev) => setEdit(m.id, { time: ev.target.value })}
              className={fieldCls}
            />
            <button
              onClick={() => save(m)}
              disabled={savingId === m.id || !dirty(m)}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition disabled:opacity-40"
            >
              {savingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> Court {m.court_number}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(m.scheduled_at!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <ThemeScope {...tournament} className="space-y-4">
      {/* Header */}
      <div className={`${cardCls} flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-slate-800 dark:text-foreground">Order of Play</h3>
          <p className="text-xs text-muted-foreground">Assign courts and times, and see what's running on each court.</p>
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
          <option value="ALL">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{CAT_LABELS[c] ?? c}</option>)}
        </select>
        <button onClick={() => load(true)} className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition shrink-0" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className={`${cardCls} flex items-center justify-center py-12 text-muted-foreground`}><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : loadError ? (
        <div className={`${cardCls} text-center py-10`}>
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load matches</p>
          <button onClick={() => load()} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Needs scheduling */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-200">Needs scheduling</h4>
              <span className="text-[11px] font-bold text-muted-foreground">({unscheduled.length})</span>
            </div>
            {unscheduled.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Every match has a court and a time. 🎉</p>
            ) : (
              <div className="space-y-2">{unscheduled.map((m) => matchRow(m, true))}</div>
            )}
          </div>

          {/* Court overview */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-black text-slate-700 dark:text-slate-200">On courts</h4>
            </div>
            {byCourt.length === 0 ? (
              <div className="text-center py-6">
                <Swords className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No matches assigned to a court yet.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {byCourt.map(([court, list]) => (
                  <div key={court} className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-black">
                      <MapPin className="w-3.5 h-3.5" /> Court {court}
                      <span className="text-[10px] opacity-70">· {list.length}</span>
                    </div>
                    <div className="space-y-2">{list.map((m) => matchRow(m, false))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ThemeScope>
  );
}
