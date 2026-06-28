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
} from "lucide-react";

import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useTournamentMatchHistory } from "@/hooks/useTournamentMatchHistory";
import { useMatchActions } from "@/hooks/useMatchActions";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { MatchHistorySection } from "@/components/player-profile/MatchHistorySection";
import {
  EquipmentArsenalSection,
  CareerHighlightsSection,
} from "@/components/player-profile/PlayerProfileSections";
import { EloAuditModal } from "@/components/player-profile/EloAuditModal";
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

// Extracted Hooks & Components
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
  const [showEloAudit, setShowEloAudit] = useState(false);

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

  const validAchievements = useMemo(() => {
    return player?.achievements?.filter((a: string) => a.trim().length > 0) || [];
  }, [player]);

  const { data: tournamentRuns } = useTournamentMatchHistory(id);

  const { splitStats, streakStats, profileCompleteness } = usePlayerStats(
    (player as any) || null,
    liveMatches,
    validAchievements
  );

  const pendingMatches = useMemo(() => {
    if (!player) return [];
    return liveMatches.filter(
      (m) => m.status === "pending" && isMatchParticipant(m, player.userId)
    );
  }, [liveMatches, player, isMatchParticipant]);

  const handleShare = async () => {
    if (!player) return;
    try {
      const shareUrl = `${getBaseShareUrl()}/player/${player.id}`;
      const shareText = `🏸 ${player.fullName}'s Badminton Profile\n🏆 ELO Rating: ${player.elo_rating || 1200}\n📈 Win Rate: ${splitStats?.all?.winPct || 0}%\n⚔️ Matches Played: ${splitStats?.all?.total || 0}\n\nCheck out the full stats here:\n${shareUrl}`;

      let file: File | undefined;
      if (player.avatar) {
        try {
          // Add cache-busting to bypass CORS issues if any, though Supabase storage usually has CORS enabled
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
        const shareData: any = {
          title: `${player.fullName} - Player Profile`,
          text: shareText,
        };

        // NOTE: We intentionally do NOT include `files` here for the Web fallback. 
        // The Web Share API is notoriously buggy across different OS/Browser combinations. 
        // If `files` is included, many share targets (like WhatsApp on Windows/Android) 
        // will completely drop the `text` and `url` and ONLY share the image.
        
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareText);
          toast.success("Profile info copied to clipboard!");
        }
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const handleWrapped = async () => {
    if (!player) return;
    const toastId = toast.loading("Generating your 2024 Wrapped...");
    try {
      const canvas = await renderWrappedShareCard({
        playerName: player.fullName,
        avatarUrl: player.avatar,
        totalMatches: splitStats?.all?.total || 0,
        winRate: `${splitStats?.all?.winPct || 0}%`,
        biggestRival: bestOpponent?.full_name || "N/A",
        bestStreak: streakStats.max,
        highestElo: player.elo_rating || 1200
      });
      if (!canvas) throw new Error("Failed to render canvas");
      const dataUrl = canvas.toDataURL("image/png");
      const base64Data = dataUrl.split(",")[1];

      toast.dismiss(toastId);

      if (Capacitor.isNativePlatform()) {
        const fileName = `wrapped_2024_${Date.now()}.png`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });
        
        await Share.share({
          title: "My 2024 Badminton Wrapped",
          text: "Check out my badminton stats for 2024!",
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
        const file = new File([ab], "wrapped_2024.png", { type: "image/png" });

        if (navigator.share) {
          try {
            await navigator.share({
              title: "My 2024 Badminton Wrapped",
              text: "Check out my badminton stats for 2024!",
              files: [file],
            });
          } catch (e) {
            // Fallback if sharing files is unsupported
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = "wrapped_2024.png";
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

  if (loading || !player) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628] selection:bg-amber-500/30 overflow-x-hidden">
      {/* Background patterns */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-70" />
      </div>

      <div className="relative z-10 w-full bg-white dark:bg-[#060d1b]">
        {/* Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <button className="w-10 h-10 md:w-12 md:h-12 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all">
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={handleShare}
              className="w-10 h-10 md:w-12 md:h-12 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all"
            >
              <Share2 className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={handleWrapped}
              className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all border border-white/20 hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">2024 Wrapped</span>
              <span className="sm:hidden">Wrapped</span>
            </button>
            <button
              onClick={() => exportProfilePdf({
                name: player.fullName,
                elo: player.elo_rating || 1200,
                wins: splitStats?.all?.wins || 0,
                losses: splitStats?.all?.losses || 0,
                rank: eloRank?.overall,
                streak: streakStats?.max || 0,
                avatarUrl: player.avatar,
                recentMatches: (liveMatches || []).slice(0, 15).map((m: any) => {
                  const isTeam1 = m.player1?.id === player.id || m.partner1?.id === player.id;
                  
                  let me, partner, opponents: any[] = [];
                  if (isTeam1) {
                    me = m.player1?.id === player.id ? m.player1 : m.partner1;
                    partner = m.player1?.id === player.id ? m.partner1 : m.player1;
                    if (m.player2) opponents.push(m.player2);
                    if (m.partner2) opponents.push(m.partner2);
                  } else {
                    me = m.player2?.id === player.id ? m.player2 : m.partner2;
                    partner = m.player2?.id === player.id ? m.partner2 : m.player2;
                    if (m.player1) opponents.push(m.player1);
                    if (m.partner1) opponents.push(m.partner1);
                  }

                  let formatLabel = "S";
                  const allGenders = [me?.gender, partner?.gender, ...opponents.map(o => o?.gender)]
                    .map(g => (g || '').toLowerCase())
                    .filter(Boolean);
                    
                  if (partner || opponents.length > 1) {
                    const hasMale = allGenders.includes('male');
                    const hasFemale = allGenders.includes('female');
                    if (hasMale && hasFemale) formatLabel = "XD";
                    else if (hasFemale) formatLabel = "WD";
                    else formatLabel = "MD";
                  } else {
                    if (me?.gender?.toLowerCase() === 'female' || opponents[0]?.gender?.toLowerCase() === 'female') {
                      formatLabel = "WS";
                    } else {
                      formatLabel = "MS";
                    }
                  }

                  let displayScore = m.score || m.match_score || "";
                  if (displayScore.includes(" | ")) displayScore = displayScore.split(" | ")[0];
                  displayScore = displayScore.replace(/\s*\[.*$/, "").trim();

                  const getFirstName = (p: any) => p?.full_name?.split(" ")[0] || "";
                  const opponentStr = opponents.map(getFirstName).filter(Boolean).join(" & ");

                  const isTeam1Winner = m.winner_id === m.player1_id || (m.team1_partner_id && m.winner_id === m.team1_partner_id);
                  const won = isTeam1 ? isTeam1Winner : !isTeam1Winner;

                  return {
                    date: m.date_played || m.created_at || new Date().toISOString(),
                    opponent: opponentStr,
                    partner: partner ? getFirstName(partner) : undefined,
                    score: displayScore,
                    result: won ? "W" : "L",
                    format: formatLabel
                  };
                })
              })}
              className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all border border-white/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            {currentUser && currentUser.id === player.userId && (
              <Link href="/profile/setup">
                <button className="w-10 h-10 md:w-12 md:h-12 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all">
                  <Settings className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </Link>
            )}
            {currentUser && currentUser.id === player.userId && (
              <button
                onClick={() => signOut()}
                className="w-10 h-10 md:w-12 md:h-12 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Hero Section */}
        <PlayerHeroBanner player={player} eloRank={eloRank?.overall || null} theme={theme} />

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-8 mt-2 md:mt-8">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
            <PlayerActionBar
              player={player}
              currentUser={currentUser}
              ownPlayerProfile={ownPlayerProfile}
              setIsChallengeModalOpen={setIsChallengeModalOpen}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full border-b border-slate-200 dark:border-amber-900/20 bg-white dark:bg-[#0a1628] sticky top-0 z-30 shadow-sm dark:shadow-amber-900/10">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-10">
            <div className="grid grid-cols-2 md:flex md:items-center gap-x-2 md:gap-8 w-full md:min-w-max">
              {["OVERVIEW", "RANKING", "STATS", "MATCHES", "PHOTOS"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-3 md:py-4 text-xs md:text-sm font-black tracking-widest uppercase transition-colors relative ${
                    activeTab === tab
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
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
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-24 space-y-8"
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
                    <div className="text-sm font-semibold text-slate-700 dark:text-white/80 text-center sm:text-left">
                      <span className="font-bold">{m.player1?.full_name}</span>
                      <span className="text-amber-400 font-black italic mx-2">VS</span>
                      <span className="font-bold">{m.player2?.full_name}</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleConfirmMatch(m.id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => handleRejectMatch(m.id)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl transition"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {activeTab === "OVERVIEW" && (
              <ProfileOverviewTab
                player={player}
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
                player={player}
                authSession={authSession}
                liveMatches={liveMatches}
                eloHistoryData={eloHistoryData}
                eloChartFilter={eloChartFilter}
                setEloChartFilter={setEloChartFilter}
                setShowEloAudit={setShowEloAudit}
                HeadToHeadWidget={HeadToHeadWidget}
                Badges={Badges}
                id={id!}
                eloRank={eloRank}
              />
            )}

            {activeTab === "STATS" && (
              <ProfileStatsTabLeft
                player={player}
                liveMatches={liveMatches}
                allPlayers={allPlayers}
                id={id!}
                setLocation={setLocation}
                DoublesSynergyWidget={DoublesSynergyWidget}
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
                player={player}
                validAchievements={validAchievements}
                splitStats={splitStats}
                tournamentRuns={tournamentRuns}
              />
            )}
            {activeTab === "STATS" && (
              <ProfileStatsTabRight player={player} setLocation={setLocation} />
            )}
          </div>
        </div>
      </motion.div>

      <ChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        targetPlayer={player}
        currentUser={ownPlayerProfile}
      />

      <EloAuditModal
        isOpen={showEloAudit}
        onClose={() => setShowEloAudit(false)}
        playerId={id!}
        matches={liveMatches}
      />
    </div>
  );
}
