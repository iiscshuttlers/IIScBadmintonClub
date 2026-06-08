import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Activity, Trophy, Swords, Sparkles, TrendingUp, BarChart3, Clock, Share2, Video } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";

export default function Feed() {
  usePageMeta({
    title: "Activity Feed",
    description: "Live badminton activity, upsets, and recent matches at IISc Badminton Club.",
  });

  const { session, profile: ownProfile } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [limitCount, setLimitCount] = useState(30);

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
        .limit(limitCount);
      
      if (!error && data) {
        setMatches(data);
      }
    } catch (err) {
      console.warn("Error fetching feed:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [limitCount]);

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

  const matchOfTheDayId = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const recentMatches = matches.filter(m => new Date(m.created_at).getTime() > Date.now() - 48 * 60 * 60 * 1000);
    if (recentMatches.length === 0) return matches[0].id;
    return recentMatches.reduce((best, m) => {
      const combinedElo = (m.player1?.elo_rating || 0) + (m.player2?.elo_rating || 0);
      const bestElo = (best.player1?.elo_rating || 0) + (best.player2?.elo_rating || 0);
      return combinedElo > bestElo ? m : best;
    }, recentMatches[0]).id;
  }, [matches]);

  const weeklyRecap = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const lastWeekMatches = matches.filter(m => new Date(m.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (lastWeekMatches.length === 0) return null;

    let biggestUpset = null;
    let maxUpsetDiff = 0;
    const playerActivity: Record<string, { name: string, matches: number, eloClimb: number }> = {};

    lastWeekMatches.forEach(m => {
      // Activity & ELO Climb
      const addPlayer = (pid: string, name: string, eloChange: number) => {
        if (!playerActivity[pid]) playerActivity[pid] = { name, matches: 0, eloClimb: 0 };
        playerActivity[pid].matches++;
        if (eloChange && !isNaN(eloChange)) playerActivity[pid].eloClimb += eloChange;
      };
      
      if (m.player1) addPlayer(m.player1.id, m.player1.full_name, m.p1_elo_change || 0);
      if (m.player2) addPlayer(m.player2.id, m.player2.full_name, m.p2_elo_change || 0);
      
      // Upset
      const isP1Winner = m.winner_id === m.player1?.id;
      if (m.p1_elo_change !== undefined && m.p2_elo_change !== undefined && m.player1 && m.player2) {
        const eloDiff = m.player1.elo_rating - m.player2.elo_rating;
        if ((isP1Winner && eloDiff < -50) || (!isP1Winner && eloDiff > 50)) {
          const diff = Math.abs(eloDiff);
          if (diff > maxUpsetDiff) {
            maxUpsetDiff = diff;
            biggestUpset = m;
          }
        }
      }
    });

    const mostActive = Object.values(playerActivity).sort((a, b) => b.matches - a.matches)[0];
    const highestClimber = Object.values(playerActivity).sort((a, b) => b.eloClimb - a.eloClimb)[0];

    return {
      biggestUpset,
      mostActive,
      highestClimber
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

        {!loading && weeklyRecap && (
          <div className="mb-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700 relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Weekly Club Recap
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {weeklyRecap.mostActive && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Most Active Player</span>
                  <div className="text-base font-bold text-white line-clamp-1">{weeklyRecap.mostActive.name}</div>
                  <div className="text-sm font-black text-emerald-400">{weeklyRecap.mostActive.matches} Matches Played</div>
                </div>
              )}
              {weeklyRecap.highestClimber && weeklyRecap.highestClimber.eloClimb > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Highest Climber</span>
                  <div className="text-base font-bold text-white line-clamp-1">{weeklyRecap.highestClimber.name}</div>
                  <div className="text-sm font-black text-amber-400">+{weeklyRecap.highestClimber.eloClimb} ELO Gained</div>
                </div>
              )}
              {weeklyRecap.biggestUpset && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biggest Upset</span>
                  <div className="text-base font-bold text-white line-clamp-1">
                    {weeklyRecap.biggestUpset.winner_id === weeklyRecap.biggestUpset.player1?.id ? weeklyRecap.biggestUpset.player1?.full_name : weeklyRecap.biggestUpset.player2?.full_name}
                  </div>
                  <div className="text-sm font-black text-rose-400">Won as the underdog</div>
                </div>
              )}
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
                if ((isP1Winner && eloDiff < -150) || (!isP1Winner && eloDiff > 150)) {
                  upsetDiff = Math.abs(eloDiff);
                }
              }

              // Parse video URL
              let displayScore = match.score;
              let highlightUrl = null;
              if (displayScore.includes(" | ")) {
                const parts = displayScore.split(" | ");
                displayScore = parts[0];
                highlightUrl = parts[1];
              }
              
              const isMatchOfTheDay = match.id === matchOfTheDayId;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={match.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative overflow-hidden group transition-shadow ${isMatchOfTheDay ? 'border-2 border-amber-400 shadow-amber-500/20 shadow-xl' : 'border border-slate-100 dark:border-slate-800 hover:shadow-md'}`}
                >
                  {/* Match of the Day Badge */}
                  {isMatchOfTheDay && (
                    <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-br-xl shadow-md z-10 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Match of the Day
                    </div>
                  )}

                  {/* Upset Badge */}
                  {upsetDiff > 0 && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-red-600 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-md z-10 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 animate-bounce" /> MASSIVE UPSET
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
                      <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner text-center">
                        {displayScore}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
                        {new Date(match.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                      {highlightUrl && (
                        <a href={highlightUrl} target="_blank" rel="noopener noreferrer" 
                          className="mt-2 text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-500 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1 hover:scale-105 transition">
                          <Video className="w-3 h-3" /> Highlights
                        </a>
                      )}
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
                          const btn = e.currentTarget;
                          try {
                            const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
                            await Haptics.impact({ style: ImpactStyle.Heavy });
                          } catch(err) {}
                          btn.classList.add('scale-125', 'text-rose-500', 'bg-rose-50', 'dark:bg-rose-500/20');
                        setTimeout(() => btn.classList.remove('scale-125'), 200);
                        
                        // Hybrid storage: Use DB if logged in, fallback to local storage
                        const storageKey = `liked_${match.id}`;
                        const isLikedDb = Array.isArray(match.kudos_users) && session?.user?.id && match.kudos_users.includes(session.user.id);
                        const isLikedLocal = !!localStorage.getItem(storageKey);
                        const isCurrentlyLiked = isLikedDb || isLikedLocal;
                        
                        const countEl = btn.querySelector('.kudos-count');
                        if (!isCurrentlyLiked) {
                          localStorage.setItem(storageKey, "1");
                          if (countEl) countEl.textContent = String(parseInt(countEl.textContent || '0') + 1);
                          toast.success("Kudos given! ✨");
                        } else {
                          localStorage.removeItem(storageKey);
                          if (countEl) countEl.textContent = String(parseInt(countEl.textContent || '1') - 1);
                          toast.success("Kudos removed");
                        }

                        // Sync with live database if logged in
                        if (session?.user?.id) {
                          supabase.rpc('toggle_match_kudos', { p_match_id: match.id }).catch(err => {
                            console.warn("Failed to sync kudos live:", err);
                          });
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                        (Array.isArray(match.kudos_users) ? match.kudos_users.includes(session?.user?.id) : localStorage.getItem(`liked_${match.id}`))
                        ? 'text-rose-500 bg-rose-50 dark:bg-rose-500/20' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" /> 
                      Kudos <span className="kudos-count font-medium ml-1">
                        {Array.isArray(match.kudos_users) 
                          ? match.kudos_users.length + (localStorage.getItem(`liked_${match.id}`) && !match.kudos_users.includes(session?.user?.id) ? 1 : 0)
                          : (match.id.charCodeAt(0) % 5) + (localStorage.getItem(`liked_${match.id}`) ? 1 : 0)}
                      </span>
                    </button>
                    
                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
                        const text = `🔥 Match Result: ${p1.full_name} vs ${p2.full_name} (${displayScore})! Check it out on IISc Shuttlers.`;
                        const shareUrl = window.location.origin + '/feed';
                        try {
                          if (Capacitor.isNativePlatform()) {
                            await Share.share({
                              title: 'IISc Shuttlers Match',
                              text,
                              url: shareUrl,
                              dialogTitle: 'Share Match Result',
                            });
                          } else if (navigator.share) {
                            await navigator.share({ title: 'IISc Shuttlers Match', text, url: shareUrl });
                          } else {
                            await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
                            toast.success("Match result copied to clipboard!");
                          }
                        } catch (err: any) {
                          if (err.message && !err.message.includes("cancel")) {
                            navigator.clipboard.writeText(`${text}\n${shareUrl}`);
                            toast.success("Match result copied to clipboard!");
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 ml-2"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>

                </motion.div>
              );
            })}
            
            {matches.length >= limitCount && (
              <div className="flex justify-center mt-6 pt-4 pb-8">
                <button 
                  onClick={() => setLimitCount(prev => prev + 30)}
                  className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-bold text-sm transition shadow-sm hover:shadow-md"
                >
                  Load More Matches
                </button>
              </div>
            )}
            
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
            <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">No matches yet</h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">It's quiet on the courts. Be the first to log a match today and get the action started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
