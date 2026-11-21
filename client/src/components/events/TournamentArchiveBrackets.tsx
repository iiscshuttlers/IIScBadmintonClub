import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, LayoutList, Tv2 } from "lucide-react";
import { fetchTournamentMatchViewRows } from "@/services/tournamentService";
import { BracketVisual } from "@/components/tournament/BracketVisual";
import { ResultsByRound } from "@/components/match/ResultsByRound";
import { toMatchView, type MatchRow } from "@/lib/matchView";

/**
 * Read-only bracket/results view for a completed tournament. Rendered on the
 * tournament archive page (`/events/:slug`, TournamentDetail). The list view
 * is the same Final-first results list as the tournament Results tab.
 */
export function TournamentArchiveBrackets({ tournamentId }: { tournamentId: string }) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "bracket">("list");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Supabase will throw 400 if we pass a non-UUID string to a UUID column
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentId);
    if (!isUUID) {
      setRows([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchTournamentMatchViewRows(tournamentId);
    if (error) {
      setLoadError(true);
    } else {
      setLoadError(false);
      const loaded = (data ?? []) as unknown as MatchRow[];
      setRows(loaded);
      const cats = [...new Set(loaded.map((m) => m.category))];
      if (cats.length > 0) setActiveCategory(cats[0]);
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => [...new Set(rows.map((m) => m.category))], [rows]);
  const catRows = useMemo(() => rows.filter((m) => m.category === activeCategory), [rows, activeCategory]);
  const catViews = useMemo(() => catRows.map((r) => toMatchView(r)), [catRows]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (loadError) {
    return (
      <div className="bg-card rounded-3xl shadow-sm border border-border p-6 text-center">
        <p className="text-sm font-bold text-foreground">Couldn't load the results.</p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-xs font-black transition">Retry</button>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="bg-card rounded-3xl shadow-sm border border-border p-6 text-center">
        <p className="text-muted-foreground">No match results recorded for this tournament.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-3xl shadow-sm border border-border p-4 sm:p-6 space-y-5">
      <div className="space-y-3 border-b border-border pb-4">
        <div className="flex items-center bg-muted p-1 rounded-xl w-fit" role="tablist" aria-label="Results view">
          {([
            { id: "list", label: "Results", icon: LayoutList },
            { id: "bracket", label: "Bracket", icon: Tv2 },
          ] as const).map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={viewMode === t.id}
              onClick={() => setViewMode(t.id)}
              className={`flex items-center justify-center gap-1.5 px-4 min-h-[40px] text-xs font-black uppercase tracking-widest rounded-lg transition ${
                viewMode === t.id ? "bg-muted-strong text-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" aria-hidden /> {t.label}
            </button>
          ))}
        </div>

        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Event">
            {categories.map((cat) => (
              <button
                key={cat}
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 min-h-[40px] rounded-xl text-xs font-black transition-colors border ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-soft hover:border-primary hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === "bracket" && activeCategory ? (
        <div className="overflow-x-auto pb-4">
          {(() => {
            // A bracket tree reads left → right, first round to Final.
            const rounds = [...new Set(catRows.map((m) => m.round ?? 0))].sort((a, b) => a - b);
            return <BracketVisual matches={catRows as any} rounds={rounds} category={activeCategory} />;
          })()}
        </div>
      ) : (
        <ResultsByRound views={catViews} emptyTitle="No matches in this event" />
      )}
    </div>
  );
}
