/**
 * Match Prediction / Bet-Points Game (#8)
 * Players predict outcomes of pending matches and earn/lose points.
 * Shows open predictions on recent pending matches.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Check, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";

interface PendingMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  created_at: string;
  player1?: { id: string; full_name: string; elo_rating: number };
  player2?: { id: string; full_name: string; elo_rating: number };
  myPrediction?: { predicted_winner_id: string; points_wagered: number };
}

export function MatchPredictions() {
  const { profile } = useAuth();
  const [pendingMatches, setPendingMatches] = useState<PendingMatch[]>([]);
  const [myPoints, setMyPoints] = useState<number>(100);
  const [loading, setLoading] = useState(true);
  const [wagering, setWagering] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!profile?.id) { setLoading(false); return; }

    const load = async () => {
      // Fetch recent pending matches (last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: matches } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, created_at, player1:players!player1_id(id, full_name, elo_rating), player2:players!player2_id(id, full_name, elo_rating)")
        .eq("status", "pending")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!matches || matches.length === 0) { setLoading(false); return; }

      // Fetch my predictions for these matches
      const matchIds = matches.map((m: any) => m.id);
      const { data: myPredictions } = await supabase
        .from("match_predictions")
        .select("match_id, predicted_winner_id, points_wagered")
        .eq("player_id", profile.id)
        .in("match_id", matchIds);

      const predMap: Record<string, any> = {};
      for (const p of myPredictions ?? []) {
        predMap[(p as any).match_id] = p;
      }

      setPendingMatches(
        (matches as any[]).map((m) => ({ ...m, myPrediction: predMap[m.id] })),
      );

      // Fetch my total prediction points
      const { data: pts } = await supabase
        .from("prediction_points")
        .select("total_points")
        .eq("player_id", profile.id)
        .single();
      if (pts) setMyPoints((pts as any).total_points);

      setLoading(false);
    };

    load();
  }, [profile?.id]);

  const predict = async (matchId: string, winnerId: string, wager: number) => {
    if (!profile?.id) return;
    if (wager > myPoints) {
      toast.error("Not enough prediction points!");
      return;
    }

    const { error } = await supabase.from("match_predictions").upsert(
      {
        match_id: matchId,
        player_id: profile.id,
        predicted_winner_id: winnerId,
        points_wagered: wager,
      },
      { onConflict: "match_id,player_id" },
    );

    if (error) {
      toast.error("Failed to submit prediction");
      return;
    }

    // Upsert prediction_points row (initialize if first time)
    await supabase.from("prediction_points").upsert(
      { player_id: profile.id, total_points: myPoints, predictions: 1, correct: 0 },
      { onConflict: "player_id" },
    );

    toast.success("Prediction locked in!");
    setPendingMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, myPrediction: { predicted_winner_id: winnerId, points_wagered: wager } }
          : m,
      ),
    );
  };

  if (!profile?.id || (pendingMatches.length === 0 && !loading)) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <h3 className="font-black text-slate-800 dark:text-white">Match Predictions</h3>
        </div>
        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Coins className="w-4 h-4" />
          <span className="text-sm font-black">{myPoints} pts</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {pendingMatches.map((m) => {
            const p1 = m.player1 as any;
            const p2 = m.player2 as any;
            const myPred = m.myPrediction;
            const wager = wagering[m.id] ?? 5;
            const p1Fav = (p1?.elo_rating ?? 1200) >= (p2?.elo_rating ?? 1200);

            return (
              <div key={m.id} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm text-slate-800 dark:text-white truncate">{p1?.full_name ?? "P1"}</p>
                    <p className="text-xs text-slate-400 font-medium">ELO {p1?.elo_rating ?? 1200}</p>
                    {p1Fav && <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-black">Favourite</span>}
                  </div>
                  <span className="text-slate-400 text-sm font-black shrink-0">vs</span>
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm text-slate-800 dark:text-white truncate">{p2?.full_name ?? "P2"}</p>
                    <p className="text-xs text-slate-400 font-medium">ELO {p2?.elo_rating ?? 1200}</p>
                    {!p1Fav && <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-black">Favourite</span>}
                  </div>
                </div>

                {myPred ? (
                  <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/20 rounded-xl px-3 py-2">
                    <Check className="w-4 h-4 text-violet-500 shrink-0" />
                    <p className="text-xs text-violet-700 dark:text-violet-400 font-bold">
                      You picked {myPred.predicted_winner_id === p1?.id ? p1?.full_name : p2?.full_name} ({myPred.points_wagered} pts wagered)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => predict(m.id, p1?.id, wager)}
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 text-sm font-black text-slate-700 dark:text-slate-200 transition"
                      >
                        {p1?.full_name?.split(" ")[0]}
                      </button>
                      <button
                        onClick={() => predict(m.id, p2?.id, wager)}
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/30 text-sm font-black text-slate-700 dark:text-slate-200 transition"
                      >
                        {p2?.full_name?.split(" ")[0]}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 shrink-0">Wager:</span>
                      <input
                        type="range"
                        min={1}
                        max={Math.min(50, myPoints)}
                        value={wager}
                        onChange={(e) => setWagering((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))}
                        className="flex-1 accent-violet-500"
                      />
                      <span className="text-xs font-black text-violet-600 dark:text-violet-400 w-12 text-right">{wager} pts</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
