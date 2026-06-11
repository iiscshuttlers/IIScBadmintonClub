import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
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
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/contexts/AuthContext";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { getBaseShareUrl } from "@/lib/utils";
import { AnnouncementsSection } from "@/components/feed/AnnouncementsSection";

export default function Feed() {
  usePageMeta({
    title: "Activity Feed",
    description:
      "Live badminton activity, upsets, and recent matches at IISc Badminton Club.",
  });

  const { session, profile: ownProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"matches" | "announcements">(() => {
    return typeof window !== "undefined" && window.location.search.includes("tab=announcements")
      ? "announcements"
      : "matches";
  });
  
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("tab=announcements")) {
      setActiveTab("announcements");
    }
  }, []);
  
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [limitCount, setLimitCount] = useState(30);

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
    return Array.isArray((ownProfile as any)?.following) ? (ownProfile as any).following : [];
  }, [(ownProfile as any)?.following]);

  const buddyIds = useMemo(() => {
    return Array.isArray((ownProfile as any)?.buddies) ? (ownProfile as any).buddies : [];
  }, [(ownProfile as any)?.buddies]);

  const displayMatches = useMemo(() => {
    if (feedFilter === "global") return matches;
    const ids = feedFilter === "buddies" ? buddyIds : followingIds;
    return matches.filter(
      (m: any) =>
        ids.includes(m.player1_id) ||
        ids.includes(m.player2_id) ||
        (m.team1_partner_id && ids.includes(m.team1_partner_id)) ||
        (m.team2_partner_id && ids.includes(m.team2_partner_id)),
    );
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

          <div className="mt-8 flex justify-center">
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
              <button
                onClick={() => setActiveTab("matches")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "matches"
                    ? "bg-white text-emerald-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <Activity className="w-4 h-4" /> Match Activity
              </button>
              <button
                onClick={() => {
                  setActiveTab("announcements");
                  localStorage.setItem("iisc_announcements_last_seen", Date.now().toString());
                  window.dispatchEvent(new Event("announcements-read"));
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === "announcements"
                    ? "bg-white text-emerald-900 shadow-md scale-100"
                    : "text-white/80 hover:text-white hover:bg-white/10 scale-95"
                }`}
              >
                <Bell className="w-4 h-4" /> Announcements
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-3xl mt-8">
        {activeTab === "announcements" ? (
          <AnnouncementsSection />
        ) : (
          <>
        {!loading && displayMatches.length > 0 && (
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
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
              feedFilter === "global"
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
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  feedFilter === "following"
                    ? "bg-sky-600 text-white shadow-md"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Following
              </button>
              <button
                onClick={() => setFeedFilter("buddies")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  feedFilter === "buddies"
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
                  toast.success("Kudos given! ⭐");
                } else {
                  localStorage.removeItem(storageKey);
                  setKudosState((prev) => ({ ...prev, [match.id]: false }));
                  toast.success("Kudos removed");
                }

                if (session?.user?.id) {
                  supabase
                    .rpc("toggle_match_kudos", { p_match_id: match.id })
                    .then(({ error }) => {
                      if (error)
                        console.warn("Failed to sync kudos live:", error);
                    });
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
                const text = `🏸 Match Result: ${winnerName} def. ${loserName} (${displayScore})! Check it out on IISc Shuttlers.`;

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
                      title: "IISc Shuttlers Match",
                      text,
                      url: shareUrl,
                      dialogTitle: "Share Match Result",
                    });
                  } else if (navigator.share) {
                    navigator.share({
                      title: "IISc Shuttlers Match",
                      text,
                      url: shareUrl,
                    });
                  } else {
                    navigator.clipboard.writeText(`${text}\n${shareUrl}`);
                    toast.success("Match result copied to clipboard!");
                  }
                };

                try {
                  const [winImg, loseImg] = await Promise.all([
                    loadImg(winnerAvatar),
                    loadImg(loserAvatar),
                  ]);

                  const W = 1080,
                    H = 1080;
                  const canvas = document.createElement("canvas");
                  canvas.width = W;
                  canvas.height = H;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) {
                    fallbackShare();
                    return;
                  }

                  // ── Background ──
                  const bg = ctx.createLinearGradient(0, 0, W, H);
                  bg.addColorStop(0, "#0f172a");
                  bg.addColorStop(1, "#020617");
                  ctx.fillStyle = bg;
                  ctx.fillRect(0, 0, W, H);

                  // Subtle radial glow behind winner avatar
                  const glow = ctx.createRadialGradient(
                    270,
                    380,
                    0,
                    270,
                    380,
                    320,
                  );
                  glow.addColorStop(0, "rgba(16,185,129,0.18)");
                  glow.addColorStop(1, "rgba(16,185,129,0)");
                  ctx.fillStyle = glow;
                  ctx.fillRect(0, 0, W, H);

                  // ── Club badge / header ──
                  ctx.fillStyle = "#10b981";
                  ctx.font = "bold 44px sans-serif";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "alphabetic";
                  ctx.fillText("🏸 IISc Shuttlers", W / 2, 90);

                  ctx.fillStyle = "rgba(255,255,255,0.15)";
                  ctx.fillRect(120, 108, W - 240, 3);

                  ctx.fillStyle = "#64748b";
                  ctx.font = "bold 32px sans-serif";
                  ctx.fillText("MATCH RESULT", W / 2, 168);

                  // ── Winner section ──
                  drawCircleAvatar(
                    ctx,
                    winImg,
                    270,
                    360,
                    170,
                    winnerName[0],
                    "#10b981",
                  );

                  // Winner crown
                  ctx.font = "72px sans-serif";
                  ctx.textAlign = "center";
                  ctx.fillText("🏆", 270, 175);

                  ctx.fillStyle = "#10b981";
                  ctx.font = "bold 32px sans-serif";
                  ctx.fillText("WINNER", 270, 570);

                  ctx.fillStyle = "#ffffff";
                  ctx.font = "bold 56px sans-serif";
                  ctx.fillText(truncate(ctx, winnerName, 480), 270, 636);

                  if (eloChange) {
                    ctx.fillStyle = "#10b981";
                    ctx.font = "bold 36px sans-serif";
                    ctx.fillText(`${eloChange} ELO`, 270, 690);
                  }

                  // ── Score divider ──
                  const scoreY = 760;
                  ctx.fillStyle = "#1e293b";
                  ctx.beginPath();
                  ctx.roundRect(W / 2 - 200, scoreY - 64, 400, 96, 24);
                  ctx.fill();

                  ctx.fillStyle = "#f59e0b";
                  ctx.font = "bold 72px monospace";
                  ctx.fillText(displayScore, W / 2, scoreY);

                  ctx.fillStyle = "#475569";
                  ctx.font = "bold 26px sans-serif";
                  ctx.fillText("DEF.", W / 2, scoreY + 52);

                  // ── Loser section ──
                  drawCircleAvatar(
                    ctx,
                    loseImg,
                    W - 270,
                    360,
                    140,
                    loserName[0],
                    "#475569",
                  );

                  ctx.fillStyle = "#64748b";
                  ctx.font = "bold 28px sans-serif";
                  ctx.fillText("Runner-up", W - 270, 536);

                  ctx.fillStyle = "#94a3b8";
                  ctx.font = "bold 46px sans-serif";
                  ctx.fillText(truncate(ctx, loserName, 420), W - 270, 596);

                  // ── Footer ──
                  ctx.fillStyle = "rgba(255,255,255,0.06)";
                  ctx.fillRect(0, H - 100, W, 100);

                  ctx.fillStyle = "#475569";
                  ctx.font = "bold 30px sans-serif";
                  ctx.fillText("iiscshuttlers.com", W / 2, H - 36);

                  if (Capacitor.isNativePlatform()) {
                    const base64 = canvas.toDataURL("image/png").split(",")[1];
                    const { uri } = await Filesystem.writeFile({
                      path: "match-share.png",
                      data: base64,
                      directory: Directory.Cache,
                    });
                    await Share.share({
                      title: "IISc Shuttlers Match",
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
                            title: "IISc Shuttlers Match",
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
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={match.id}
                  id={`match-card-${match.id}`}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm relative overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 ${isMatchOfTheDay ? "border-2 border-amber-400 shadow-amber-500/20 shadow-xl hover:shadow-amber-400/30" : "border border-slate-100 dark:border-slate-800 hover:shadow-lg dark:hover:shadow-slate-700/40"}`}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                    if (info.offset.x > 100) {
                      handleKudos(match);
                    } else if (info.offset.x < -100) {
                      handleShare(match);
                    }
                  }}
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
                      <TrendingUp className="w-3.5 h-3.5 animate-bounce" />{" "}
                      MASSIVE UPSET
                    </div>
                  )}

                  <div className="text-center text-xs font-bold text-slate-400 dark:text-slate-500 mb-3 flex items-center justify-center gap-1">
                    <Swords className="w-3.5 h-3.5" />
                    {match.is_friendly === false
                      ? "Tournament Match"
                      : "Friendly Match"}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    {/* Player 1 (and Partner 1) */}
                    <div
                      className={`flex-1 flex flex-col sm:flex-row items-center gap-3 p-3 rounded-2xl transition-colors ${isP1Winner ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                    >
                      <div className="relative flex">
                        <Link href={`/player/${p1.id}`}>
                          <img
                            src={p1.avatar_url || ""}
                            loading="lazy"
                            className={`w-12 h-12 rounded-full object-cover shadow-sm relative z-10 ${isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"}`}
                          />
                        </Link>
                        {match.partner1 && (
                          <Link href={`/player/${match.partner1.id}`}>
                            <img
                              loading="lazy"
                              src={match.partner1.avatar_url || ""}
                              className={`w-12 h-12 rounded-full object-cover shadow-sm -ml-4 relative z-0 ${isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"}`}
                            />
                          </Link>
                        )}
                        {isP1Winner && (
                          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm z-20">
                            <Trophy className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="text-center sm:text-left">
                        <div
                          className={`font-black text-sm ${isP1Winner ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}
                        >
                          <Link
                            href={`/player/${p1.id}`}
                            className="hover:underline"
                          >
                            {p1.full_name}
                          </Link>
                          {match.partner1 && (
                            <>
                              <br />
                              <Link
                                href={`/player/${match.partner1.id}`}
                                className="hover:underline"
                              >
                                {match.partner1.full_name}
                              </Link>
                            </>
                          )}
                        </div>
                        {match.elo_change_p1 && (
                          <div
                            className={`text-xs font-bold ${match.elo_change_p1 > 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {match.elo_change_p1 > 0 ? "+" : ""}
                            {match.elo_change_p1} ELO
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
                        {new Date(match.created_at).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </div>
                      {highlightUrl && (
                        <a
                          href={highlightUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 text-[10px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-500 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1 hover:scale-105 transition"
                        >
                          <Video className="w-3 h-3" /> Highlights
                        </a>
                      )}
                    </div>

                    {/* Player 2 (and Partner 2) */}
                    <div
                      className={`flex-1 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 p-3 rounded-2xl transition-colors ${!isP1Winner ? "bg-emerald-50 dark:bg-emerald-900/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                    >
                      <div className="text-center sm:text-right">
                        <div
                          className={`font-black text-sm ${!isP1Winner ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}
                        >
                          <Link
                            href={`/player/${p2.id}`}
                            className="hover:underline"
                          >
                            {p2.full_name}
                          </Link>
                          {match.partner2 && (
                            <>
                              <br />
                              <Link
                                href={`/player/${match.partner2.id}`}
                                className="hover:underline"
                              >
                                {match.partner2.full_name}
                              </Link>
                            </>
                          )}
                        </div>
                        {match.elo_change_p2 && (
                          <div
                            className={`text-xs font-bold ${match.elo_change_p2 > 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {match.elo_change_p2 > 0 ? "+" : ""}
                            {match.elo_change_p2} ELO
                          </div>
                        )}
                      </div>
                      <div className="relative flex flex-row-reverse">
                        <Link href={`/player/${p2.id}`}>
                          <img
                            loading="lazy"
                            src={p2.avatar_url || ""}
                            className={`w-12 h-12 rounded-full object-cover shadow-sm relative z-10 ${!isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"}`}
                          />
                        </Link>
                        {match.partner2 && (
                          <Link href={`/player/${match.partner2.id}`}>
                            <img
                              loading="lazy"
                              src={match.partner2.avatar_url || ""}
                              className={`w-12 h-12 rounded-full object-cover shadow-sm -mr-4 relative z-0 ${!isP1Winner ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900" : "grayscale opacity-80"}`}
                            />
                          </Link>
                        )}
                        {!isP1Winner && (
                          <div className="absolute -bottom-2 -left-2 sm:-left-2 sm:right-auto bg-emerald-500 text-white rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm z-20">
                            <Trophy className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reaction Kudos */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex justify-end">
                    <button
                      onClick={() => handleKudos(match)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                        isKudosed(match)
                          ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-500/20"
                          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <Star
                        className="w-4 h-4"
                        fill={isKudosed(match) ? "currentColor" : "none"}
                        stroke="currentColor"
                      />
                      Kudos{" "}
                      <span className="kudos-count font-medium ml-1">
                        {Array.isArray(match.kudos_users)
                          ? match.kudos_users.length +
                            (kudosState[match.id] === true && !match.kudos_users.includes(session?.user?.id) ? 1 : 0) +
                            (kudosState[match.id] === false && match.kudos_users.includes(session?.user?.id) ? -1 : 0)
                          : (match.id.charCodeAt(0) % 5) +
                            (kudosState[match.id] === true ? 1 : 0)}
                      </span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleShare(match);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 ml-2"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {displayMatches.length >= limitCount && (
              <div className="flex justify-center mt-6 pt-4 pb-8">
                <button
                  onClick={() => setLimitCount((prev) => prev + 30)}
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
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-2">
              No matches yet
            </h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">
              It's quiet on the courts. Be the first to log a match today and
              get the action started!
            </p>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
