import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import {
  Loader2, Gauge, Check, Wand2, RefreshCw, Info, AlertTriangle, Layers,
} from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", XD: "Mixed Doubles", BS: "Boys' Singles",
  GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};

interface RuleVals { points_to_win: number; best_of_sets: number; golden_point: number; }
const DEFAULT_RULE: RuleVals = { points_to_win: 21, best_of_sets: 3, golden_point: 30 };

const PRESETS: { label: string; vals: RuleVals }[] = [
  { label: "21 · best of 3 · cap 30", vals: { points_to_win: 21, best_of_sets: 3, golden_point: 30 } },
  { label: "15 · best of 3 · cap 21", vals: { points_to_win: 15, best_of_sets: 3, golden_point: 21 } },
  { label: "11 · best of 5 · cap 15", vals: { points_to_win: 11, best_of_sets: 5, golden_point: 15 } },
  { label: "11 · best of 3 · cap 15", vals: { points_to_win: 11, best_of_sets: 3, golden_point: 15 } },
];

interface MatchRow { category: string; round: number; round_name: string | null; }
interface RuleRow extends RuleVals { category: string; round: number; round_name: string | null; }

interface ScoringTournament extends TournamentThemeInput {
  id: string;
  categories?: string[] | null;
}

const key = (category: string, round: number) => `${category}::${round}`;

export function ScoringRulesPanel({ tournament }: { tournament: ScoringTournament }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [edits, setEdits] = useState<Record<string, RuleVals>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, rRes] = await Promise.all([
      supabase.from("tournament_matches").select("category, round, round_name").eq("tournament_id", tournament.id),
      supabase.from("tournament_round_rules").select("*").eq("tournament_id", tournament.id),
    ]);
    if (mRes.error || rRes.error) {
      setLoadError(true);
    } else {
      setLoadError(false);
      setMatches((mRes.data as any) ?? []);
      setRules((rRes.data as any) ?? []);
      setEdits({});
    }
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  // Build category → ordered rounds (with names) from the generated draw.
  const byCategory = useMemo(() => {
    const map = new Map<string, Map<number, string | null>>();
    for (const m of matches) {
      if (!map.has(m.category)) map.set(m.category, new Map());
      const rm = map.get(m.category)!;
      if (!rm.has(m.round)) rm.set(m.round, m.round_name);
    }
    return Array.from(map.entries())
      .map(([category, rm]) => ({
        category,
        rounds: Array.from(rm.entries()).map(([round, round_name]) => ({ round, round_name })).sort((a, b) => a.round - b.round),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [matches]);

  const ruleFor = (category: string, round: number): RuleVals =>
    rules.find((r) => r.category === category && r.round === round) ?? DEFAULT_RULE;

  const valueFor = (category: string, round: number): RuleVals =>
    edits[key(category, round)] ?? ruleFor(category, round);

  const isDirty = (category: string, round: number): boolean => {
    const e = edits[key(category, round)];
    if (!e) return false;
    const base = ruleFor(category, round);
    return e.points_to_win !== base.points_to_win || e.best_of_sets !== base.best_of_sets || e.golden_point !== base.golden_point;
  };

  const setField = (category: string, round: number, field: keyof RuleVals, raw: string) => {
    const n = raw === "" ? 0 : (parseInt(raw, 10) || 0);
    setEdits((prev) => ({ ...prev, [key(category, round)]: { ...valueFor(category, round), [field]: n } }));
  };

  const applyToCategory = (category: string, vals: RuleVals) => {
    const cat = byCategory.find((c) => c.category === category);
    if (!cat) return;
    setEdits((prev) => {
      const next = { ...prev };
      cat.rounds.forEach(({ round }) => { next[key(category, round)] = { ...vals }; });
      return next;
    });
  };

  const saveRule = async (category: string, round: number, round_name: string | null) => {
    const vals = valueFor(category, round);
    const clamped = { points_to_win: Math.max(1, vals.points_to_win), best_of_sets: Math.max(1, vals.best_of_sets), golden_point: Math.max(1, vals.golden_point) };
    const { error: upErr } = await supabase.from("tournament_round_rules").upsert({
      tournament_id: tournament.id, category, round, round_name, ...clamped,
    }, { onConflict: "tournament_id,category,round" });
    if (upErr) throw upErr;
    // Push the rule onto existing matches so live/scheduled matches pick it up.
    const { error: mErr } = await supabase.from("tournament_matches").update({ ...vals })
      .eq("tournament_id", tournament.id).eq("category", category).eq("round", round);
    if (mErr) throw mErr;
  };

  const saveOne = async (category: string, round: number, round_name: string | null) => {
    setSavingKey(key(category, round));
    try {
      await saveRule(category, round, round_name);
      toast.success(`${CAT_LABELS[category] ?? category} · ${round_name ?? `R${round}`} saved`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save rule");
    } finally {
      setSavingKey(null);
    }
  };

  const dirtyKeys = useMemo(
    () => byCategory.flatMap((c) => c.rounds.filter((r) => isDirty(c.category, r.round)).map((r) => ({ category: c.category, round: r.round, round_name: r.round_name }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edits, byCategory, rules],
  );

  const saveAll = async () => {
    if (dirtyKeys.length === 0) return;
    setSavingAll(true);
    const p = toast.loading(`Saving ${dirtyKeys.length} rule${dirtyKeys.length === 1 ? "" : "s"}…`);
    try {
      for (const d of dirtyKeys) await saveRule(d.category, d.round, d.round_name);
      toast.success("All scoring rules saved", { id: p });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not save rules", { id: p });
    } finally {
      setSavingAll(false);
    }
  };

  const cardCls = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm";
  const numCls = "w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-black text-center outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <ThemeScope {...tournament} className="space-y-4">
      {/* Header */}
      <div className={`${cardCls} flex items-start gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gauge className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-slate-800 dark:text-foreground">Scoring Rules</h3>
          <p className="text-xs text-muted-foreground">
            Set points, games and the point cap per {tournament.format_family === "TEAM" ? "rubber discipline" : "format"} and round.
            The umpire desk reads these live for every match.
          </p>
        </div>
        {dirtyKeys.length > 0 && (
          <button
            onClick={saveAll}
            disabled={savingAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition disabled:opacity-50 shrink-0"
          >
            {savingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save all ({dirtyKeys.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className={`${cardCls} flex items-center justify-center py-12 text-muted-foreground`}><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : loadError ? (
        <div className={`${cardCls} text-center py-10`}>
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load scoring rules</p>
          <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : byCategory.length === 0 ? (
        <div className={`${cardCls} text-center py-10`}>
          <Layers className="w-9 h-9 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">No rounds yet</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {tournament.format_family === "TEAM"
              ? "Schedule ties and generate rubbers first — the rounds and disciplines will appear here to set rules for."
              : "Generate the bracket first — each format's rounds will appear here to set rules for."}
          </p>
        </div>
      ) : (
        byCategory.map(({ category, rounds }) => (
          <div key={category} className={cardCls}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-black">{CAT_LABELS[category] ?? category}</span>
              <span className="text-[11px] font-bold text-muted-foreground">{rounds.length} round{rounds.length === 1 ? "" : "s"}</span>
              {/* Quick presets apply to all rounds of this category */}
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <Wand2 className="w-3.5 h-3.5 text-slate-400" />
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyToCategory(category, p.vals)}
                    className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black hover:bg-primary/10 hover:text-primary transition"
                    title={`Apply "${p.label}" to all rounds`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1.4fr_auto_auto_auto_auto] gap-2 items-center px-1 mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>Round</span>
              <span className="text-center w-16">Points</span>
              <span className="text-center w-16">Best of</span>
              <span className="text-center w-16">Cap</span>
              <span className="w-[72px]" />
            </div>

            <div className="space-y-1.5">
              {rounds.map(({ round, round_name }) => {
                const v = valueFor(category, round);
                const dirty = isDirty(category, round);
                const k = key(category, round);
                return (
                  <div key={round} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_auto_auto_auto_auto] gap-2 items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 col-span-2 sm:col-span-1">
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate">{round_name ?? `Round ${round}`}</span>
                      {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Unsaved" />}
                    </div>
                    <input type="number" min={1} value={v.points_to_win || ""} onChange={(e) => setField(category, round, "points_to_win", e.target.value)} onBlur={() => { if (!v.points_to_win) setField(category, round, "points_to_win", "1"); }} className={numCls} aria-label="Points to win" />
                    <input type="number" min={1} step={2} value={v.best_of_sets || ""} onChange={(e) => setField(category, round, "best_of_sets", e.target.value)} onBlur={() => { if (!v.best_of_sets) setField(category, round, "best_of_sets", "1"); }} className={numCls} aria-label="Best of games" />
                    <input type="number" min={1} value={v.golden_point || ""} onChange={(e) => setField(category, round, "golden_point", e.target.value)} onBlur={() => { if (!v.golden_point) setField(category, round, "golden_point", "1"); }} className={numCls} aria-label="Point cap" />
                    <button
                      onClick={() => saveOne(category, round, round_name)}
                      disabled={savingKey === k || !dirty}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black transition disabled:opacity-40 w-[72px]"
                    >
                      {savingKey === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>Saving a rule also updates matches already created for that round. The umpire desk always loads the latest rule, so changes apply to matches started afterwards.</span>
      </div>
    </ThemeScope>
  );
}
