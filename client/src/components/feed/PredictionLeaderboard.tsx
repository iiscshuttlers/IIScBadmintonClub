import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Award, Trophy, Sparkles, HelpCircle, Loader2 } from "lucide-react";

export interface PredictorStat {
  userId: string;
  name: string;
  avatarUrl?: string;
  totalVotes: number;
  correctVotes: number;
  accuracy: number;
  badges: string[];
}

export function PredictionLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<PredictorStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const { data: votes } = await supabase
          .from("live_match_votes")
          .select("user_id, live_match_id, pick");

        if (!votes || votes.length === 0) {
          setLoading(false);
          return;
        }

        const matchIds = [...new Set(votes.map(v => v.live_match_id))];

        const { data: matches } = await supabase
          .from("matches")
          .select("id, player1_id, player2_id, team1_partner_id, team2_partner_id, winner_id")
          .in("id", matchIds);

        const { data: tourneyMatches } = await supabase
          .from("tournament_matches")
          .select("id, player1_id, player2_id, player3_id, player4_id, winner_side")
          .in("id", matchIds);

        const matchWinnerMap: Record<string, 1 | 2> = {};

        if (matches) {
          for (const m of matches) {
            if (!m.winner_id) continue;
            const isT1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
            matchWinnerMap[m.id] = isT1Winner ? 1 : 2;
          }
        }

        if (tourneyMatches) {
          for (const m of tourneyMatches) {
            if (!m.winner_side) continue;
            matchWinnerMap[m.id] = m.winner_side as 1 | 2;
          }
        }

        const userStatsMap: Record<string, { total: number; correct: number }> = {};

        for (const vote of votes) {
          if (!userStatsMap[vote.user_id]) {
            userStatsMap[vote.user_id] = { total: 0, correct: 0 };
          }
          userStatsMap[vote.user_id].total++;

          const actualWinner = matchWinnerMap[vote.live_match_id];
          if (actualWinner && vote.pick === actualWinner) {
            userStatsMap[vote.user_id].correct++;
          }
        }

        const userIds = Object.keys(userStatsMap);
        const { data: players } = await supabase
          .from("players")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        const playerMap: Record<string, { name: string; avatarUrl?: string }> = {};
        if (players) {
          for (const p of players) playerMap[p.id] = { name: p.full_name, avatarUrl: p.avatar_url };
        }

        const stats: PredictorStat[] = userIds.map(uid => {
          const s = userStatsMap[uid];
          const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          const badges: string[] = [];

          if (s.correct >= 10 && acc >= 70) badges.push("🔮 Master Predictor");
          else if (s.correct >= 5) badges.push("🏆 Oracle");
          else if (s.total >= 5) badges.push("⚡ Active Voter");

          return {
            userId: uid,
            name: playerMap[uid]?.name || "Anonymous Player",
            avatarUrl: playerMap[uid]?.avatarUrl,
            totalVotes: s.total,
            correctVotes: s.correct,
            accuracy: acc,
            badges,
          };
        }).sort((a, b) => b.correctVotes - a.correctVotes || b.accuracy - a.accuracy);

        setLeaderboard(stats.slice(0, 10));
      } catch (e) {
        console.error("Failed to load prediction leaderboard", e);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
        No match predictions tallied yet. Vote on upcoming matches to claim your spot on the leaderboard!
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/60 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-500" /> Top Predictors
        </h4>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Community Accuracy
        </span>
      </div>

      <div className="space-y-2">
        {leaderboard.map((stat, i) => (
          <div
            key={stat.userId}
            className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[11px] ${
                i === 0 ? "bg-amber-400 text-slate-900" : i === 1 ? "bg-slate-300 text-slate-900" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"
              }`}>
                {i + 1}
              </span>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 shrink-0">
                {stat.avatarUrl ? (
                  <img src={stat.avatarUrl} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                    {stat.name[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-foreground line-clamp-1">
                  {stat.name}
                </p>
                <div className="flex items-center gap-1 flex-wrap">
                  {stat.badges.map((b, idx) => (
                    <span key={idx} className="text-[9px] font-black uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-1.5 py-0.5 rounded">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                {stat.correctVotes}/{stat.totalVotes}
              </span>
              <p className="text-[10px] text-muted-foreground font-bold">
                {stat.accuracy}% acc
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
