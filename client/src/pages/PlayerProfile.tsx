import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { useHashTab } from "@/hooks/useHashTab";
import { useAuth } from "@/contexts/AuthContext";
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
  const [activeTab, setActiveTab] = useHashTab(["OVERVIEW", "RANKING", "STATS", "MATCHES"] as const, "OVERVIEW");

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
      if (navigator.share) {
        await navigator.share({
          title: `${player.fullName} - Player Profile`,
          text: `Check out ${player.fullName}'s badminton profile!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Profile link copied to clipboard!");
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
      const byteString = atob(dataUrl.split(",")[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const file = new File([ab], "wrapped_2024.png", { type: "image/png" });

      if (navigator.share) {
        toast.dismiss(toastId);
        await navigator.share({
          title: "My 2024 Badminton Wrapped",
          text: "Check out my badminton stats for 2024!",
          files: [file],
        });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "wrapped_2024.png";
        link.click();
        toast.success("Wrapped image downloaded!", { id: toastId });
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
                wins: player.stats?.wins || 0,
                losses: player.stats?.losses || 0,
                avatarUrl: player.avatar,
                recentMatches: []
              })}
              className="px-3 md:px-5 py-2 md:py-2.5 h-10 md:h-12 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-full flex items-center gap-2 transition-all border border-white/20 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            {currentUser && currentUser.id === player.userId && (
              <Link href="/profile/edit">
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
        <PlayerHeroBanner player={player} eloRank={eloRank} theme={theme} />

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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-8 min-w-max">
              {["OVERVIEW", "RANKING", "STATS", "MATCHES"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-4 text-sm font-black tracking-widest uppercase transition-colors relative ${
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
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {activeTab === "OVERVIEW" && (
              <ProfileOverviewTabRight
                player={player}
                validAchievements={validAchievements}
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
