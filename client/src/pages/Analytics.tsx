import { useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { TrendingUp, Flame, Activity, Swords, Medal, AlertCircle } from "lucide-react";
import { Layout } from "@/components/Layout";

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    upsets: [],
    streaks: [],
    mostActive: [],
    totalMatches: 0,
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch all players to get streaks and activity
        const { data: playersData } = await supabase
          .from("players")
          .select("*")
          .is("deleted_at", null);

        // Fetch recent matches for upsets
        const { data: matchesData } = await supabase
          .from("matches")
          .select("*, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url)")
          .eq("status", "confirmed")
          .order("created_at", { ascending: false })
          .limit(200);

        if (!playersData || !matchesData) return;

        // Process active streaks
        const streaks = [...playersData]
          .filter(p => p.win_streak > 1)
          .sort((a, b) => b.win_streak - a.win_streak)
          .slice(0, 5);

        // Process most active players
        const mostActive = [...playersData]
          .map(p => {
            let total = 0;
            if (p.win_loss_record && typeof p.win_loss_record === "object") {
              const w = p.win_loss_record.wins || 0;
              const l = p.win_loss_record.losses || 0;
              total = w + l;
            }
            return { ...p, totalMatches: total };
          })
          .filter(p => p.totalMatches > 0)
          .sort((a, b) => b.totalMatches - a.totalMatches)
          .slice(0, 5);

        // Process biggest upsets (largest elo difference where lower elo player won)
        const upsets = matchesData
          .filter(m => m.elo_change_p1 !== undefined && m.elo_change_p2 !== undefined)
          .map(m => {
            const isP1Winner = m.winner_id === m.player1_id;
            const upsetScore = isP1Winner ? (m.elo_change_p1 || 0) : (m.elo_change_p2 || 0);
            return { ...m, upsetScore };
          })
          .filter(m => m.upsetScore > 20) // Only significant upsets
          .sort((a, b) => b.upsetScore - a.upsetScore)
          .slice(0, 5);

        setData({
          upsets,
          streaks,
          mostActive,
          totalMatches: matchesData.length,
        });
      } catch (e) {
        console.error("Failed to load analytics:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 pb-24 pt-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-500" /> Analytics
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Global platform trends and statistics
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* BIGGEST UPSETS */}
            <motion.section variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-orange-500" />
              <h2 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-rose-500" /> Biggest Upsets
              </h2>
              <div className="space-y-3">
                {data.upsets.length > 0 ? data.upsets.map((match: any) => {
                  const winner = match.winner_id === match.player1_id ? match.player1 : match.player2;
                  const loser = match.winner_id === match.player1_id ? match.player2 : match.player1;
                  return (
                    <div key={match.id} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                      <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                          <Link href={`/player/${winner?.id}`}>
                            <img src={winner?.avatar_url || ""} className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-emerald-500" />
                          </Link>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-800 dark:text-white truncate flex items-center gap-2">
                              {winner?.full_name?.split(' ')[0]}
                              <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black">
                                +{match.upsetScore} ELO
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">def. {loser?.full_name?.split(' ')[0]}</div>
                          </div>
                        </div>
                        <div className="font-mono font-black text-slate-700 dark:text-slate-300 text-sm bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded w-full sm:w-auto text-center shrink-0">
                          {match.score?.split(' | ')[0] || "N/A"}
                        </div>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="text-center py-8 text-slate-400 text-sm">No recent upsets found.</div>
                )}
              </div>
            </motion.section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* LONGEST STREAKS */}
              <motion.section variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-amber-500" />
                <h2 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" /> Active Win Streaks
                </h2>
                <div className="space-y-3">
                  {data.streaks.length > 0 ? data.streaks.map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 text-center font-black text-slate-300 dark:text-slate-600">#{i + 1}</div>
                        <Link href={`/player/${p.id}`}>
                          <img src={p.avatar_url || ""} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                        </Link>
                        <Link href={`/player/${p.id}`} className="font-bold text-sm text-slate-800 dark:text-white truncate hover:underline">
                          {p.full_name?.split(' ')[0]}
                        </Link>
                      </div>
                      <div className="flex items-center gap-1.5 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-lg font-black text-sm shrink-0">
                        <Flame className="w-3.5 h-3.5" /> {p.win_streak}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-400 text-sm">No active streaks above 1 match.</div>
                  )}
                </div>
              </motion.section>

              {/* MOST ACTIVE PLAYERS */}
              <motion.section variants={itemVariants} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-violet-500" />
                <h2 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <Swords className="w-5 h-5 text-indigo-500" /> Ironmen (All-Time)
                </h2>
                <div className="space-y-3">
                  {data.mostActive.length > 0 ? data.mostActive.map((p: any, i: number) => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-6 text-center font-black text-slate-300 dark:text-slate-600">#{i + 1}</div>
                        <Link href={`/player/${p.id}`}>
                          <img src={p.avatar_url || ""} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                        </Link>
                        <Link href={`/player/${p.id}`} className="font-bold text-sm text-slate-800 dark:text-white truncate hover:underline">
                          {p.full_name?.split(' ')[0]}
                        </Link>
                      </div>
                      <div className="font-black text-sm text-slate-600 dark:text-slate-300 shrink-0">
                        {p.totalMatches} Matches
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-slate-400 text-sm">No active players found.</div>
                  )}
                </div>
              </motion.section>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
