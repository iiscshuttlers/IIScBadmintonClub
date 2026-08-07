import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, BellOff, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

export default function SubscriptionsPage() {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [playerSubs, setPlayerSubs] = useState<any[]>([]);
  const [matchSubs, setMatchSubs] = useState<any[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadSubscriptions();
  }, [session?.user?.id]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const [playerRes, matchRes] = await Promise.all([
        supabase
          .from("user_player_subscriptions")
          .select("*, players(*)")
          .eq("user_id", session!.user.id),
        supabase
          .from("user_match_notifications")
          .select("*, tournament_matches(team1_label, team2_label, scheduled_at, category, match_code)")
          .eq("user_id", session!.user.id)
      ]);

      if (playerRes.error) throw playerRes.error;
      if (matchRes.error) throw matchRes.error;

      setPlayerSubs(playerRes.data || []);
      setMatchSubs(matchRes.data || []);
    } catch (e: any) {
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const removePlayerSub = async (playerId: string) => {
    try {
      await supabase
        .from("user_player_subscriptions")
        .delete()
        .eq("user_id", session!.user.id)
        .eq("player_id", playerId);
      toast.success("Subscription removed");
      setPlayerSubs((s) => s.filter((p) => p.player_id !== playerId));
    } catch (e) {
      toast.error("Failed to remove subscription");
    }
  };

  const removeMatchSub = async (matchId: string) => {
    try {
      await supabase
        .from("user_match_notifications")
        .delete()
        .eq("user_id", session!.user.id)
        .eq("match_id", matchId);
      toast.success("Match alert removed");
      setMatchSubs((s) => s.filter((m) => m.match_id !== matchId));
    } catch (e) {
      toast.error("Failed to remove alert");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] p-4 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 bg-white/90 hover:bg-white text-slate-700 dark:bg-slate-800/80 dark:text-white backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            My Subscriptions
          </h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Player Subscriptions ({playerSubs.length})
              </h2>
              {playerSubs.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <BellOff className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    You haven't subscribed to any players yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {playerSubs.map((sub) => (
                    <div key={sub.player_id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
                      <div>
                        <Link href={`/player/${sub.player_id}`}>
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors cursor-pointer">
                            {sub.players?.full_name || "Unknown Player"}
                          </h3>
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Alerts set for {sub.notify_before_mins} mins before matches
                        </p>
                      </div>
                      <button
                        onClick={() => removePlayerSub(sub.player_id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors"
                        title="Remove Subscription"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Match Alerts ({matchSubs.length})
              </h2>
              {matchSubs.length === 0 ? (
                <div className="text-center py-8 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <BellOff className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    You haven't set any specific match alerts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchSubs.map((sub) => {
                    const m = sub.tournament_matches;
                    return (
                      <div key={sub.match_id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              {m?.category}
                            </span>
                            {m?.scheduled_at && (
                              <span className="text-[10px] font-bold text-slate-500">
                                {new Date(m.scheduled_at).toLocaleDateString()} {new Date(m.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {m?.team1_label || "TBD"} vs {m?.team2_label || "TBD"}
                          </h3>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Alert: {sub.notify_before_mins} mins before
                          </p>
                        </div>
                        <button
                          onClick={() => removeMatchSub(sub.match_id)}
                          className="p-2 shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full transition-colors"
                          title="Remove Alert"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
