import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  Activity,
  Trophy,
  Swords,
  Sparkles,
  Star,
  TrendingUp,
  BarChart3,
  Clock,
  Share2,
  Video,
  Users,
  UserCheck,
  Heart,
  Bell,
  Tv2,
  ChevronDown,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { InfoModal } from "@/components/InfoModal";

import { toast } from "sonner";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { shareMatch } from "@/lib/shareMatch";
import { fetchFeedMatches } from "@/services/matchService";
import { useFeedMatches } from "@/hooks/useFeedMatches";
import { useLiveMatches } from "@/hooks/useLiveMatches";
import { AnnouncementsSection } from "@/components/feed/AnnouncementsSection";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { UmpireTab } from "@/components/umpire/UmpireTab";
import { MatchCard } from "@/components/feed/MatchCard";
import { PollsSection } from "@/components/feed/PollsSection";
import { RivalryCards } from "@/components/feed/RivalryCards";
import { H2HSection } from "@/components/players-directory/H2HSection";

import { useHashTab } from "@/hooks/useHashTab";

export default function FeedTab() {
  const { session, profile: ownProfile, isUmpire, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, handleTabChange] = useHashTab(
    ["feed-matches", "announcements", "h2h", "umpire-panel"] as const,
    "feed-matches"
  );

  useEffect(() => {
    const onOpenUmpire = () => handleTabChange("umpire-panel");
    window.addEventListener("openUmpireTab", onOpenUmpire);
    return () => window.removeEventListener("openUmpireTab", onOpenUmpire);
  }, []);

  const { liveMatchIds, hasLiveMatches } = useLiveMatches();

  const {
    loading,
    matches,
    displayMatches,
    limitCount,
    setLimitCount,
    courtUtil,
    matchOfTheDayId,
    weeklyRecap,
    categoryFilter,
    setCategoryFilter,
    timeFilter,
    setTimeFilter,
    tournamentFilter,
    setTournamentFilter
  } = useFeedMatches(ownProfile);

  const [tournaments, setTournaments] = useState<{ id: string, name: string }[]>([]);
  useEffect(() => {
    supabase
      .from("tournaments")
      .select("id, name")
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTournaments(data);
      });
  }, []);

  usePullToRefresh();

  const [kudosState, setKudosState] = useState<Record<string, boolean>>({});

  const renderSkeleton = () => (
    <div className="space-y-4 max-w-3xl mx-auto">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm animate-pulse"
        >
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
    <div className="w-full">
      <div className="bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 mb-6 shadow-sm">
        <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => handleTabChange("feed-matches")}
            className={`whitespace-nowrap flex justify-center items-center px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
              activeTab === "feed-matches"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            Matches
          </button>
          <button
            onClick={() => handleTabChange("announcements")}
            className={`whitespace-nowrap flex justify-center items-center px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
              activeTab === "announcements"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            Announcements
          </button>
          <button
            onClick={() => handleTabChange("h2h")}
            className={`whitespace-nowrap flex justify-center items-center px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
              activeTab === "h2h"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            H2H
          </button>
          {(isUmpire || isAdmin) && (
            <button
              onClick={() => handleTabChange("umpire-panel")}
              className={`whitespace-nowrap flex justify-center items-center px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all ${
                activeTab === "umpire-panel"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
              }`}
            >
              Umpire
            </button>
          )}
        </div>
      </div>
      <div className="container mx-auto px-4 max-w-3xl mt-8">
        {activeTab === "announcements" ? (
          <AnnouncementsSection />
        ) : activeTab === "h2h" ? (
          <H2HSection />
        ) : activeTab === "umpire-panel" && (isUmpire || isAdmin) ? (
          <UmpireTab />
        ) : (
          <>
            {!loading && (
              <div className="-mx-4 sm:mx-0 mb-6">
                <LiveScoreSection />
              </div>
            )}

            {!loading && displayMatches.length > 0 && (
              <>
                <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground mb-4">
                    <BarChart3 className="w-4 h-4 text-primary" /> Court
                    Utilization (Recent)
                    <InfoModal
                      title="COURT UTILIZATION"
                      items={[
                        { badge: "TIME", title: "Time of Day", desc: "Shows when matches were played recently (Morning, Afternoon, Evening). Useful to know when the courts are busiest." }
                      ]}
                    />
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${courtUtil.morning}%` }}
                      transition={{ duration: 1 }}
                      className="bg-sky-400 border-r border-white/20"
                      title="Morning (5AM - 12PM)"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${courtUtil.afternoon}%` }}
                      transition={{ duration: 1, delay: 0.2 }}
                      className="bg-amber-400 border-r border-white/20"
                      title="Afternoon (12PM - 5PM)"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${courtUtil.evening}%` }}
                      transition={{ duration: 1, delay: 0.4 }}
                      className="bg-indigo-500"
                      title="Evening (5PM - 5AM)"
                    />
                  </div>
                  <div className="flex justify-between mt-3 text-[10px] font-bold text-muted-foreground uppercase">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-sky-400" /> Morning
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-amber-400" /> Afternoon
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" /> Evening
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Community Polls */}
            {!loading && (
              <div className="mb-6">
                <PollsSection />
              </div>
            )}
            {!loading && displayMatches.length >= 6 && (
              <RivalryCards matches={displayMatches} limit={3} />
            )}

            {!loading && weeklyRecap && (
              <div className="mb-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700 relative overflow-hidden text-foreground">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> Weekly Club Recap
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {weeklyRecap.mostActive && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Most Active Player
                      </span>
                      <div className="text-base font-bold text-foreground line-clamp-1">
                        {weeklyRecap.mostActive.name}
                      </div>
                      <div className="text-sm font-black text-primary">
                        {weeklyRecap.mostActive.matches} Matches Played
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Feed filter tabs and Advanced Filters */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex w-full sm:flex-1 relative">
                <select
                  value={tournamentFilter}
                  onChange={(e) => setTournamentFilter(e.target.value)}
                  className="appearance-none bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer w-full"
                >
                  <option value="all">All Tournaments</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Advanced Filters */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto sm:pl-4 sm:border-l sm:border-slate-200 dark:sm:border-slate-700">
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="appearance-none w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer min-w-0"
                  >
                    <option value="all">All Categories</option>
                    <option value="singles">Singles</option>
                    <option value="doubles">Doubles</option>
                    <option value="mixed">Mixed Doubles</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative flex-1 sm:flex-none">
                  <select
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value as any)}
                    className="appearance-none w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-sm font-bold rounded-xl pl-3 pr-8 py-2 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer min-w-0"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {loading ? (
              renderSkeleton()
            ) : displayMatches.length > 0 ? (
              <div className="space-y-4">
                {displayMatches.map((match: any, i: number) => {
                  const p1 = match.player1;
                  const p2 = match.player2;
                  const isP1Winner = match.winner_id === p1?.id;


                  // Determine Elo difference before match
                  let upsetDiff = 0;
                  if (
                    match.elo_change_p1 !== undefined &&
                    match.elo_change_p2 !== undefined &&
                    p1 && p2
                  ) {
                    // If the player who had lower ELO won
                    const eloDiff = p1.elo_rating - p2.elo_rating;
                    if (
                      (isP1Winner && eloDiff < -150) ||
                      (!isP1Winner && eloDiff > 150)
                    ) {
                      upsetDiff = Math.abs(eloDiff);
                    }
                  }

                  // Parse video URL
                  let displayScore = match.score || "";
                  let highlightUrl = null;
                  if (displayScore.includes(" | ")) {
                    const parts = displayScore.split(" | ");
                    displayScore = parts[0];
                    highlightUrl = parts[1];
                  }

                  const isMatchOfTheDay = match.id === matchOfTheDayId;
                  const isLiveNow = !match.is_friendly &&
                    (liveMatchIds.has(match.player1_id) || liveMatchIds.has(match.player2_id) ||
                      (match.team1_partner_id && liveMatchIds.has(match.team1_partner_id)) ||
                      (match.team2_partner_id && liveMatchIds.has(match.team2_partner_id)));

                  const isKudosed = (m: any) => {
                    if (kudosState.hasOwnProperty(m.id)) return kudosState[m.id];
                    return (
                      (Array.isArray(m.kudos_users) &&
                        session?.user?.id &&
                        m.kudos_users.includes(session.user.id)) ||
                      !!localStorage.getItem(`liked_${m.id}`)
                    );
                  };

                  const handleKudos = async (match: any) => {
                    const storageKey = `liked_${match.id}`;
                    const isCurrentlyLiked = isKudosed(match);

                    if (!isCurrentlyLiked) {
                      localStorage.setItem(storageKey, "1");
                      setKudosState((prev) => ({ ...prev, [match.id]: true }));
                      toast.success("Match liked! ❤️");
                    } else {
                      localStorage.removeItem(storageKey);
                      setKudosState((prev) => ({ ...prev, [match.id]: false }));
                      toast.success("Like removed");
                    }

                    if (session?.user?.id) {
                      supabase
                        .rpc("toggle_match_kudos", { p_match_id: match.id })
                        .then(({ error }) => {
                          if (error)
                            console.warn("Failed to sync kudos live:", error);
                        });

                      if (!isCurrentlyLiked) {
                        const giverName = ownProfile?.full_name ?? "Someone";
                        supabase.functions
                          .invoke("notify-kudos", {
                            body: { match_id: match.id, giver_name: giverName },
                          })
                          .catch(() => { });
                      }
                    }
                  };

                  const handleShare = (match: any) => shareMatch(match);
                  
                  const isLikedLocally = kudosState[match.id] ?? !!localStorage.getItem(`liked_${match.id}`);
                  const baseCount = Array.isArray(match.kudos_users) ? match.kudos_users.length : 0;
                  const isIncludedInBackend = Array.isArray(match.kudos_users) && match.kudos_users.includes(session?.user?.id);
                  let finalKudosCount = baseCount;
                  
                  if (isLikedLocally && !isIncludedInBackend) {
                    finalKudosCount += 1;
                  } else if (!isLikedLocally && isIncludedInBackend) {
                    finalKudosCount -= 1;
                  }

                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUser={session?.user}
                      isLiveNow={isLiveNow}
                      isMatchOfTheDay={isMatchOfTheDay}
                      upsetDiff={upsetDiff}
                      isKudosed={isLikedLocally || isIncludedInBackend}
                      kudosCount={finalKudosCount}
                      onKudos={() => handleKudos(match)}
                      onShare={() => handleShare(match)}
                      index={i}
                    />
                  );
                })}

                {matches.length >= limitCount && (
                  <div className="flex justify-center mt-6 pt-4 pb-8">
                    <button
                      onClick={() => setLimitCount((prev) => prev + 50)}
                      className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 rounded-full font-bold text-sm transition shadow-sm hover:shadow-md"
                    >
                      Load More Matches
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
                <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
                  No matches yet
                </h3>
                <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                  It's quiet on the courts. Check back later for more action!
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
