import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Activity, Trophy, Swords, Sparkles, TrendingUp, BarChart3, Clock } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

export default function Feed() {
  usePageMeta({
    title: "Activity Feed",
    description: "Live badminton activity, upsets, and recent matches at IISc Badminton Club.",
  });

  const { session, profile: ownProfile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          player1:players!player1_id(id, full_name, avatar_url, elo_rating),
          player2:players!player2_id(id, full_name, avatar_url, elo_rating),
          partner1:players!team1_partner_id(id, full_name, avatar_url),
          partner2:players!team2_partner_id(id, full_name, avatar_url)
        `)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (!error && data) {
        setMatches(data);
      }
    } catch (err) {
      console.warn("Error fetching feed:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useAutoRefresh(() => fetchFeed(true), 30_000, !loading);

  const courtUtil = useMemo(() => {
    const hours = new Array(24).fill(0);
    matches.forEach(m => {
      const h = new Date(m.created_at).getHours();
      hours[h]++;
    });
    const morning = hours.slice(5, 12).reduce((a, b) => a + b, 0);
    const afternoon = hours.slice(12, 17).reduce((a, b) => a + b, 0);
    const evening = hours.slice(17, 24).reduce((a, b) => a + b, 0) + hours.slice(0, 5).reduce((a, b) => a + b, 0);
    const total = matches.length || 1;
    return {
      morning: (morning / total) * 100,
      afternoon: (afternoon / total) * 100,
      evening: (evening / total) * 100,
      isPeak: Math.max(morning, afternoon, evening)
    };
  }, [matches]);

  const renderSkeleton = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded-full" />
            <div className="flex items-center gap-3">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-3 w-1/3 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8 font-sans selection:bg-emerald-500/30">
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white py-12 lg:py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest mb-4">
            <Activity className="w-4 h-4 text-emerald-400" /> Global Feed
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight">Activity Feed</h1>
          <p className="text-slate-300 font-medium">See what's happening on the courts in real-time.</p>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8">
        {!loading && matches.length > 0 && (
          <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
              <BarChart3 className="w-4 h-4 text-emerald-500" /> Court Utilization (Recent)
            </div>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
              <motion.div initial={{width:0}} animate={{width:`${courtUtil.morning}%`}} transition={{duration:1}} className="bg-sky-400 border-r border-white/20" title="Morning (5AM - 12PM)" />
              <motion.div initial={{width:0}} animate={{width:`${courtUtil.afternoon}%`}} transition={{duration:1, delay:0.2}} className="bg-amber-400 border-r border-white/20" title="Afternoon (12PM - 5PM)" />
              <motion.div initial={{width:0}} animate={{width:`${courtUtil.evening}%`}} transition={{duration:1, delay:0.4}} className="bg-indigo-500" title="Evening (5PM - 5AM)" />
            </div>
            <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-400 uppercase">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-sky-400"/> Morning</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"/> Afternoon</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"/> Evening</div>
            </div>
          </div>
        )}

        {loading ? (
          renderSkeleton()
        ) : matches.length > 0 ? (
          <div className="space-y-4">
            {matches.map((match, i) => {
              const p1 = match.player1;
              const p2 = match.player2;
              const isP1Winner = match.winner_id === p1.id;
              const isUpset = false; // We can add upset logic if we want based on ELO difference
              
              // Determine Elo difference before match
              let upsetDiff = 0;
              if (match.p1_elo_change !== undefined && match.p2_elo_change !== undefined) {
                // If the player who had lower ELO won
                const eloDiff = p1.elo_rating - p2.elo_rating;
                if ((isP1Winner && eloDiff < -50) || (!isP1Winner && eloDiff > 50)) {
                  upsetDiff = Math.abs(eloDiff);
                }
              }

              return (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={match.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                  {/* Upset Badge */}
                  {upsetDiff > 0 && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> UPSET
                    </div>
                  )}

                  <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 mb-3 flex items-center justify-center gap-1">
                    <Swords className="w-3.5 h-3.5" />
                    {match.is_friendly === false ? "Tournament Match" : "Friendly Match"}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    {/* Player 1 (and Partner 1) */}
                    <div className={`flex-1 flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl transition-colors ${isP1Winner ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                      <div className="relative flex">
                        <Link href={`/player/${p1.id}`}>
                          <img src={p1.avatar_url || ''} className={`w-12 h-12 rounded-full object-cover shadow-sm relative z-10 ${isP1Winner ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' : 'grayscale opacity-80'}`} />
                        </Link>
                        {match.partner1 && (
                          <Link href={`/player/${match.partner1.id}`}>
                            <img src={match.partner1.avatar_url || ''} className={`w-12 h-12 rounded-full object-cover shadow-sm -ml-4 relative z-0 ${isP1Winner ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' : 'grayscale opacity-80'}`} />
                          </Link>
                        )}
                        {isP1Winner && <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm z-20"><Trophy className="w-3 h-3" /></div>}
                      </div>
                      <div className="text-center sm:text-left">
                        <div className={`font-black text-sm ${isP1Winner ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          <Link href={`/player/${p1.id}`} className="hover:underline">{p1.full_name}</Link>
                          {match.partner1 && <><br/><Link href={`/player/${match.partner1.id}`} className="hover:underline">{match.partner1.full_name}</Link></>}
                        </div>
                        {match.p1_elo_change && (
                          <div className={`text-xs font-bold ${match.p1_elo_change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {match.p1_elo_change > 0 ? '+' : ''}{match.p1_elo_change} ELO
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                        {match.score}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                        {new Date(match.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                    {/* Player 2 (and Partner 2) */}
                    <div className={`flex-1 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 p-3 rounded-2xl transition-colors ${!isP1Winner ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                      <div className="text-center sm:text-right">
                        <div className={`font-black text-sm ${!isP1Winner ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          <Link href={`/player/${p2.id}`} className="hover:underline">{p2.full_name}</Link>
                          {match.partner2 && <><br/><Link href={`/player/${match.partner2.id}`} className="hover:underline">{match.partner2.full_name}</Link></>}
                        </div>
                        {match.p2_elo_change && (
                          <div className={`text-xs font-bold ${match.p2_elo_change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {match.p2_elo_change > 0 ? '+' : ''}{match.p2_elo_change} ELO
                          </div>
                        )}
                      </div>
                      <div className="relative flex flex-row-reverse">
                        <Link href={`/player/${p2.id}`}>
                          <img src={p2.avatar_url || ''} className={`w-12 h-12 rounded-full object-cover shadow-sm relative z-10 ${!isP1Winner ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' : 'grayscale opacity-80'}`} />
                        </Link>
                        {match.partner2 && (
                          <Link href={`/player/${match.partner2.id}`}>
                            <img src={match.partner2.avatar_url || ''} className={`w-12 h-12 rounded-full object-cover shadow-sm -mr-4 relative z-0 ${!isP1Winner ? 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' : 'grayscale opacity-80'}`} />
                          </Link>
                        )}
                        {!isP1Winner && <div className="absolute -bottom-2 -left-2 sm:-left-2 sm:right-auto bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm z-20"><Trophy className="w-3 h-3" /></div>}
                      </div>
                    </div>
                  </div>

                  {/* Reaction Kudos */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
                        try {
                          const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
                          await Haptics.impact({ style: ImpactStyle.Heavy });
                        } catch(err) {}
                        const btn = e.currentTarget;
                        btn.classList.add('scale-125', 'text-rose-500', 'bg-rose-50', 'dark:bg-rose-500/20');
                        setTimeout(() => btn.classList.remove('scale-125'), 200);
                        
                        // Local storage for instant feedback
                        const storageKey = `liked_${match.id}`;
                        if (!localStorage.getItem(storageKey)) {
                          localStorage.setItem(storageKey, "1");
                          const countEl = btn.querySelector('.kudos-count');
                          if (countEl) countEl.textContent = String(parseInt(countEl.textContent || '0') + 1);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" /> 
                      Kudos <span className="kudos-count text-slate-400 font-medium ml-1">{(match.id.charCodeAt(0) % 5) + (localStorage.getItem(`liked_${match.id}`) ? 1 : 0)}</span>
                    </button>
                  </div>

                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-500 font-medium">No matches played recently.</div>
        )}
      </div>
    </div>
  );
}
