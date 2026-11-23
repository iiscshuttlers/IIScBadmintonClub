import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tournamentService } from "@/services/tournamentService";
import { toast } from "sonner";
import { ThemeScope } from "@/components/tournament/ThemeScope";
import type { TournamentThemeInput } from "@/lib/tournamentTheme";
import { pairRounds } from "@/lib/roundRuleCopy";
import {
  Loader2, Gauge, Check, Wand2, RefreshCw, Info, AlertTriangle, Layers, Copy,
} from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles", MD: "Men's Doubles",
  WD: "Women's Doubles", XD: "Mixed Doubles", BS: "Boys' Singles",
  GS: "Girls' Singles", BD: "Boys' Doubles", GD: "Girls' Doubles",
};
const catLabel = (c: string) => CAT_LABELS[c] ?? c;

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
/** `label` is display only ("Semifinal + 3rd Place Playoff"); never send it to the database. */
type RoundMeta = MatchRow & { label: string };
type SaveState = "saving" | "saved" | "error";

interface ScoringTournament extends TournamentThemeInput {
  id: string;
  categories?: string[] | null;
}

const key = (category: string, round: number) => `${category}::${round}`;
const same = (a: RuleVals, b: RuleVals) =>
  a.points_to_win === b.points_to_win && a.best_of_sets === b.best_of_sets && a.golden_point === b.golden_point;
/** A field cleared mid-typing is 0; wait for a whole value before saving. */
const complete = (v: RuleVals) => v.points_to_win >= 1 && v.best_of_sets >= 1 && v.golden_point >= 1;
/** Only the three numbers — a saved row's category/round must never ride along into a copy. */
const ruleOf = (rules: RuleRow[], category: string, round: number): RuleVals => {
  const r = rules.find((x) => x.category === category && x.round === round) ?? DEFAULT_RULE;
  return { points_to_win: r.points_to_win, best_of_sets: r.best_of_sets, golden_point: r.golden_point };
};
const short = (v: RuleVals) => `${v.points_to_win} · best of ${v.best_of_sets} · cap ${v.golden_point}`;
const roundLabel = (m: { label: string }) => m.label;
/** A rule as a select value: "21|3|30". */
const encode = (v: RuleVals) => `${v.points_to_win}|${v.best_of_sets}|${v.golden_point}`;
const decode = (s: string): RuleVals => {
  const [points_to_win, best_of_sets, golden_point] = s.split("|").map(Number);
  return { points_to_win, best_of_sets, golden_point };
};
/** "MS QF" for the picker's "used in" note. */
const usedName = (category: string, m: { round_name: string | null; round: number }) =>
  `${category} ${(m.round_name ?? `R${m.round}`)
    .replace(/^Quarter-?finals?$/i, "QF")
    .replace(/^Semi-?finals?$/i, "SF")
    .replace(/^Round of /i, "R")}`;

/** Typing pause before a change saves. Blur and copy actions save sooner. */
const TYPING_DELAY_MS = 800;
const COPY_DELAY_MS = 250;
const SAVED_BADGE_MS = 2500;

/**
 * Scoring rules per format and round. Every change saves on its own (after a
 * typing pause, or at once on blur) and updates the row in place, so the list
 * never reloads or flashes a spinner while you edit.
 */
export function ScoringRulesPanel({ tournament }: { tournament: ScoringTournament }) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [rules, setRulesState] = useState<RuleRow[]>([]);
  const [edits, setEditsState] = useState<Record<string, RuleVals>>({});
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Timers and in-flight saves read the latest values through refs, so a save
  // fired by a timer never works from a stale render.
  const rulesRef = useRef<RuleRow[]>([]);
  const editsRef = useRef<Record<string, RuleVals>>({});
  const metaRef = useRef(new Map<string, RoundMeta>());
  const tidRef = useRef(tournament.id);
  tidRef.current = tournament.id;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const badgeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(new Set<string>());
  const saveAgain = useRef(new Set<string>());

  const updateRules = (fn: (prev: RuleRow[]) => RuleRow[]) => {
    rulesRef.current = fn(rulesRef.current);
    setRulesState(rulesRef.current);
  };
  const updateEdits = (fn: (prev: Record<string, RuleVals>) => Record<string, RuleVals>) => {
    editsRef.current = fn(editsRef.current);
    setEditsState(editsRef.current);
  };
  const setStatusFor = (k: string, s: SaveState | undefined) => {
    const t = badgeTimers.current.get(k);
    if (t) clearTimeout(t);
    setStatus((prev) => {
      if (prev[k] === s) return prev;
      const next = { ...prev };
      if (s) next[k] = s;
      else delete next[k];
      return next;
    });
    if (s === "saved") {
      badgeTimers.current.set(k, setTimeout(() => setStatus((prev) => {
        if (prev[k] !== "saved") return prev;
        const next = { ...prev };
        delete next[k];
        return next;
      }), SAVED_BADGE_MS));
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRows, rRows] = await Promise.all([
        tournamentService.fetchTournamentMatchesForRounds(tournament.id),
        tournamentService.fetchTournamentRoundRules(tournament.id),
      ]);
      setLoadError(false);
      setMatches(mRows as MatchRow[]);
      rulesRef.current = rRows as RuleRow[];
      setRulesState(rulesRef.current);
      editsRef.current = {};
      setEditsState({});
      setStatus({});
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  // Build category → ordered rounds (with names) from the generated draw.
  // A rule is per round number, and the 3rd place playoff shares its number
  // with the semifinal, so a round lists every name it covers.
  const byCategory = useMemo(() => {
    const map = new Map<string, Map<number, string[]>>();
    for (const m of matches) {
      if (!map.has(m.category)) map.set(m.category, new Map());
      const rm = map.get(m.category)!;
      const names = rm.get(m.round) ?? [];
      if (m.round_name && !names.includes(m.round_name)) names.push(m.round_name);
      rm.set(m.round, names);
    }
    const isPlayoff = (n: string) => /3rd|third/i.test(n);
    return Array.from(map.entries())
      .map(([category, rm]) => ({
        category,
        rounds: Array.from(rm.entries())
          .map(([round, names]) => {
            const ordered = [...names.filter((n) => !isPlayoff(n)), ...names.filter(isPlayoff)];
            return { round, round_name: ordered[0] ?? null, label: ordered.length ? ordered.join(" + ") : `Round ${round}` };
          })
          .sort((a, b) => a.round - b.round),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [matches]);

  metaRef.current = useMemo(() => {
    const m = new Map<string, RoundMeta>();
    for (const c of byCategory) for (const r of c.rounds) m.set(key(c.category, r.round), { category: c.category, ...r });
    return m;
  }, [byCategory]);

  /** Latest value for a row: an unsaved edit, else the saved rule. */
  const current = (k: string): RuleVals => {
    const meta = metaRef.current.get(k);
    return editsRef.current[k] ?? (meta ? ruleOf(rulesRef.current, meta.category, meta.round) : DEFAULT_RULE);
  };
  const valueFor = (category: string, round: number): RuleVals =>
    edits[key(category, round)] ?? ruleOf(rules, category, round);
  const isDirty = (category: string, round: number): boolean => {
    const e = edits[key(category, round)];
    return !!e && !same(e, ruleOf(rules, category, round));
  };

  const flush = async (k: string): Promise<void> => {
    const t = timers.current.get(k);
    if (t) { clearTimeout(t); timers.current.delete(k); }
    if (inFlight.current.has(k)) { saveAgain.current.add(k); return; }
    const vals = editsRef.current[k];
    const meta = metaRef.current.get(k);
    if (!vals || !meta || !complete(vals)) return;
    if (same(vals, ruleOf(rulesRef.current, meta.category, meta.round))) {
      updateEdits((prev) => { const { [k]: _drop, ...rest } = prev; return rest; });
      setStatusFor(k, undefined);
      return;
    }
    inFlight.current.add(k);
    setStatusFor(k, "saving");
    try {
      // Saves the rule and pushes it onto that round's matches so live and
      // scheduled matches pick it up. Hosts may call this as well as admins.
      const rule: RuleRow = {
        category: meta.category, round: meta.round, round_name: meta.round_name,
        points_to_win: vals.points_to_win, best_of_sets: vals.best_of_sets, golden_point: vals.golden_point,
      };
      await tournamentService.setTournamentRoundRule({ tournament_id: tidRef.current, ...rule });
      updateRules((prev) => [...prev.filter((r) => !(r.category === meta.category && r.round === meta.round)), rule]);
      // Keep any newer typing; drop the edit only if it is what was saved.
      updateEdits((prev) => {
        if (!prev[k] || !same(prev[k], vals)) return prev;
        const { [k]: _drop, ...rest } = prev;
        return rest;
      });
      setStatusFor(k, "saved");
    } catch (e: any) {
      setStatusFor(k, "error");
      toast.error(`${catLabel(meta.category)} · ${roundLabel(meta)} didn't save: ${e?.message || "try again"}`, { id: `rule-${k}` });
    } finally {
      inFlight.current.delete(k);
      if (saveAgain.current.delete(k)) void flushRef.current(k);
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const scheduleSave = (k: string, delay: number) => {
    const t = timers.current.get(k);
    if (t) clearTimeout(t);
    timers.current.set(k, setTimeout(() => void flushRef.current(k), delay));
  };

  // Leaving the panel mid-pause still saves what was typed.
  useEffect(() => () => {
    for (const k of Array.from(timers.current.keys())) void flushRef.current(k);
    badgeTimers.current.forEach(clearTimeout);
  }, []);

  const setField = (category: string, round: number, field: keyof RuleVals, raw: string) => {
    const n = raw === "" ? 0 : (parseInt(raw, 10) || 0);
    const k = key(category, round);
    updateEdits((prev) => ({ ...prev, [k]: { ...current(k), [field]: n } }));
    scheduleSave(k, TYPING_DELAY_MS);
  };

  const onFieldBlur = (category: string, round: number, field: keyof RuleVals) => {
    const k = key(category, round);
    if (!current(k)[field]) updateEdits((prev) => ({ ...prev, [k]: { ...current(k), [field]: 1 } }));
    void flush(k);
  };

  /** Writes several rows at once (presets, copies) with an Undo on the toast. */
  const applyChanges = (changes: Record<string, RuleVals>, message?: string) => {
    const changed = Object.entries(changes).filter(([k, v]) => !same(current(k), v));
    if (changed.length === 0) {
      if (message) toast.info("Already the same — nothing to change", { id: "rules-copy" });
      return;
    }
    const before = Object.fromEntries(changed.map(([k]) => [k, current(k)]));
    updateEdits((prev) => ({ ...prev, ...Object.fromEntries(changed) }));
    changed.forEach(([k]) => scheduleSave(k, COPY_DELAY_MS));
    if (message) {
      toast.success(message, {
        id: "rules-copy",
        action: { label: "Undo", onClick: () => applyChanges(before) },
      });
    }
  };

  const applyPreset = (category: string, vals: RuleVals, label: string) => {
    const cat = byCategory.find((c) => c.category === category);
    if (!cat) return;
    applyChanges(
      Object.fromEntries(cat.rounds.map(({ round }) => [key(category, round), { ...vals }])),
      `${catLabel(category)}: every round set to ${label}`,
    );
  };

  const copyFormat = (target: string, source: string) => {
    const t = byCategory.find((c) => c.category === target);
    const s = byCategory.find((c) => c.category === source);
    if (!t || !s) return;
    const pairs = pairRounds(t.rounds, s.rounds);
    applyChanges(
      Object.fromEntries(t.rounds.map(({ round }) => [key(target, round), { ...current(key(source, pairs.get(round)!)) }])),
      `${catLabel(target)}: rules copied from ${catLabel(source)}`,
    );
  };

  const setRoundRule = (targetKey: string, vals: RuleVals) => {
    const t = metaRef.current.get(targetKey);
    if (!t) return;
    applyChanges({ [targetKey]: vals }, `${catLabel(t.category)} · ${roundLabel(t)}: set to ${short(vals)}`);
  };

  // Every distinct rule in use, with where it's used: a round's picker offers
  // these (a handful) instead of every round of every format.
  const rulesInUse = (() => {
    const map = new Map<string, { vals: RuleVals; uses: string[] }>();
    for (const c of byCategory) {
      for (const r of c.rounds) {
        const vals = valueFor(c.category, r.round);
        if (!complete(vals)) continue;
        const code = encode(vals);
        const entry = map.get(code) ?? { vals, uses: [] };
        entry.uses.push(usedName(c.category, r));
        map.set(code, entry);
      }
    }
    return Array.from(map.entries())
      .map(([code, e]) => ({ code, ...e }))
      .sort((a, b) => b.uses.length - a.uses.length);
  })();
  const unusedPresets = PRESETS.filter((p) => !rulesInUse.some((u) => u.code === encode(p.vals)));

  const saving = Object.values(status).filter((s) => s === "saving").length;
  const failed = Object.entries(status).filter(([, s]) => s === "error").map(([k]) => k);

  const cardCls = "bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-sm";
  const numCls = "w-full min-w-0 bg-muted border border-border-strong rounded-lg px-1 py-1.5 text-sm font-black text-center outline-none focus:ring-2 focus:ring-primary/40";
  // One row per round on every screen: name | points | best of | cap | copy.
  const rowGrid = "grid grid-cols-[minmax(0,1fr)_repeat(3,3rem)_2.25rem] sm:grid-cols-[minmax(0,1fr)_repeat(3,4rem)_2.25rem] gap-1.5 sm:gap-2 items-center";
  const chipCls = "px-2 py-1 rounded-lg bg-muted text-soft text-[10px] font-black hover:bg-primary/10 hover:text-primary transition";

  return (
    <ThemeScope {...tournament} className="space-y-4">
      {/* Header */}
      <div className={`${cardCls} flex items-center gap-3`}>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Gauge className="w-[18px] h-[18px] text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-foreground leading-tight">Scoring Rules</h3>
          <p className="text-xs text-muted-foreground">Points, games and cap for each round. Saves as you type.</p>
        </div>
        {/* Shown only while something is saving or failed; the line above covers the idle state. */}
        <div className="shrink-0 text-[11px] font-bold" aria-live="polite">
          {failed.length > 0 ? (
            <button
              type="button"
              onClick={() => failed.forEach((k) => void flush(k))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden /> {failed.length} not saved · Retry
            </button>
          ) : saving > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Saving…
            </span>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className={`${cardCls} flex items-center justify-center py-12 text-muted-foreground`}><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : loadError ? (
        <div className={`${cardCls} text-center py-10`}>
          <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
          <p className="text-sm font-bold text-soft">Couldn't load scoring rules</p>
          <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      ) : byCategory.length === 0 ? (
        <div className={`${cardCls} text-center py-10`}>
          <Layers className="w-9 h-9 text-faint mx-auto mb-2" />
          <h4 className="text-sm font-black text-soft">No rounds yet</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {tournament.format_family === "TEAM"
              ? "Rounds and disciplines appear here once ties are scheduled and their rubbers are made."
              : "Each format's rounds appear here once the draw is made."}
          </p>
        </div>
      ) : (
        byCategory.map(({ category, rounds }) => {
          const otherFormats = byCategory.filter((c) => c.category !== category);
          return (
            <div key={category} className={cardCls}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-black">{catLabel(category)}</span>
                <span className="text-[11px] font-bold text-muted-foreground">{rounds.length} round{rounds.length === 1 ? "" : "s"}</span>
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  {otherFormats.length > 0 && (
                    <label className={`${chipCls} relative inline-flex items-center gap-1 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40`}>
                      <Copy className="w-3 h-3" aria-hidden /> Copy from format
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) copyFormat(category, e.target.value); }}
                        aria-label={`Copy every round's rule into ${catLabel(category)} from another format`}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      >
                        <option value="" disabled>Copy every round from…</option>
                        {otherFormats.map((c) => (
                          <option key={c.category} value={c.category}>{catLabel(c.category)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {/* Quick presets apply to all rounds of this category */}
                  <Wand2 className="w-3.5 h-3.5 text-muted-foreground ml-1" aria-hidden />
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(category, p.vals, p.label)}
                      className={chipCls}
                      title={`Apply "${p.label}" to all rounds`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column headers */}
              <div className={`${rowGrid} px-1 mb-1 text-[10px] leading-tight font-black uppercase tracking-wide text-muted-foreground`}>
                <span>Round</span>
                <span className="text-center">Points</span>
                <span className="text-center">Best of</span>
                <span className="text-center">Cap</span>
                <span />
              </div>

              <div>
                {rounds.map((r) => {
                  const { round } = r;
                  const v = valueFor(category, round);
                  const k = key(category, round);
                  const st = status[k];
                  const dirty = isDirty(category, round) && st !== "saving";
                  // The status sits beside the round name (the number columns
                  // are fixed widths, so it never shifts them); phones get the icon only.
                  const stText = "sr-only sm:not-sr-only";
                  return (
                    <div key={round} className={`${rowGrid} py-1.5 border-b border-border last:border-0`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs sm:text-sm font-black text-soft leading-tight break-words min-w-0">{roundLabel(r)}</span>
                        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title="Not saved yet" />}
                        {st && (
                          <span className="shrink-0 text-[11px] font-bold">
                            {st === "saving" ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" aria-hidden /> <span className={stText}>Saving</span></span>
                            ) : st === "saved" ? (
                              <span className="inline-flex items-center gap-1 text-success"><Check className="w-3 h-3" aria-hidden /> <span className={stText}>Saved</span></span>
                            ) : (
                              <button type="button" onClick={() => void flush(k)} className="inline-flex items-center gap-1 p-1 -m-1 text-danger hover:underline">
                                <RefreshCw className="w-3 h-3" aria-hidden /> <span className={stText}>Retry</span>
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                      <input type="number" min={1} value={v.points_to_win || ""} onChange={(e) => setField(category, round, "points_to_win", e.target.value)} onBlur={() => onFieldBlur(category, round, "points_to_win")} className={numCls} aria-label={`${roundLabel(r)} points to win`} />
                      <input type="number" min={1} step={2} value={v.best_of_sets || ""} onChange={(e) => setField(category, round, "best_of_sets", e.target.value)} onBlur={() => onFieldBlur(category, round, "best_of_sets")} className={numCls} aria-label={`${roundLabel(r)} best of games`} />
                      <input type="number" min={1} value={v.golden_point || ""} onChange={(e) => setField(category, round, "golden_point", e.target.value)} onBlur={() => onFieldBlur(category, round, "golden_point")} className={numCls} aria-label={`${roundLabel(r)} point cap`} />
                      <div className="flex items-center justify-end">
                        <label
                          className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary focus-within:ring-2 focus-within:ring-primary/40 transition cursor-pointer"
                          title="Use a rule from another round"
                        >
                          <Copy className="w-4 h-4" aria-hidden />
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) setRoundRule(k, decode(e.target.value)); }}
                            aria-label={`Set ${catLabel(category)} ${roundLabel(r)} to a rule used elsewhere`}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer"
                          >
                            <option value="" disabled>Use the rule from…</option>
                            {rulesInUse.filter((u) => u.code !== encode(v)).length > 0 && (
                              <optgroup label="In use">
                                {rulesInUse
                                  .filter((u) => u.code !== encode(v))
                                  .map((u) => (
                                    <option key={u.code} value={u.code}>
                                      {short(u.vals)} ({u.uses.length > 3 ? `${u.uses.length} rounds` : u.uses.join(", ")})
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                            {unusedPresets.length > 0 && (
                              <optgroup label="Presets">
                                {unusedPresets.map((p) => (
                                  <option key={p.label} value={encode(p.vals)}>{p.label}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Copy buttons reuse another round's or format's rules. A change updates that round's matches; ones already started keep their rule.
        </span>
      </div>
    </ThemeScope>
  );
}
