import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { useHashTab } from "@/hooks/useHashTab";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
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
  Footprints,
  Flag,
  Bell,
  ActivitySquare,
} from "lucide-react";
import { NotificationModal } from "@/components/events/NotificationModal";
import { getPlayerSubscription, subscribeToPlayer, unsubscribeFromPlayer } from "@/services/playerService";

import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useTournamentMatchHistory } from "@/hooks/useTournamentMatchHistory";
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
import { OfficiatingRecord } from "@/components/player-profile/OfficiatingRecord";
import { WrappedCard } from "@/components/player-profile/WrappedCard";
import { PerformanceTrends } from "@/components/player-profile/PerformanceTrends";
import { PlayerAnalyticsWidget } from "@/components/player-profile/PlayerAnalyticsWidget";
import { ActivityHeatmap } from "@/components/player-profile/PlayerProfileWidgets";
import { DoublesSynergyWidget } from "@/components/player-profile/PlayerProfileWidgets";
import { Badges } from "@/components/player-profile/PlayerProfileWidgets";
import { PlayerPhotosSection } from "@/components/player-profile/PlayerPhotosSection";

import { useTheme } from "@/contexts/ThemeContext";
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
import { ReportPlayerModal } from "@/components/ReportPlayerModal";
import { track } from "@/lib/analytics";
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
import { useQuery } from "@tanstack/react-query";
import { resolvePlayerAlias } from "@/services/identityService";
import { ClaimRecordCard } from "@/components/player-profile/ClaimRecordCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { session: authSession, signOut } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const { confirm } = useConfirm();
  const { theme } = useTheme();

  // Load active tab from hash
  const [activeTab, setActiveTab] = useHashTab(["OVERVIEW", "RANKING", "STATS", "MATCHES", "PHOTOS"] as const, "OVERVIEW");

  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);


  // Own player profile
  const [ownPlayerProfile, setOwnPlayerProfile] = useState<PlayerRow | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([]);

  // Load user profile and players
  useEffect(() => {
    async function loadOwnProfile() {
      if (authSession?.user?.id) {
        try {
          const profile = await fetchPlayer(authSession.user.id);
          setOwnPlayerProfile(profile);
        } catch (err) {
          import('@sentry/react').then(({ captureException }) => captureException(err));
        }
      }
    }
    loadOwnProfile();
  }, [authSession?.user?.id]);

  useEffect(() => {
    fetchPlayerList().then(setAllPlayers).catch(() => {});
  }, []);

  // Use Custom Hooks
  const { player, loading, eloRank, liveMatches, eloLogs } =
    usePlayerProfileQuery(id, ownPlayerProfile?.id);

  const {
    recentOpponents,
    bestOpponent,
  } = useProfileAnalytics(id, player, liveMatches, eloLogs, ownPlayerProfile);

  const { archivedTournaments } = useArchivedTournaments();

  const dynamicTournamentData = useMemo(() => {
    if (!player) return { achievements: [], tournaments: [] };

    const achievements: string[] = [];
    const tournaments = new Set<string>();

    const isPlayerInString = (str?: string) => {
      if (!str) return false;
      const cleanStr = str.toLowerCase().replace(/\(.*?\)/g, "").trim();
      const playerName = (player.full_name || "").toLowerCase();
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
    const manualTournaments = player.tournament_history || [];
    const combinedTourneys = Array.from(new Set([...manualTournaments, ...dynamicTournamentData.tournaments]));
    return {
      ...player,
      tournament_history: combinedTourneys
    };
  }, [player, dynamicTournamentData]);

  const { data: tournamentRuns } = useTournamentMatchHistory(id);

  const { splitStats, streakStats, profileCompleteness } = usePlayerStats(
    player || null,
    liveMatches,
    validAchievements,
    tournamentRuns || undefined
  );

  const currentYearNow = new Date().getFullYear();
  const profileYear = player?.joined_year || (player?.created_at ? new Date(player.created_at).getFullYear() : currentYearNow);
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
        `🏸 ${player.full_name}'s Badminton Profile`,
        rankLine,
        `📈 Win Rate: ${splitStats?.all?.winPct || 0}%`,
        `⚔️ Matches Played: ${splitStats?.all?.total || 0}`,
        ``,
        `Check out the full stats here:`,
        shareUrl
      ].filter(Boolean).join('\n');

      let file: File | undefined;
      if (player.avatar_url) {
        try {
          const response = await fetch(player.avatar_url + '?download=true');
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
          title: `${player.full_name} - Player Profile`,
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
          title: `${player.full_name} - Player Profile`,
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

  const handleReport = () => setReportOpen(true);

  const handleWrapped = async (year: number) => {
    if (!player) return;
    const currentYear = year;
    const toastId = toast.loading(`Generating your ${currentYear} Wrapped...`);
    try {
      const canvas = await renderWrappedShareCard({
        year: currentYear,
        playerName: player.full_name,
        avatarUrl: player.avatar_url,
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
    getPlayerSubscription(currentUser.id, player.id)
      .then((data) => {
        if (data) {
          setIsSubscribed(true);
          setSubMins(data.notify_before_mins);
        }
      })
      .catch((err) => console.error("Failed to load subscription:", err));
  }, [currentUser?.id, player?.id]);

  if (loading) return <LoadingScreen />;
  if (!player) return <MissingPlayer id={id} onFound={(newId) => setLocation(`/player/${newId}${window.location.hash}`, { replace: true })} />;

  return (
    <div id="profile-container" className="min-h-screen bg-background selection:bg-warning/30 overflow-x-hidden">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-info/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70" />
      </div>

      <div className="relative z-10 w-full bg-background">
        {/* Navigation Bar */}
        <div className="relative z-50 w-full px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => window.history.length > 2 ? window.history.back() : setLocation("/pulse#h2h")}
            className="w-10 h-10 md:w-12 md:h-12 bg-media/40 hover:bg-media/60 text-on-media backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-foreground/10"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Subscribe & Report — shown to others only */}
            {currentUser && currentUser.id !== player.id && (
              <>
                <button
                  onClick={() => setSubModalOpen(true)}
                  title={isSubscribed ? `Subscribed (${subMins}m before match)` : "Get notified for player matches"}
                  className={`h-10 md:h-12 px-3 md:px-4 rounded-full flex items-center gap-1.5 font-bold text-xs md:text-sm shadow-sm transition-all border ${
                    isSubscribed
                      ? "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
                      : "bg-media/40 hover:bg-media/60 text-on-media border-foreground/10"
                  }`}
                >
                  <Bell className="w-4 h-4" fill={isSubscribed ? "currentColor" : "none"} />
                  <span>{isSubscribed ? "Notified" : "Notify Me"}</span>
                </button>

                <NotificationModal
                  isOpen={subModalOpen}
                  onClose={() => setSubModalOpen(false)}
                  title={`Notify for ${player.full_name}'s Matches`}
                  defaultMins={subMins}
                  onSave={async (mins) => {
                    try {
                      await subscribeToPlayer(currentUser.id, player.id, mins);
                      setIsSubscribed(true);
                      setSubMins(mins);
                      track("player_subscribed", { mins });
                      toast.success(`Subscribed to ${player.full_name}!`);
                    } catch {
                      toast.error("Failed to update subscription");
                    }
                  }}
                  isSubscribed={isSubscribed}
                  onRemove={async () => {
                    try {
                      await unsubscribeFromPlayer(currentUser.id, player.id);
                      setIsSubscribed(false);
                      track("player_unsubscribed");
                      toast.success(`Unsubscribed from ${player.full_name}'s matches.`);
                    } catch {
                      toast.error("Failed to remove subscription");
                    }
                  }}
                />

                <button
                  onClick={handleReport}
                  title="Report User"
                  className="w-10 h-10 md:w-12 md:h-12 bg-media/40 hover:bg-danger/80 hover:text-danger text-on-media backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-foreground/10"
                >
                  <Flag className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </>
            )}

            {/* Share, Wrapped, Export — own profile only */}
            {currentUser && currentUser.id === player.id && (
              <>
                <button aria-label="Share profile"
                  onClick={handleShare}
                  className="w-10 h-10 md:w-12 md:h-12 bg-media/40 hover:bg-media/60 text-on-media backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-foreground/10"
                >
                  <Share2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-gradient-to-r from-warning to-secondary hover:from-warning/90 hover:to-secondary/90 shadow-lg text-on-accent font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">{currentYearNow} Wrapped</span>
                      <span className="sm:hidden">Wrapped</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-md border-border">
                    {wrappedYears.map((year) => (
                      <DropdownMenuItem
                        key={year}
                        onClick={() => handleWrapped(year)}
                        className="font-bold text-soft cursor-pointer hover:bg-muted"
                      >
                        <Sparkles className="w-4 h-4 mr-2 text-warning" />
                        {year} Wrapped
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => exportProfilePdf({
                    playerName: player.full_name,
                    avatarUrl: player.avatar_url,
                    department: player.department,
                    joinedYear: player.joined_year || 0,
                    playingLevel: player.playing_level,
                    favoriteShot: player.favorite_shot || "",
                    favoriteFormat: player.favorite_format || "",
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
                    instagram: player.instagram || undefined,
                  })}
                  className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-media/40 hover:bg-media/60 text-on-media backdrop-blur-md shadow-sm font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all border border-foreground/10 whitespace-nowrap"
                >
                  <span className="hidden sm:inline">Export PDF</span>
                  <span className="sm:hidden">PDF</span>
                </button>
              </>
            )}
            {currentUser && currentUser.id === player.id && (
              <>
                <Link href={`/player/${player.id}/personal`}>
                  <button
                    className="px-3 md:px-4 py-2 md:py-2.5 h-10 md:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-1.5 transition-all shadow-md active:scale-95 whitespace-nowrap"
                    title="Switch to Personal Training & Analytics Dashboard"
                  >
                    <ActivitySquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Personal Space</span>
                    <span className="sm:hidden">Space</span>
                  </button>
                </Link>
                <Link href="/profile/setup">
                  <button className="w-10 h-10 md:w-12 md:h-12 bg-media/40 hover:bg-media/60 text-on-media backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-foreground/10" title="Profile Settings">
                    <Settings className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </Link>
              </>
            )}
            {currentUser && currentUser.id === player.id && (
              <button
                onClick={() => signOut()}
                className="w-10 h-10 md:w-12 md:h-12 bg-media/40 hover:bg-media/60 text-on-media backdrop-blur-md shadow-sm rounded-full flex items-center justify-center transition-all border border-foreground/10"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <PlayerHeroBanner player={augmentedPlayer || player} eloRank={eloRank?.overall || null} theme={theme} />

        {/* Below the hero: its background layer would otherwise cover the card. */}
        {player.is_guest && currentUser && ownPlayerProfile && !ownPlayerProfile.is_guest && ownPlayerProfile.id !== player.id && (
          <div className="relative z-10">
            <ClaimRecordCard guestId={player.id} guestName={player.full_name || "Guest"} requesterId={ownPlayerProfile.id} />
          </div>
        )}

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
        <div className="w-full border-b border-warning/10 bg-background sticky top-0 z-30 shadow-sm shadow-warning/10">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-10">
            <div className="flex flex-wrap items-center gap-2 md:gap-6 w-full md:min-w-max">
              {[
                "OVERVIEW",
                "RANKING",
                "STATS",
                "MATCHES",
                "PHOTOS",
                ...(currentUser && currentUser.id === player.id ? ["TRAINING"] : [])
              ].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    if (tab === "TRAINING") {
                      setLocation(`/player/${player.id}/personal`);
                    } else {
                      setActiveTab(tab as any);
                    }
                  }}
                  className={`flex-auto md:flex-none min-w-[100px] py-3 md:py-4 text-[11px] md:text-sm font-black tracking-widest uppercase transition-colors relative text-center ${
                    activeTab === tab
                      ? "text-warning"
                      : "text-muted-foreground hover:text-soft"
                  }`}
                >
                  {tab === "TRAINING" ? "⚡ TRAINING" : tab}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="profileTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-warning rounded-t-full"
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
              {activeTab === "OVERVIEW" && (player?.id || id) && <OfficiatingRecord playerId={(player?.id || id)!} />}
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

      {player && (
        <ReportPlayerModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          reportedPlayerId={player.id}
          reportedPlayerName={player.full_name}
          reporterId={authSession?.user?.id}
        />
      )}

    </div>
  );
}

/**
 * A player ID that no longer exists: follow a merge alias (saved links to a
 * merged guest record keep working), otherwise say it was not found.
 */
function MissingPlayer({ id, onFound }: { id: string | undefined; onFound: (id: string) => void }) {
  const alias = useQuery({
    queryKey: ["player_aliases", id],
    queryFn: () => (id ? resolvePlayerAlias(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (alias.data) onFound(alias.data);
  }, [alias.data, onFound]);
  if (alias.isPending || alias.data) return <LoadingScreen />;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-black mb-2">Player not found</h1>
        <p className="text-muted-foreground mb-4">This profile doesn't exist or has been removed.</p>
        <Link href="/" className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground font-bold">Go home</Link>
      </div>
    </div>
  );
}
