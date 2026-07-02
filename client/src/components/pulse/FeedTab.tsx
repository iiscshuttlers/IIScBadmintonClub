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
import { MatchPredictions } from "@/components/feed/MatchPredictions";

export default function FeedTab() {
  const { session, profile: ownProfile, isUmpire, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"matches" | "announcements" | "umpire">("matches");

  const handleTabChange = (tabId: "matches" | "announcements" | "umpire") => {
    setActiveTab(tabId);
  };

  const { liveMatchIds, hasLiveMatches } = useLiveMatches();

  const {
    loading,
    matches,
    displayMatches,
    limitCount,
    setLimitCount,
    feedFilter,
    setFeedFilter,
    courtUtil,
    matchOfTheDayId,
    weeklyRecap,
    categoryFilter,
    setCategoryFilter,
    timeFilter,
    setTimeFilter,
    typeFilter,
    setTypeFilter
  } = useFeedMatches(ownProfile);

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
      <div className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 mb-6">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-center gap-2">
          <button
            onClick={() => handleTabChange("matches")}
            className={`flex justify-center items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === "matches"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-foreground shadow-md"
              : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
          >
            <Activity className="w-4 h-4" /> Matches
          </button>
          <button
            onClick={() => {
              handleTabChange("announcements");
            }}
            className={`flex justify-center items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === "announcements"
              ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-foreground shadow-md"
              : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800"
              }`}
          >
            <Bell className="w-4 h-4" /> Announcements
          </button>
              {session && (
                <>
                </>
              )}
              {(isUmpire || isAdmin) && (
                <button
                  onClick={() => handleTabChange("umpire")}
                  className={`flex justify-center items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === "umpire"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-foreground shadow-md"
                    : "text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                >
                  <Tv2 className="w-4 h-4" /> Umpire
                </button>
              )}
          </div>
        </div>
      <div className={`container mx-auto px-4 max-w-3xl ${activeTab === "my_matches" ? "mt-0" : "mt-8"}`}>
        {activeTab === "announcements" ? (
          <AnnouncementsSection />
        ) : activeTab === "umpire" && (isUmpire || isAdmin) ? (
          <UmpireTab />
        ) : (
          <>
            {!loading && session && hasLiveMatches && <MatchPredictions />}

            {!loading && displayMatches.length > 0 && (
              <>
                <div className="-mx-4 sm:mx-0 mb-6">
                  <LiveScoreSection />
                </div>
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
                  {weeklyRecap.highestClimber &&
                    weeklyRecap.highestClimber.eloClimb > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          Highest Climber
                        </span>
                        <div className="text-base font-bold text-foreground line-clamp-1">
                          {weeklyRecap.highestClimber.name}
                        </div>
                        <div className="text-sm font-black text-amber-400">
                          +{weeklyRecap.highestClimber.eloClimb} ELO Gained
                        </div>
                      </div>
                    )}
                  {weeklyRecap.biggestUpset && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Biggest Upset
                      </span>
                      <div className="text-base font-bold text-foreground line-clamp-1">
                        {weeklyRecap.biggestUpset.winner_id ===
                          weeklyRecap.biggestUpset.player1?.id
                          ? weeklyRecap.biggestUpset.player1?.full_name
                          : weeklyRecap.biggestUpset.player2?.full_name}
                      </div>
                      <div className="text-sm font-black text-rose-400">
                        Won as the underdog
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Feed filter tabs and Advanced Filters */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
                <button
                  onClick={() => setFeedFilter("global")}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all ${feedFilter === "global"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-transparent text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                >
                  <Activity className="w-3.5 h-3.5" /> Global
                </button>
                {session && (
                  <>
                    <button
                      onClick={() => setFeedFilter("following")}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all ${feedFilter === "following"
                        ? "bg-sky-600 text-foreground shadow-md"
                        : "bg-transparent text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Following
                    </button>
                    <button
                      onClick={() => setFeedFilter("buddies")}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-all ${feedFilter === "buddies"
                        ? "bg-violet-600 text-foreground shadow-md"
                        : "bg-transparent text-muted-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                    >
                      <Heart className="w-3.5 h-3.5" /> Buddies
                    </button>
                  </>
                )}
              </div>

              {/* Advanced Filters */}
              <div className="flex items-center gap-2 pl-2 sm:pl-4 sm:border-l sm:border-slate-200 dark:sm:border-slate-700">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-xs font-bold rounded-lg px-2 py-1.5 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer hidden sm:block"
                >
                  <option value="all">All Matches</option>
                  <option value="friendly">Friendly</option>
                  <option value="tournament">Tournament</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-xs font-bold rounded-lg px-2 py-1.5 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                  <option value="mixed">Mixed Doubles</option>
                </select>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as any)}
                  className="bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-slate-300 text-xs font-bold rounded-lg px-2 py-1.5 outline-none border-none focus:ring-2 focus:ring-primary cursor-pointer"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                </select>
              </div>
            </div>

            {/* Empty state for social filters */}
            {!loading && (feedFilter === "following" || feedFilter === "buddies") && displayMatches.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-4">
                <div className="w-16 h-16 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  {feedFilter === "buddies" ? <Heart className="w-8 h-8 text-violet-300" /> : <UserCheck className="w-8 h-8 text-sky-300" />}
                </div>
                <h3 className="text-lg font-black text-muted-foreground dark:text-slate-300 mb-1">
                  No matches yet
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {feedFilter === "buddies"
                    ? "None of your buddies have logged a match recently."
                    : "None of the players you follow have logged a match recently."}
                </p>
              </div>
            )}

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
                  let displayScore = match.score;
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
                  return (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUser={session?.user}
                      isLiveNow={isLiveNow}
                      isMatchOfTheDay={isMatchOfTheDay}
                      upsetDiff={upsetDiff}
                      isKudosed={isKudosed(match)}
                      kudosCount={
                        Array.isArray(match.kudos_users)
                          ? match.kudos_users.length +
                          (kudosState[match.id] === true && !match.kudos_users.includes(session?.user?.id) ? 1 : 0) +
                          (kudosState[match.id] === false && match.kudos_users.includes(session?.user?.id) ? -1 : 0)
                          : (match.id.charCodeAt(0) % 5) + (kudosState[match.id] === true ? 1 : 0)
                      }
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
            ) : feedFilter === "global" ? (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
                <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="w-10 h-10 text-slate-300 dark:text-muted-foreground" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
                  No matches yet
                </h3>
                <p className="text-muted-foreground font-medium max-w-sm mx-auto">
                  It's quiet on the courts. Be the first to log a match today and
                  get the action started!
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
