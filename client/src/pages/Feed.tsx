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
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { getBaseShareUrl } from "@/lib/utils";
import { renderMatchShareCard } from "@/lib/matchShareCard";
import { AnnouncementsSection } from "@/components/feed/AnnouncementsSection";
import { LiveScoreSection } from "@/components/events/LiveScoreSection";
import { UmpireTab } from "@/components/umpire/UmpireTab";
import { MyMatchesTab } from "@/components/feed/MyMatchesTab";
import { MatchCard } from "@/components/feed/MatchCard";
import { ChallengeHubTab } from "@/components/feed/ChallengeHubTab";
import { PollsSection } from "@/components/feed/PollsSection";
import { RivalryCards } from "@/components/feed/RivalryCards";
import { WeeklyChallenges } from "@/components/feed/WeeklyChallenges";
import { LiveScoreWidget, StartLiveScoringButton } from "@/components/feed/LiveScoreWidget";
import { MatchPredictions } from "@/components/feed/MatchPredictions";

export default function Feed() {
  usePageMeta({
    title: "Activity Feed",
    description:
      "Live badminton activity, upsets, and recent matches at IISc Badminton Club.",
  });

  const { session, profile: ownProfile, isUmpire, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/feed/:tab");

  const [activeTab, setActiveTab] = useState<"matches" | "announcements" | "umpire" | "my_matches" | "challenges">("matches");

  useEffect(() => {
    if (match && params?.tab) {
      const tab = params.tab;
      if (tab === "activity") { setActiveTab("matches"); localStorage.setItem("feed_tab", "matches"); }
      else if (tab === "announcements") { setActiveTab("announcements"); localStorage.setItem("feed_tab", "announcements"); }
      else if (tab === "umpire") { setActiveTab("umpire"); localStorage.setItem("feed_tab", "umpire"); }
      else if (tab === "my-matches") { setActiveTab("my_matches"); localStorage.setItem("feed_tab", "my_matches"); }
      else if (tab === "challenges") { setActiveTab("challenges"); localStorage.setItem("feed_tab", "challenges"); }
    } else {
      const saved = localStorage.getItem("feed_tab") || "matches";
      setActiveTab(saved as any);
    }
  }, [match, params?.tab]);

  const handleTabChange = (tabId: "matches" | "announcements" | "umpire" | "my_matches" | "challenges") => {
    setActiveTab(tabId);
    localStorage.setItem("feed_tab", tabId);
    if (tabId === "matches") setLocation("/feed/activity");
    else if (tabId === "announcements") setLocation("/feed/announcements");
    else if (tabId === "umpire") setLocation("/feed/umpire");
    else if (tabId === "my_matches") setLocation("/feed/my-matches");
    else if (tabId === "challenges") setLocation("/feed/challenges");
  };

  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMatchIds, setLiveMatchIds] = useState<Set<string>>(new Set());

  const [limitCount, setLimitCount] = useState(100);

  // Subscribe to live tournament broadcasts and track which player-pairs are live
  useEffect(() => {
    const fetchLive = async () => {
      const { data } = await supabase.from("site_data").select("value").eq("key", "live_matches").single();
      if (data?.value) {
        const ids = new Set<string>();
        Object.values(data.value as Record<string, any>).forEach((m: any) => {
          if (!m.isFriendly && m.status === "playing") {
            [m.t1?.p1Id, m.t1?.p2Id, m.t2?.p1Id, m.t2?.p2Id].filter(Boolean).forEach((id: string) => ids.add(id));
          }
        });
        setLiveMatchIds(ids);
      }
    };
    fetchLive();
    const sub = supabase.channel("feed_live_matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_data", filter: "key=eq.live_matches" },
        (payload) => {
          const val = (payload.new as any)?.value || {};
          const ids = new Set<string>();
          Object.values(val).forEach((m: any) => {
            if (!m.isFriendly && m.status === "playing") {
              [m.t1?.p1Id, m.t1?.p2Id, m.t2?.p1Id, m.t2?.p2Id].filter(Boolean).forEach((id: string) => ids.add(id));
            }
          });
          setLiveMatchIds(ids);
        })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchFeed = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from("matches")
          .select(
            `
          *,
          player1:players!player1_id(id, full_name, avatar_url, elo_rating),
          player2:players!player2_id(id, full_name, avatar_url, elo_rating),
          partner1:players!team1_partner_id(id, full_name, avatar_url),
          partner2:players!team2_partner_id(id, full_name, avatar_url)
        `,
          )
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
    },
    [limitCount],
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // If the initial fetch completes but returns no data (e.g. Supabase cold start),
  // retry silently once after 2 s — covers the most common "blank feed on first open" case.
  const didRetryRef = useRef(false);
  useEffect(() => {
    if (loading || matches.length > 0 || didRetryRef.current) return;
    didRetryRef.current = true;
    const t = setTimeout(() => fetchFeed(true), 2000);
    return () => clearTimeout(t);
  }, [loading, matches.length, fetchFeed]);

  useAutoRefresh(() => fetchFeed(true), 30_000, !loading);

  const [feedFilter, setFeedFilter] = useState<"global" | "following" | "buddies">(
    "global",
  );
  const [kudosState, setKudosState] = useState<Record<string, boolean>>({});

  const followingIds = useMemo(() => {
    const list = Array.isArray(ownProfile?.following) ? ownProfile.following : [];
    return list.map(String);
  }, [ownProfile?.following]);

  const buddyIds = useMemo(() => {
    const list = Array.isArray(ownProfile?.buddies) ? ownProfile.buddies : [];
    return list.map(String);
  }, [ownProfile?.buddies]);

  const displayMatches = useMemo(() => {
    if (feedFilter === "global") return matches;
    const ids = feedFilter === "buddies" ? buddyIds : followingIds;

    if (ids.length === 0) return [];

    return matches.filter((m: any) => {
      const matchIds = [
        m.player1_id,
        m.player2_id,
        m.team1_partner_id,
        m.team2_partner_id,
        m.player1?.id,
        m.player2?.id,
        m.partner1?.id,
        m.partner2?.id
      ].filter(Boolean).map(String);

      return ids.some(id => matchIds.includes(id));
    });
  }, [matches, feedFilter, followingIds, buddyIds]);

  const courtUtil = useMemo(() => {
    const hours = new Array(24).fill(0);
    matches.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      hours[h]++;
    });
    const morning = hours.slice(5, 12).reduce((a, b) => a + b, 0);
    const afternoon = hours.slice(12, 17).reduce((a, b) => a + b, 0);
    const evening =
      hours.slice(17, 24).reduce((a, b) => a + b, 0) +
      hours.slice(0, 5).reduce((a, b) => a + b, 0);
    const total = matches.length || 1;
    return {
      morning: (morning / total) * 100,
      afternoon: (afternoon / total) * 100,
      evening: (evening / total) * 100,
      isPeak: Math.max(morning, afternoon, evening),
    };
  }, [matches]);

  const matchOfTheDayId = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const recentMatches = matches.filter(
      (m) =>
        new Date(m.created_at).getTime() > Date.now() - 48 * 60 * 60 * 1000,
    );
    if (recentMatches.length === 0) return matches[0].id;
    return recentMatches.reduce((best, m) => {
      const combinedElo =
        (m.player1?.elo_rating || 0) + (m.player2?.elo_rating || 0);
      const bestElo =
        (best.player1?.elo_rating || 0) + (best.player2?.elo_rating || 0);
      return combinedElo > bestElo ? m : best;
    }, recentMatches[0]).id;
  }, [matches]);

  const weeklyRecap = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const lastWeekMatches = matches.filter(
      (m) =>
        new Date(m.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
    );
    if (lastWeekMatches.length === 0) return null;

    let biggestUpset = null;
    let maxUpsetDiff = 0;
    const playerActivity: Record<
      string,
      { name: string; matches: number; eloClimb: number }
    > = {};

    lastWeekMatches.forEach((m) => {
      // Activity & ELO Climb
      const addPlayer = (pid: string, name: string, eloChange: number) => {
        if (!playerActivity[pid])
          playerActivity[pid] = { name, matches: 0, eloClimb: 0 };
        playerActivity[pid].matches++;
        if (eloChange && !isNaN(eloChange))
          playerActivity[pid].eloClimb += eloChange;
      };

      if (m.player1)
        addPlayer(m.player1.id, m.player1.full_name, m.elo_change_p1 || 0);
      if (m.player2)
        addPlayer(m.player2.id, m.player2.full_name, m.elo_change_p2 || 0);
      if (m.partner1)
        addPlayer(m.partner1.id, m.partner1.full_name, m.elo_change_p3 || 0);
      if (m.partner2)
        addPlayer(m.partner2.id, m.partner2.full_name, m.elo_change_p4 || 0);

      // Upset
      const isP1Winner = m.winner_id === m.player1?.id;
      if (
        m.elo_change_p1 !== undefined &&
        m.elo_change_p2 !== undefined &&
        m.player1 &&
        m.player2
      ) {
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

    const mostActive = Object.values(playerActivity).sort(
      (a, b) => b.matches - a.matches,
    )[0];
    const highestClimber = Object.values(playerActivity).sort(
      (a, b) => b.eloClimb - a.eloClimb,
    )[0];

    return {
      biggestUpset,
      mostActive,
      highestClimber,
    };
  }, [matches]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 lg:pb-8 font-sans selection:bg-emerald-500/30">
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-emerald-900 text-white py-12 lg:py-16 relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 max-w-3xl relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest mb-4">
            <Activity className="w-4 h-4 text-emerald-400" /> Global Feed
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight">
            Activity Feed
          </h1>
          <p className="text-slate-300 font-medium">
            See what's happening on the courts in real-time.
          </p>

          <div className="mt-8 w-full flex justify-center">
            <div className="w-full grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:gap-0 bg-transparent sm:bg-white/10 sm:backdrop-blur-md sm:p-1.5 sm:rounded-2xl sm:border sm:border-white/20">
              <Link
                href="/feed/activity"
                onClick={() => handleTabChange("matches")}
                className={`flex justify-center items-center gap-2 px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === "matches"
                  ? "bg-white text-emerald-900 shadow-md"
                  : "bg-white/10 sm:bg-transparent text-white/90 sm:text-white/80 hover:bg-white/20 sm:hover:bg-white/10"
                  }`}
              >
                <Activity className="w-4 h-4" /> Match Activity
              </Link>
              <Link
                href="/feed/announcements"
                onClick={() => {
                  handleTabChange("announcements");
                  localStorage.setItem("iisc_announcements_last_seen", Date.now().toString());
                  window.dispatchEvent(new Event("announcements-read"));
                }}
                className={`flex justify-center items-center gap-2 px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === "announcements"
                  ? "bg-white text-emerald-900 shadow-md"
                  : "bg-white/10 sm:bg-transparent text-white/90 sm:text-white/80 hover:bg-white/20 sm:hover:bg-white/10"
                  }`}
              >
                <Bell className="w-4 h-4" /> Announcements
              </Link>
              {session && (
                <>
                  <Link
                    href="/feed/my-matches"
                    onClick={() => handleTabChange("my_matches")}
                    className={`flex justify-center items-center gap-2 px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === "my_matches"
                      ? "bg-white text-emerald-900 shadow-md"
                      : "bg-white/10 sm:bg-transparent text-white/90 sm:text-white/80 hover:bg-white/20 sm:hover:bg-white/10"
                      }`}
                  >
                    <UserCheck className="w-4 h-4" /> My Matches
                  </Link>
                  <Link
                    href="/feed/challenges"
                    onClick={() => handleTabChange("challenges")}
                    className={`flex justify-center items-center gap-2 px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === "challenges"
                      ? "bg-white text-emerald-900 shadow-md"
                      : "bg-white/10 sm:bg-transparent text-white/90 sm:text-white/80 hover:bg-white/20 sm:hover:bg-white/10"
                      }`}
                  >
                    <Swords className="w-4 h-4" /> Challenges
                  </Link>
                </>
              )}
              {(isUmpire || isAdmin) && (
                <Link
                  href="/feed/umpire"
                  onClick={() => handleTabChange("umpire")}
                  className={`col-span-full sm:col-span-1 flex justify-center items-center gap-2 px-4 py-3 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${activeTab === "umpire"
                    ? "bg-white text-emerald-900 shadow-md"
                    : "bg-white/10 sm:bg-transparent text-white/90 sm:text-white/80 hover:bg-white/20 sm:hover:bg-white/10"
                    }`}
                >
                  <Tv2 className="w-4 h-4" /> Umpire
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8">
        {activeTab === "announcements" ? (
          <AnnouncementsSection />
        ) : activeTab === "umpire" && (isUmpire || isAdmin) ? (
          <UmpireTab />
        ) : activeTab === "my_matches" ? (
          <MyMatchesTab />
        ) : activeTab === "challenges" ? (
          <>
            <div className="mb-6">
              <WeeklyChallenges />
            </div>
            <ChallengeHubTab currentUser={session?.user} />
          </>
        ) : (
          <>
            {!loading && session && (
              <div className="flex justify-end mb-4">
                <StartLiveScoringButton />
              </div>
            )}
            {!loading && <LiveScoreWidget />}
            {!loading && session && <MatchPredictions />}

            {!loading && displayMatches.length > 0 && (
              <>
                <div className="-mx-4 sm:mx-0 mb-6">
                  <LiveScoreSection />
                </div>
                <div className="mb-6 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
                    <BarChart3 className="w-4 h-4 text-emerald-500" /> Court
                    Utilization (Recent)
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
                  <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-400 uppercase">
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
              <div className="mb-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700 relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />
                <h3 className="text-sm font-black uppercase tracking-widest text-amber-400 mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> Weekly Club Recap
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {weeklyRecap.mostActive && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Most Active Player
                      </span>
                      <div className="text-base font-bold text-white line-clamp-1">
                        {weeklyRecap.mostActive.name}
                      </div>
                      <div className="text-sm font-black text-emerald-400">
                        {weeklyRecap.mostActive.matches} Matches Played
                      </div>
                    </div>
                  )}
                  {weeklyRecap.highestClimber &&
                    weeklyRecap.highestClimber.eloClimb > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Highest Climber
                        </span>
                        <div className="text-base font-bold text-white line-clamp-1">
                          {weeklyRecap.highestClimber.name}
                        </div>
                        <div className="text-sm font-black text-amber-400">
                          +{weeklyRecap.highestClimber.eloClimb} ELO Gained
                        </div>
                      </div>
                    )}
                  {weeklyRecap.biggestUpset && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Biggest Upset
                      </span>
                      <div className="text-base font-bold text-white line-clamp-1">
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

            {/* Feed filter tabs */}
            <div className="mb-5 flex gap-2">
              <button
                onClick={() => setFeedFilter("global")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${feedFilter === "global"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400"
                  }`}
              >
                <Activity className="w-3.5 h-3.5" /> Global
              </button>
              {session && (
                <>
                  <button
                    onClick={() => setFeedFilter("following")}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${feedFilter === "following"
                      ? "bg-sky-600 text-white shadow-md"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400"
                      }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Following
                  </button>
                  <button
                    onClick={() => setFeedFilter("buddies")}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${feedFilter === "buddies"
                      ? "bg-violet-600 text-white shadow-md"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-violet-400"
                      }`}
                  >
                    <Heart className="w-3.5 h-3.5" /> Buddies
                  </button>
                </>
              )}
            </div>

            {/* Empty state for social filters */}
            {!loading && (feedFilter === "following" || feedFilter === "buddies") && displayMatches.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-4">
                <div className="w-16 h-16 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  {feedFilter === "buddies" ? <Heart className="w-8 h-8 text-violet-300" /> : <UserCheck className="w-8 h-8 text-sky-300" />}
                </div>
                <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-1">
                  No matches yet
                </h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
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
                  const isP1Winner = match.winner_id === p1.id;
                  const isUpset = false; // We can add upset logic if we want based on ELO difference

                  // Determine Elo difference before match
                  let upsetDiff = 0;
                  if (
                    match.elo_change_p1 !== undefined &&
                    match.elo_change_p2 !== undefined
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

                  const handleShare = async (match: any) => {
                    const p1 = match.player1;
                    const p2 = match.player2;
                    const p1Name = p1?.full_name || "Player 1";
                    const p2Name = p2?.full_name || "Player 2";
                    const isP1Winner = match.winner_id === match.player1_id;
                    const winnerName = isP1Winner ? p1Name : p2Name;
                    const loserName = isP1Winner ? p2Name : p1Name;
                    const winnerAvatar = isP1Winner
                      ? p1?.avatar_url
                      : p2?.avatar_url;
                    const loserAvatar = isP1Winner
                      ? p2?.avatar_url
                      : p1?.avatar_url;
                    const eloChange = isP1Winner
                      ? match.elo_change_p1
                        ? `+${match.elo_change_p1}`
                        : ""
                      : match.elo_change_p2
                        ? `+${match.elo_change_p2}`
                        : "";

                    // Score: strip out video URL suffix if present
                    let displayScore = match.score
                      ? match.score.split(" | ")[0]
                      : "N/A";

                    const shareUrl = `${getBaseShareUrl()}/feed?match=${match.id}`;
                    const text = `🏸 Match Result: ${winnerName} def. ${loserName} (${displayScore})! Check it out on IISc Badminton Club.`;

                    // Helper to load an image via canvas (bypasses CORS for cross-origin avatars)
                    const loadImg = (
                      url: string,
                    ): Promise<HTMLImageElement | null> =>
                      new Promise((resolve) => {
                        if (!url) return resolve(null);
                        const img = new Image();
                        img.crossOrigin = "anonymous";
                        img.onload = () => resolve(img);
                        img.onerror = () => resolve(null);
                        img.src = url;
                      });

                    // Draw a circle-clipped avatar at (cx, cy) with radius r
                    const drawCircleAvatar = (
                      ctx: CanvasRenderingContext2D,
                      img: HTMLImageElement | null,
                      cx: number,
                      cy: number,
                      r: number,
                      initial: string,
                      bgColor: string,
                    ) => {
                      ctx.save();
                      ctx.beginPath();
                      ctx.arc(cx, cy, r, 0, Math.PI * 2);
                      ctx.clip();
                      if (img) {
                        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
                      } else {
                        ctx.fillStyle = bgColor;
                        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
                        ctx.fillStyle = "#ffffff";
                        ctx.font = `bold ${r}px sans-serif`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(initial.toUpperCase(), cx, cy);
                      }
                      ctx.restore();
                      // Ring
                      ctx.beginPath();
                      ctx.arc(cx, cy, r, 0, Math.PI * 2);
                      ctx.strokeStyle = bgColor;
                      ctx.lineWidth = 6;
                      ctx.stroke();
                    };

                    // Truncate long names to fit canvas
                    const truncate = (
                      ctx: CanvasRenderingContext2D,
                      name: string,
                      maxW: number,
                    ) => {
                      if (ctx.measureText(name).width <= maxW) return name;
                      let n = name;
                      while (ctx.measureText(n + "…").width > maxW && n.length > 1)
                        n = n.slice(0, -1);
                      return n + "…";
                    };

                    const fallbackShare = () => {
                      if (Capacitor.isNativePlatform()) {
                        Share.share({
                          title: "IISc Badminton Club Match",
                          text,
                          url: shareUrl,
                          dialogTitle: "Share Match Result",
                        });
                      } else if (navigator.share) {
                        navigator.share({
                          title: "IISc Badminton Club Match",
                          text,
                          url: shareUrl,
                        });
                      } else {
                        navigator.clipboard.writeText(`${text}\n${shareUrl}`);
                        toast.success("Match result copied to clipboard!");
                      }
                    };

                    try {
                      const canvas = await renderMatchShareCard({
                        winnerName,
                        loserName,
                        winnerAvatar: winnerAvatar || "",
                        loserAvatar: loserAvatar || "",
                        displayScore,
                        winnerEloChange: isP1Winner
                          ? match.elo_change_p1
                          : match.elo_change_p2,
                        loserEloChange: isP1Winner
                          ? match.elo_change_p2
                          : match.elo_change_p1,
                        matchType:
                          match.is_friendly !== false ? "Friendly" : "Tournament",
                        matchDate: new Date(match.created_at),
                        category: match.category,
                      });

                      if (!canvas) {
                        fallbackShare();
                        return;
                      }

                      if (Capacitor.isNativePlatform()) {
                        const base64 = canvas.toDataURL("image/png").split(",")[1];
                        const { uri } = await Filesystem.writeFile({
                          path: "match-share.png",
                          data: base64,
                          directory: Directory.Cache,
                        });
                        await Share.share({
                          title: "IISc Badminton Club Match",
                          text,
                          files: [uri],
                          dialogTitle: "Share Match Result",
                        });
                        toast.success("Match Recap shared!");
                      } else {
                        canvas.toBlob(async (blob) => {
                          if (blob) {
                            const file = new File([blob], "match-recap.png", {
                              type: "image/png",
                            });
                            if (navigator.canShare?.({ files: [file] })) {
                              await navigator.share({
                                title: "IISc Badminton Club Match",
                                text,
                                url: shareUrl,
                                files: [file],
                              });
                              toast.success("Match Recap shared!");
                              return;
                            }
                          }
                          fallbackShare();
                        }, "image/png");
                      }
                    } catch (err: any) {
                      if (!err.message?.includes("cancel")) fallbackShare();
                    }
                  };
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
                      className="px-6 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full font-bold text-sm transition shadow-sm hover:shadow-md"
                    >
                      Load More Matches
                    </button>
                  </div>
                )}
              </div>
            ) : feedFilter === "global" ? (
              <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
                <div className="w-24 h-24 mx-auto bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
                  No matches yet
                </h3>
                <p className="text-slate-500 font-medium max-w-sm mx-auto">
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
