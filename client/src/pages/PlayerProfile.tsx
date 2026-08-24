import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { useHashTab } from "@/hooks/useHashTab";
import { useAuth } from "@/contexts/AuthContext";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Share2,
  Crosshair,
  Sparkles,
  Quote,
  LogOut,
  Settings,
  Swords,
  Footprints,
  Flag,
  Bell,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NotificationModal } from "@/components/events/NotificationModal";

import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useTournamentMatchHistory } from "@/hooks/useTournamentMatchHistory";
import { useMatchActions } from "@/hooks/useMatchActions";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { useArchivedTournaments } from "@/hooks/useArchivedTournaments";
import { MatchHistorySection } from "@/components/player-profile/MatchHistorySection";
import {
  EquipmentArsenalSection,
  CareerHighlightsSection,
} from "@/components/player-profile/PlayerProfileSections";

import { LoadingScreen } from "@/components/player-profile/PlayerProfileWidgets";
import { HeadToHeadWidget } from "@/components/player-profile/HeadToHeadWidget";
import { AchievementBadges } from "@/components/player-profile/AchievementBadges";
import { WrappedCard } from "@/components/player-profile/WrappedCard";
import { PerformanceTrends } from "@/components/player-profile/PerformanceTrends";
import { PlayerAnalyticsWidget } from "@/components/player-profile/PlayerAnalyticsWidget";
import { ActivityHeatmap } from "@/components/player-profile/PlayerProfileWidgets";
import { DoublesSynergyWidget } from "@/components/player-profile/PlayerProfileWidgets";
import { Badges } from "@/components/player-profile/PlayerProfileWidgets";
import { PlayerPhotosSection } from "@/components/player-profile/PlayerPhotosSection";

import { useTheme } from "@/contexts/ThemeContext";
import { ChallengeModal } from "@/components/ChallengeModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Extracted Hooks & Components
import { TeaserOverlay } from "@/components/TeaserOverlay";
import { usePlayerProfileQuery } from "@/hooks/queries/usePlayerProfileQuery";
import { useProfileAnalytics } from "@/hooks/useProfileAnalytics";
import { PlayerHeroBanner } from "@/components/player-profile/PlayerHeroBanner";
import { PlayerActionBar } from "@/components/player-profile/PlayerActionBar";
import { ProfileOverviewTab } from "@/components/player-profile/tabs/ProfileOverviewTab";
import { ProfileOverviewTabRight } from "@/components/player-profile/tabs/ProfileOverviewTabRight";
import { ProfileRankingTab } from "@/components/player-profile/tabs/ProfileRankingTab";
import {
  ProfileStatsTabLeft,
  ProfileStatsTabRight,
} from "@/components/player-profile/tabs/ProfileStatsTab";

import { fetchPlayer, fetchPlayerList } from "@/services/playerService";
import type { PlayerRow } from "@/types";
import { exportProfilePdf } from "@/lib/exportProfilePdf";
import { getBaseShareUrl } from "@/lib/utils";
import { Share } from "@capacitor/share";
import { toast } from "sonner";
import { renderWrappedShareCard } from "@/lib/wrappedShareCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session: authSession, signOut } = useAuth();
  const { theme } = useTheme();

  // Load active tab from hash
  const [activeTab, setActiveTab] = useHashTab(["OVERVIEW", "RANKING", "STATS", "MATCHES", "PHOTOS"] as const, "OVERVIEW");

  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);


  // Own player profile
  const [ownPlayerProfile, setOwnPlayerProfile] = useState<any | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);

  // Load user profile and players
  useEffect(() => {
    async function loadOwnProfile() {
      if (authSession?.user?.id) {
        try {
          const profile = await fetchPlayer(authSession.user.id);
          setOwnPlayerProfile(profile);
        } catch {}
      }
    }
    loadOwnProfile();
  }, [authSession?.user?.id]);

  useEffect(() => {
    fetchPlayerList().then(setAllPlayers).catch(() => {});
  }, []);

  // Use Custom Hooks
  const { player, loading, eloRank, liveMatches, eloLogs, isMatchParticipant, silentRefresh } =
    usePlayerProfileQuery(id, ownPlayerProfile?.id);

  const {
    h2hRecord,
    recentOpponents,
    bestOpponent,
    eloHistoryData,
    eloChartFilter,
    setEloChartFilter,
  } = useProfileAnalytics(id, player, liveMatches, eloLogs, ownPlayerProfile);

  const {
    handleWithdrawMatch,
    handleConfirmMatch,
    handleRejectMatch,
    handleResendRequest,
  } = useMatchActions(ownPlayerProfile, () => silentRefresh(), () => {}, liveMatches);

  const { archivedTournaments } = useArchivedTournaments();

  const dynamicTournamentData = useMemo(() => {
    if (!player) return { achievements: [], tournaments: [] };

    const achievements: string[] = [];
    const tournaments = new Set<string>();

    const isPlayerInString = (str?: string) => {
      if (!str) return false;
      const cleanStr = str.toLowerCase().replace(/\(.*?\)/g, "").trim();
      const playerName = (player.fullName || "").toLowerCase();
      const firstName = playerName.split(" ")[0];
      return cleanStr.includes(playerName) || cleanStr.includes(firstName);
    };

    archivedTournaments.forEach((t) => {
      let playerPlayed = false;
      if (t.winners) {
        t.winners.forEach((w) => {
          const isWinner = isPlayerInString(w.winner);
          const isRunnerUp = isPlayerInString(w.runnerUp);
          const isBronze = w.bronze?.some(b => isPlayerInString(b));

          if (isWinner || isRunnerUp || isBronze) {
            playerPlayed = true;
            const yearMatch = t.startDate.match(/^(\d{4})/);
            const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
            
            const position = isWinner ? "Winner" : isRunnerUp ? "Runner-Up" : "Bronze";
            // e.g. "Men's Doubles Winner - Farewell 2026"
            const achText = `${w.category} ${position} - ${t.name.replace(/ 20\d{2}$/, "")} ${year}`;
            achievements.push(achText);
          }
        });
      }
      
      if (t.podium && t.podium.some(p => isPlayerInString(p))) {
         playerPlayed = true;
      }

      if (playerPlayed) {
        tournaments.add(t.name);
      }
    });

    return { achievements, tournaments: Array.from(tournaments) };
  }, [player, archivedTournaments]);

  const validAchievements = useMemo(() => {
    const manual = player?.achievements?.filter((a: string) => a.trim().length > 0) || [];
    const combined = [...manual];
    
    // Simple deduplication based on text similarity
    dynamicTournamentData.achievements.forEach(dynAch => {
       const dynLower = dynAch.toLowerCase().replace(/[^\w\s]/g, "");
       const exists = manual.some((m: string) => m.toLowerCase().replace(/[^\w\s]/g, "") === dynLower);
       if (!exists) {
         combined.push(dynAch);
       }
    });
    return combined;
  }, [player, dynamicTournamentData]);

  const augmentedPlayer = useMemo(() => {
    if (!player) return null;
    const manualTournaments = player.tournamentHistory || [];
    const combinedTourneys = Array.from(new Set([...manualTournaments, ...dynamicTournamentData.tournaments]));
    return {
      ...player,
      tournamentHistory: combinedTourneys
    };
  }, [player, dynamicTournamentData]);

  const { data: tournamentRuns } = useTournamentMatchHistory(id);

  const { splitStats, streakStats, profileCompleteness } = usePlayerStats(
    (player as any) || null,
    liveMatches,
    validAchievements,
    tournamentRuns || undefined
  );

  const pendingMatches = useMemo(() => {
    if (!player) return [];
    return liveMatches.filter(
      (m) => m.status === "pending" && isMatchParticipant(m, player.userId)
    );
  }, [liveMatches, player, isMatchParticipant]);

  const currentYearNow = new Date().getFullYear();
  const profileYear = player?.joinedYear || (player?.created_at ? new Date(player.created_at).getFullYear() : currentYearNow);
  const minYear = profileYear;
  const wrappedYears = Array.from({ length: Math.max(1, currentYearNow - minYear + 1) }, (_, i) => currentYearNow - i);

  const handleShare = async () => {
    if (!player) return;
    try {
      const shareUrl = `${getBaseShareUrl()}/player/${player.id}`;
      
      // Build ranking line
      const rankParts: string[] = [];
      if (eloRank?.overall) rankParts.push(`#${eloRank.overall} Overall`);
      if (eloRank?.singles) rankParts.push(`#${eloRank.singles} Singles`);
      if (eloRank?.doubles) rankParts.push(`#${eloRank.doubles} Doubles`);
      if (eloRank?.mixed) rankParts.push(`#${eloRank.mixed} XD`);
      const rankLine = rankParts.length > 0 ? `🏆 Ranking: ${rankParts.join(' · ')}` : '';

      const shareText = [
        `🏸 ${player.fullName}'s Badminton Profile`,
        rankLine,
        `📈 Win Rate: ${splitStats?.all?.winPct || 0}%`,
        `⚔️ Matches Played: ${splitStats?.all?.total || 0}`,
        ``,
        `Check out the full stats here:`,
        shareUrl
      ].filter(Boolean).join('\n');

      let file: File | undefined;
      if (player.avatar) {
        try {
          const response = await fetch(player.avatar + '?download=true');
          const blob = await response.blob();
          file = new File([blob], "profile_picture.jpg", { type: blob.type || "image/jpeg" });
        } catch (e) {
          console.error("Failed to fetch avatar for sharing", e);
        }
      }

      if (Capacitor.isNativePlatform()) {
        let localUri = "";
        if (file) {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          await new Promise<void>((resolve) => {
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1];
              const result = await Filesystem.writeFile({
                path: `share_avatar_${Date.now()}.jpg`,
                data: base64data,
                directory: Directory.Cache
              });
              localUri = result.uri;
              resolve();
            };
          });
        }

        await Share.share({
          title: `${player.fullName} - Player Profile`,
          text: shareText,
          url: localUri || shareUrl,
          dialogTitle: 'Share Profile'
        });
      } else {
        // For web on Android: use an intent:// URL so the app opens if installed
        const isAndroid = /android/i.test(navigator.userAgent);
        const playerPath = `/player/${player.id}`;
        // intent:// URL triggers the app; fallback goes to the web URL
        const intentUrl = `intent://${playerPath}#Intent;scheme=iiscshuttlers;package=shuttlers.iisc.com;S.browser_fallback_url=${encodeURIComponent(shareUrl)};end`;
        const deepLinkUrl = isAndroid ? intentUrl : shareUrl;

        const shareData: any = {
          title: `${player.fullName} - Player Profile`,
          text: shareText,
          url: deepLinkUrl,
        };

        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          // Fallback: copy the web URL
          await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          toast.success("Profile info copied to clipboard!");
        }
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const handleReport = () => {
    if (confirm("Report this user for inappropriate content or behavior?")) {
      window.location.href = `mailto:iiscbadmintonclub@gmail.com?subject=Report User ID: ${player?.id}&body=I would like to report the user ${player?.fullName} for the following reason:%0D%0A%0D%0A[Please type your reason here]`;
      toast.success("Opened email client to send report.");
    }
  };

  const handleWrapped = async (year: number) => {
    if (!player) return;
    const currentYear = year;
    const toastId = toast.loading(`Generating your ${currentYear} Wrapped...`);
    try {
      const canvas = await renderWrappedShareCard({
        year: currentYear,
        playerName: player.fullName,
        avatarUrl: player.avatar,
        totalMatches: splitStats?.all?.total || 0,
        winRate: `${splitStats?.all?.winPct || 0}%`,
        biggestRival: bestOpponent?.full_name || "N/A",
        bestStreak: streakStats.max,
        ranking: {
          overall: eloRank?.overall,
          singles: eloRank?.singles,
          doubles: eloRank?.doubles,
          mixed: eloRank?.mixed
        }
      });
      if (!canvas) throw new Error("Failed to render canvas");
      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.split(",")[1];

      toast.dismiss(toastId);

      if (Capacitor.isNativePlatform()) {
        const fileName = `wrapped_${currentYear}_${Date.now()}.png`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });
        
        await Share.share({
          title: `My ${currentYear} Badminton Wrapped`,
          text: `Check out my badminton stats for ${currentYear}!`,
          url: result.uri,
          dialogTitle: 'Share your Wrapped'
        });
      } else {
        const byteString = atob(base64Data);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const file = new File([ab], `wrapped_${currentYear}.png`, { type: "image/png" });

        if (navigator.share) {
          try {
            await navigator.share({
              title: `My ${currentYear} Badminton Wrapped`,
              text: `Check out my badminton stats for ${currentYear}!`,
              files: [file],
            });
          } catch (e) {
            // Fallback if sharing files is unsupported
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = `wrapped_${currentYear}.png`;
            link.click();
            toast.success("Wrapped image downloaded!");
          }
        } else {
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = "wrapped_2024.png";
          link.click();
          toast.success("Wrapped image downloaded!");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate wrapped image", { id: toastId });
    }
  };

  const currentUser = authSession?.user;

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subMins, setSubMins] = useState(15);

  useEffect(() => {
    if (!currentUser?.id || !player?.id) return;
    supabase
      .from("user_player_subscriptions")
      .select("notify_before_mins")
      .eq("user_id", currentUser.id)
      .eq("player_id", player.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsSubscribed(true);
          setSubMins(data.notify_before_mins);
        }
      });
  }, [currentUser?.id, player?.id]);

  if (loading || !player) return <LoadingScreen />;

  return (
    <div id="profile-container" className="min-h-screen bg-slate-50 dark:bg-[#0a1628] selection:bg-amber-500/30 overflow-x-hidden">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70" />
      </div>

      <div className="relative z-10 w-full bg-white dark:bg-[#060d1b]">
        {/* Navigation Bar */}
        <div className="relative z-50 w-full px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => window.history.length > 2 ? window.history.back() : setLocation("/pulse#h2h")}
            className="w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white text-slate-700 dark:bg-black/40 dark:hover:bg-black/60 dark:text-white backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Subscribe & Report — shown to others only */}
            {currentUser && currentUser.id !== player.userId && (
              <>
                <button
                  onClick={() => setSubModalOpen(true)}
                  title={isSubscribed ? `Subscribed (${subMins}m before match)` : "Get notified for player matches"}
                  className={`h-10 md:h-12 px-3 md:px-4 rounded-full flex items-center gap-1.5 font-bold text-xs md:text-sm shadow-sm transition-all border ${
                    isSubscribed
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
                      : "bg-white/90 hover:bg-white text-slate-700 dark:bg-black/40 dark:hover:bg-black/60 dark:text-white border-slate-200 dark:border-white/10"
                  }`}
                >
                  <Bell className="w-4 h-4" fill={isSubscribed ? "currentColor" : "none"} />
                  <span>{isSubscribed ? "Notified" : "Notify Me"}</span>
                </button>

                <NotificationModal
                  isOpen={subModalOpen}
                  onClose={() => setSubModalOpen(false)}
                  title={`Notify for ${player.fullName}'s Matches`}
                  defaultMins={subMins}
                  onSave={async (mins) => {
                    const { error } = await supabase.from("user_player_subscriptions").upsert({
                      user_id: currentUser.id,
                      player_id: player.id,
                      notify_before_mins: mins
                    }, { onConflict: "user_id, player_id" });

                    if (error) {
                      toast.error("Failed to update subscription");
                      return;
                    }
                    setIsSubscribed(true);
                    setSubMins(mins);
                    toast.success(`Subscribed to ${player.fullName}!`);
                  }}
                  isSubscribed={isSubscribed}
                  onRemove={async () => {
                    const { error } = await supabase.from("user_player_subscriptions")
                      .delete()
                      .eq("user_id", currentUser.id)
                      .eq("player_id", player.id);

                    if (error) {
                      toast.error("Failed to remove subscription");
                      return;
                    }
                    setIsSubscribed(false);
                    toast.success(`Unsubscribed from ${player.fullName}'s matches.`);
                  }}
                />

                <button
                  onClick={handleReport}
                  title="Report User"
                  className="w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:bg-black/40 dark:hover:bg-rose-500/80 dark:text-white backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-white/10"
                >
                  <Flag className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </>
            )}

            {/* Share, Wrapped, Export — own profile only */}
            {currentUser && currentUser.id === player.userId && (
              <>
                <button
                  onClick={handleShare}
                  className="w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white text-slate-700 dark:bg-black/40 dark:hover:bg-black/60 dark:text-white backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-white/10"
                >
                  <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-lg text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">{currentYearNow} Wrapped</span>
                      <span className="sm:hidden">Wrapped</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-slate-200 dark:border-slate-800">
                    {wrappedYears.map((year) => (
                      <DropdownMenuItem
                        key={year}
                        onClick={() => handleWrapped(year)}
                        className="font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                        {year} Wrapped
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => exportProfilePdf({
                    playerName: player.fullName,
                    avatarUrl: player.avatar,
                    department: player.department,
                    joinedYear: player.joinedYear,
                    playingLevel: player.playingLevel,
                    favoriteShot: player.favoriteShot,
                    favoriteFormat: player.favoriteFormat,
                    winRate: splitStats?.all?.winPct || 0,
                    totalMatches: splitStats?.all?.total || 0,
                    wins: splitStats?.all?.wins || 0,
                    losses: splitStats?.all?.losses || 0,
                    ranking: {
                      overall: eloRank?.overall,
                      singles: eloRank?.singles,
                      doubles: eloRank?.doubles,
                      mixed: eloRank?.mixed,
                    },
                    instagram: player.social?.instagram,
                  })}
                  className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-white/90 hover:bg-white text-slate-700 dark:bg-black/40 dark:hover:bg-black/60 dark:text-white backdrop-blur-md shadow-sm font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all border border-slate-200 dark:border-white/10 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Export PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </>
            )}
            {currentUser && currentUser.id === player.userId && (
              <Link href="/profile/setup">
                <button className="w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white text-slate-700 dark:bg-black/40 dark:hover:bg-black/60 dark:text-white backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-white/10">
                  <Settings className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </Link>
            )}
            {currentUser && currentUser.id === player.userId && (
              <button
                onClick={() => signOut()}
                className="w-10 h-10 md:w-12 md:h-12 bg-white/90 hover:bg-white text-slate-700 dark:bg-black/40 dark:hover:bg-black/60 dark:text-white backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-slate-200 dark:border-white/10"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <PlayerHeroBanner player={augmentedPlayer || player} eloRank={eloRank?.overall || null} theme={theme} />

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-8 mt-2 md:mt-8">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
            <PlayerActionBar
              player={augmentedPlayer || player}
              currentUser={currentUser}
              ownPlayerProfile={ownPlayerProfile}
              setIsChallengeModalOpen={setIsChallengeModalOpen}
              eloRank={eloRank}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full border-b border-slate-200 dark:border-amber-900/20 bg-white dark:bg-[#0a1628] sticky top-0 z-30 shadow-sm dark:shadow-amber-900/10">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-10">
            <div className="flex flex-wrap items-center gap-2 md:gap-6 w-full md:min-w-max">
              {["OVERVIEW", "RANKING", "STATS", "MATCHES", "PHOTOS"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-auto md:flex-none min-w-[100px] py-3 md:py-4 text-[11px] md:text-sm font-black tracking-widest uppercase transition-colors relative text-center ${
                    activeTab === tab
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground dark:hover:text-slate-300"
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="profileTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 dark:bg-amber-400 rounded-t-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-6 pt-2 pb-24 space-y-6"
      >
        {/* Pending Match Verification Banner */}
        {(activeTab === "MATCHES" || activeTab === "OVERVIEW") &&
          currentUser &&
          currentUser.id === player.userId &&
          pendingMatches.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden mt-8"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />
              <h3 className="text-amber-400 font-black mb-4 flex items-center gap-2 text-sm">
                <Swords className="w-4 h-4" /> Pending Match Verifications (
                {pendingMatches.length})
              </h3>
              <div className="space-y-3">
                {pendingMatches.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-black/25 p-4 rounded-xl border border-amber-500/20"
                  >
                    <div className="text-sm font-semibold text-muted-foreground dark:text-foreground/80 text-center sm:text-left">
                      <span className="font-bold">{m.player1?.full_name}</span>
                      <span className="text-amber-400 font-black italic mx-2">VS</span>
                      <span className="font-bold">{m.player2?.full_name}</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {m.submitted_by === player.id ? (
                        <button
                          onClick={() => handleWithdrawMatch(m.id)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-xl transition"
                        >
                          Withdraw
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleConfirmMatch(m.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-primary hover:bg-primary text-primary-foreground text-xs font-black rounded-xl transition"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleRejectMatch(m.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-white/10 hover:bg-white/20 text-foreground text-xs font-black rounded-xl transition"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        <TeaserOverlay isLocked={!authSession}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
            {/* ── LEFT COLUMN ── */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {activeTab === "OVERVIEW" && (
                <ProfileOverviewTab
                  player={augmentedPlayer || player}
                  splitStats={splitStats}
                  streakStats={streakStats}
                  bestOpponent={bestOpponent}
                  MatchHistorySection={MatchHistorySection}
                  EquipmentArsenalSection={EquipmentArsenalSection}
                  CareerHighlightsSection={CareerHighlightsSection}
                  id={id!}
                  liveMatches={liveMatches}
                  ownPlayerProfile={ownPlayerProfile}
                  handleWithdrawMatch={handleWithdrawMatch}
                  handleConfirmMatch={handleConfirmMatch}
                  handleRejectMatch={handleRejectMatch}
                  handleResendRequest={handleResendRequest}
                />
              )}

              {activeTab === "RANKING" && (
                <ProfileRankingTab
                  player={augmentedPlayer || player}
                  authSession={authSession}
                  liveMatches={liveMatches}
                  HeadToHeadWidget={HeadToHeadWidget}
                  Badges={Badges}
                  id={id!}
                  eloRank={eloRank}
                  eloHistoryData={eloLogs || []}
                />
              )}

              {activeTab === "STATS" && (
                <ProfileStatsTabLeft
                  player={augmentedPlayer || player}
                  liveMatches={liveMatches}
                  allPlayers={allPlayers}
                  id={id!}
                  setLocation={setLocation}
                  AchievementBadges={AchievementBadges}
                  PerformanceTrends={PerformanceTrends}
                  WrappedCard={WrappedCard}
                  PlayerAnalyticsWidget={PlayerAnalyticsWidget}
                  ActivityHeatmap={ActivityHeatmap}
                />
              )}

              {activeTab === "MATCHES" && (
                <MatchHistorySection
                  id={id!}
                  liveMatches={liveMatches}
                  ownPlayerProfile={ownPlayerProfile}
                  handleWithdrawMatch={handleWithdrawMatch}
                  handleConfirmMatch={handleConfirmMatch}
                  handleRejectMatch={handleRejectMatch}
                  handleResendRequest={handleResendRequest}
                />
              )}

              {activeTab === "PHOTOS" && (
                <PlayerPhotosSection playerId={id!} />
              )}
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-5">
              {activeTab === "OVERVIEW" && (
                <ProfileOverviewTabRight
                  player={augmentedPlayer || player}
                  validAchievements={validAchievements}
                  splitStats={splitStats}
                  tournamentRuns={tournamentRuns}
                />
              )}
              {activeTab === "STATS" && (
                <ProfileStatsTabRight 
                  liveMatches={liveMatches}
                  id={id!}
                  allPlayers={allPlayers}
                  DoublesSynergyWidget={DoublesSynergyWidget}
                />
              )}
            </div>
          </div>
        </TeaserOverlay>
      </motion.div>

      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        targetPlayer={player}
        currentUser={ownPlayerProfile}
      />


    </div>
  );
}
