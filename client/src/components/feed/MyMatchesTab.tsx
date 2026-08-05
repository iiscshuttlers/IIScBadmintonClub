import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Clock, MapPin, Trophy, ShieldAlert } from "lucide-react";
import { MatchScoreDisplay } from "../tournament/MatchScoreDisplay";

export function MyMatchesTab() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchMatches = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tournament_matches")
        .select(`
          *,
          tournaments ( name )
        `)
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id},player3_id.eq.${profile.id},player4_id.eq.${profile.id},umpired_by.eq.${profile.id}`)
        .order("scheduled_at", { ascending: true, nullsFirst: false });

      if (!error && data) {
        setMatches(data);
      }
      setLoading(false);
    };

    fetchMatches();
  }, [profile?.id]);

  if (!profile) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto pb-12">
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 h-32" />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-6">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-black text-foreground mb-2">No Matches Found</h3>
          <p className="text-muted-foreground">You do not have any tournament matches scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-4 mt-2">
          {matches.map((m: any) => {
            const isUmpire = m.umpired_by === profile.id;
            
            return (
              <div key={m.id} className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border shadow-sm transition-all relative overflow-hidden ${isUmpire ? 'border-amber-200 dark:border-amber-900/50' : 'border-slate-200 dark:border-slate-800'}`}>
                {isUmpire && (
                  <div className="absolute top-0 right-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1.5 z-10">
                    <ShieldAlert className="w-3 h-3" />
                    UMPIRE DUTY
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-3 mt-1">
                  <div className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">
                    {m.category} {m.round_name ? `- ${m.round_name}` : ''}
                  </div>
                  <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{m.tournaments?.name}</span>
                </div>
                
                <div className="mb-4">
                  <MatchScoreDisplay 
                    sets_history={m.sets_history}
                    team1_label={m.team1_label || 'TBD'}
                    team2_label={m.team2_label || 'TBD'}
                    winner_side={m.winner_side}
                    status={m.status}
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {m.scheduled_at && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="font-medium">{new Date(m.scheduled_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                  {m.court_number && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-500" />
                      <span className="font-medium">Court {m.court_number}</span>
                    </div>
                  )}
                  {m.status === 'completed' && (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span className="font-medium text-amber-600 dark:text-amber-400">Completed</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
