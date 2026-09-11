import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Users, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { usePlayers } from "@/hooks/usePlayers";
import { useAllTournamentMatches } from "@/hooks/useAllTournamentMatches";
import { useMemo } from "react";

interface TeamsTabProps {
  searchQuery?: string;
  tournamentFilter?: string;
}

export function TeamsTab({ searchQuery = "", tournamentFilter = "All" }: TeamsTabProps) {
  const getInitialParam = (param: string, defaultVal: string) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param) || defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [category, setCategory] = useState(() => getInitialParam("team_cat", "doubles"));

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("team_cat", category);
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  }, [category]);
  const { data: players } = usePlayers();
  
  const { data: allMatches = [], isLoading } = useAllTournamentMatches();

  const computedTeams = useMemo(() => {
    const map = new Map<string, any>();
    
    allMatches.forEach(m => {
       if (tournamentFilter !== "All" && m.tournament_id !== tournamentFilter) return;
       if (!m.player3_id) return; // not a doubles match
       
       const processTeam = (p1: string, p2: string, won: boolean) => {
          if (!p1 || !p2) return;
          const ids = [p1, p2].sort();
          const key = ids.join("_");
          if (!map.has(key)) {
             map.set(key, {
                id: key,
                player1_id: ids[0],
                player2_id: ids[1],
                category: m.category, // doubles, mixed
                matches_won: 0,
                matches_played: 0,
             });
          }
          const t = map.get(key);
          t.matches_played++;
          if (won) t.matches_won++;
       };

       processTeam(m.player1_id, m.player3_id, m.winner_side === 1);
       if (m.player2_id && m.player4_id) {
          processTeam(m.player2_id, m.player4_id, m.winner_side === 2);
       }
    });

    return Array.from(map.values()).sort((a, b) => {
       const aPct = a.matches_won / a.matches_played;
       const bPct = b.matches_won / b.matches_played;
       if (bPct !== aPct) return bPct - aPct;
       return b.matches_won - a.matches_won;
    });
  }, [allMatches, tournamentFilter]);

  const filteredTeams = computedTeams.filter((t) => {
    const isMixed = t.category?.toLowerCase() === "xd" || t.category?.toLowerCase() === "mixed";
    const isDoubles = t.category?.toLowerCase() === "md" || t.category?.toLowerCase() === "wd" || t.category?.toLowerCase() === "doubles";
    const categoryMatch = category === "doubles" ? isDoubles : isMixed;
    if (!categoryMatch) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const p1 = players?.find(p => p.id === t.player1_id);
      const p2 = players?.find(p => p.id === t.player2_id);
      const teamName = t.team_name?.toLowerCase() || "";
      const p1Name = p1?.full_name?.toLowerCase() || "";
      const p2Name = p2?.full_name?.toLowerCase() || "";
      
      return teamName.includes(query) || p1Name.includes(query) || p2Name.includes(query);
    }
    
    return true;
  });

  return (
    <div className="font-sans animate-in fade-in zoom-in-95 duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1" />
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {["doubles", "mixed"].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-2 rounded-xl text-sm font-black transition-all ${
                category === cat
                  ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700"
                  : "bg-white dark:bg-slate-900 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
              }`}
            >
              {cat === "doubles" ? "Doubles" : "Mixed Doubles"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
            <Users className="w-16 h-16 text-slate-300 dark:text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-black text-foreground dark:text-foreground mb-2">No Teams Found</h3>
            <p className="text-muted-foreground">There are no registered {category === "doubles" ? "Doubles" : "Mixed Doubles"} teams yet. Be the first to register a team!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTeams.map((team, index) => {
              const p1 = players?.find((p) => p.id === team.player1_id);
              const p2 = players?.find((p) => p.id === team.player2_id);

              return (
                <Link key={team.id} href={`/doubles/${team.player1_id}/${team.player2_id}`} className="flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 transition-all cursor-pointer group">
                  <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-black text-xl text-muted-foreground">
                    #{index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-foreground dark:text-foreground truncate flex items-center gap-2">
                      <span className="truncate">{p1?.full_name || "Unknown"}</span>
                      <span className="text-xs text-slate-300 font-bold">&</span>
                      <span className="truncate">{p2?.full_name || "Unknown"}</span>
                    </h3>

                  </div>

                  <div className="flex flex-col items-end text-right">
                    <div className="flex items-center gap-1.5 text-lg font-black text-primary dark:text-primary">
                      <Trophy className="w-4 h-4" />
                      {Math.round((team.matches_won / team.matches_played) * 100)}%
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                      {team.matches_won}W - {team.matches_played - team.matches_won}L ({team.matches_played} played)
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
