import { useState, useEffect, useCallback } from "react";
import { Loader2, LayoutList, Tv2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCourtColor, cn } from "@/lib/utils";
import { BracketVisual } from "@/components/tournament/BracketVisual";
import { MatchScoreDisplay } from "@/components/tournament/MatchScoreDisplay";

interface PastMatch {
  id: string;
  category: string;
  match_code: string;
  round: number;
  round_name: string;
  match_number: number;
  team1_label: string | null;
  team2_label: string | null;
  winner_side: 1 | 2 | null;
  score: string | null;
  sets_history: string[] | null;
  status: string;
  scheduled_at?: string | null;
  court_number?: string | null;
}

/**
 * Read-only bracket/results view for a completed tournament. Rendered on the
 * tournament archive page (`/events/:slug`, TournamentDetail).
 */
export function TournamentArchiveBrackets({ tournamentId }: { tournamentId: string }) {
  const [matches, setMatches] = useState<PastMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "bracket">("list");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Supabase will throw 400 if we pass a non-UUID string to a UUID column
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tournamentId);
    if (!isUUID) {
      setMatches([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_matches")
      .select("id,category,match_code,round,round_name,match_number,team1_label,team2_label,winner_side,score,sets_history,status")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("match_number");
    if (error) {
      setLoadError(true);
    } else {
      setLoadError(false);
      const loadedMatches = (data as PastMatch[]) ?? [];
      setMatches(loadedMatches);
      if (loadedMatches.length > 0) {
        const cats = [...new Set(loadedMatches.map((m: any) => m.category))];
        if (cats.length > 0) setActiveCategory(cats[0]);
      }
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (loadError) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 text-center">
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Couldn't load the results.</p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition">Retry</button>
      </div>
    );
  }

  const categories = [...new Set(matches.map((m) => m.category))];

  if (!matches.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 text-center">
        <p className="text-muted-foreground">No match results recorded for this tournament.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 space-y-6">
      {categories.length > 0 && matches.length > 0 && (
        <div className="space-y-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button onClick={() => setViewMode("list")} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition ${viewMode === "list" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
              <LayoutList className="w-3.5 h-3.5" /> List View
            </button>
            <button onClick={() => setViewMode("bracket")} className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition ${viewMode === "bracket" ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-foreground shadow" : "text-muted-foreground hover:text-muted-foreground dark:hover:text-slate-300"}`}>
              <Tv2 className="w-3.5 h-3.5" /> Bracket Tree
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:border-primary"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {viewMode === "bracket" && activeCategory ? (
        <div className="overflow-x-auto pb-4">
          {(() => {
            const catMatches = matches.filter((m) => m.category === activeCategory);
            const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
            return <BracketVisual matches={catMatches as any} rounds={rounds} category={activeCategory} />;
          })()}
        </div>
      ) : (
        <>
          {[activeCategory].filter(Boolean).map((cat) => {
            const catMatches = matches.filter((m) => m.category === cat);
            const rounds = [...new Set(catMatches.map((m) => m.round))].sort((a, b) => a - b);
            return (
              <div key={cat}>
                <h4 className="text-sm font-black text-muted-foreground dark:text-slate-200 mb-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-700 text-muted-foreground dark:text-slate-300">{cat}</span>
                </h4>
                <div className="space-y-4">
                  {rounds.map((round) => {
                    const roundMatches = catMatches.filter((m) => m.round === round);
                    return (
                      <div key={round}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{roundMatches[0]?.round_name}</p>
                        <div className="grid gap-2">
                          {roundMatches.map((m) => (
                            <div key={m.id} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-muted-foreground">{m.match_code}</span>
                                {m.status === "walkover" && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600">W/O</span>
                                )}
                                {m.status === "scheduled" && !m.scheduled_at && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-muted-foreground">Not scheduled yet</span>
                                )}
                                {m.status === "scheduled" && m.scheduled_at && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                                    Scheduled at {new Date(m.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                    {m.court_number ? <span className={cn("ml-1 font-black", getCourtColor(m.court_number))}>(Court {m.court_number})</span> : ""}
                                  </span>
                                )}
                                {m.status === "in_progress" && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600">In Progress</span>
                                )}
                                {m.status === "completed" && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 dark:bg-primary/40 text-primary">Completed</span>
                                )}
                              </div>
                              <MatchScoreDisplay
                                sets_history={m.sets_history}
                                score={m.score}
                                team1_label={m.team1_label ?? "TBD"}
                                team2_label={m.team2_label ?? "TBD"}
                                winner_side={m.winner_side}
                                status={m.status}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
