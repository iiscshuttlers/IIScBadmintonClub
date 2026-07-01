import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Users, Shield, Plus, Loader2 } from "lucide-react";
import { TeamRegistration } from "../TeamRegistration";
import { Link } from "wouter";
import { usePlayers } from "@/hooks/usePlayers";

export function TeamsTab() {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("doubles");
  const { data: players } = usePlayers();
  const [showRegistration, setShowRegistration] = useState(false);

  const fetchTeams = async () => {
    setLoading(true);
    // Since the table might not exist yet, we wrap in try/catch and handle gracefully
    try {
      const { data, error } = await supabase
        .from("doubles_teams")
        .select("*")
        .order("elo_rating", { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (err: any) {
      console.error("Failed to fetch teams:", err.message);
      setTeams([]); // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const filteredTeams = teams.filter((t) => 
    category === "doubles" ? (t.category === "MD" || t.category === "WD") : t.category === category
  );

  return (
    <div className="font-sans animate-in fade-in zoom-in-95 duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground dark:text-foreground flex items-center gap-2">
              <Shield className="w-8 h-8 text-violet-500" /> Official Teams
            </h1>
            <p className="text-muted-foreground font-medium mt-1">
              Registered partnerships and their combined Elo ratings
            </p>
          </div>

          <button
            onClick={() => setShowRegistration(!showRegistration)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all bg-violet-600 hover:bg-violet-700 text-foreground shadow-lg shadow-violet-500/20"
          >
            {showRegistration ? "Cancel" : <><Plus className="w-4 h-4" /> Register New Team</>}
          </button>
        </div>

        {showRegistration && (
          <div className="animate-in slide-in-from-top-4">
            <TeamRegistration onTeamRegistered={() => {
              setShowRegistration(false);
              fetchTeams();
            }} />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {["doubles", "XD"].map((cat) => (
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

        {loading ? (
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
                    <h3 className="text-lg font-black text-foreground dark:text-foreground truncate">
                      {team.team_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground truncate">
                        {p1?.full_name || "Unknown"}
                        {p1?.is_retired && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-rose-500 text-foreground shadow-sm shrink-0">
                            Retired
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-slate-300 font-bold">&</span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground truncate">
                        {p2?.full_name || "Unknown"}
                        {p2?.is_retired && (
                          <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm bg-rose-500 text-foreground shadow-sm shrink-0">
                            Retired
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end text-right">
                    <div className="flex items-center gap-1.5 text-lg font-black text-primary dark:text-primary">
                      <Trophy className="w-4 h-4" />
                      {team.elo_rating}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                      {team.matches_won}W - {team.matches_played - team.matches_won}L
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
