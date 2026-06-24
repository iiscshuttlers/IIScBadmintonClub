import { useParams, useLocation, Link } from "wouter";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useHashTab } from "@/hooks/useHashTab";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence, useSpring, useTransform, type Variants } from "framer-motion";
import {
  Trophy,
  User,
  Activity,
  MapPin,
  Calendar,
  Swords,
  Zap,
  Target,
  Dna,
  Crosshair,
  Sparkles,
  Quote,
  Medal,
  ArrowLeft,
  TrendingUp,
  Award,
  Flame,
  BarChart3,
  Share2,
  Trash2,
  Instagram,
  Mail,
  Users,
  Star,
  Hash,
  Ruler,
  BookOpen,
  ChevronRight,
  Footprints,
  Shirt,
  ArrowUpRight,
  Clock,
  LogOut,
  CheckCircle,
  XCircle,
  Play,
  Image,
  Video,
  UserPlus,
  UserCheck,
  UserMinus,
  Heart,
  Sun,
  Moon,
  FileDown,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useMatchActions } from "@/hooks/useMatchActions";
import { isMasterAdminEmail as isAdminEmail } from "@/lib/admin";
import { MatchHistorySection } from "@/components/player-profile/MatchHistorySection";
import {
  EquipmentArsenalSection,
  CareerHighlightsSection,
} from "@/components/player-profile/PlayerProfileSections";
import { EloAuditModal } from "@/components/player-profile/EloAuditModal";
import {
  LoadingScreen,
  FormPill,
  CircularProgress,
  KPI,
  CategoryBar,
  Badges,
  ActivityHeatmap,
  DoublesSynergyWidget,
} from "@/components/player-profile/PlayerProfileWidgets";
import { HeadToHeadWidget } from "@/components/player-profile/HeadToHeadWidget";
import { PlayerAnalyticsWidget } from "@/components/player-profile/PlayerAnalyticsWidget";
import { AchievementBadges } from "@/components/player-profile/AchievementBadges";
import { WrappedCard } from "@/components/player-profile/WrappedCard";
import { PerformanceTrends } from "@/components/player-profile/PerformanceTrends";
import { exportProfilePdf } from "@/lib/exportProfilePdf";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { toast } from "sonner";
import { QuickSettingsContent } from "@/components/QuickSettings";
import { useTheme } from "@/contexts/ThemeContext";
import { getEloTier } from "@/lib/tiers";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { ChallengeModal } from "@/components/ChallengeModal";
import confetti from "canvas-confetti";
import { cn, getBaseShareUrl } from "@/lib/utils";
import { renderWrappedShareCard } from "@/lib/wrappedShareCard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MatchResult = "W" | "L";

interface RecentMatch {
  date: string;
  tournament: string;
  category: string;
  round: string;
  opponent: string;
  partner?: string;
  score: string;
  result: MatchResult;
}

interface CategoryStat {
  wins: number;
  losses: number;
}

interface PlayerStats {
  totalMatches?: number;
  wins?: number;
  losses?: number;
  winPercentage?: number;
  titlesWon?: number;
  runnerUp?: number;
  semifinals?: number;
  currentStreak?: string;
  longestWinStreak?: number;
  categoryStats?: {
    singles?: CategoryStat;
    doubles?: CategoryStat;
    mixed?: CategoryStat;
  };
  media?: { type: string; url: string; caption?: string }[];
}

interface CareerHighlight {
  year: number;
  title: string;
  description?: string;
}
interface Partner {
  name: string;
  id?: string;
  matchesTogether?: number;
  winRate?: number;
}
interface Social {
  instagram?: string;
  email?: string;
}

interface Player {
  id: string;
  fullName: string;
  nickname?: string;
  avatar: string;
  department: string;
  joinedYear: number;
  playingLevel: string;
  dominantHand: string;
  playingStyle: string;
  gender?: string;
  favoriteShot: string;
  favoriteIdol: string;
  favoriteFormat: string;
  quote?: string;
  currentRacket: string;
  racketDetails: { name: string; string: string; tension: string }[];
  tournamentHistory: string[];
  achievements: string[];
  winLossRecord: string;

  // New optional fields
  nationality?: string;
  homeState?: string;
  height?: string;
  yearsPlaying?: number;
  coach?: string;
  bio?: string;
  currentRanking?: number;
  highestRanking?: number;
  stats?: PlayerStats;
  recentForm?: MatchResult[];
  recentMatches?: RecentMatch[];
  frequentPartners?: Partner[];
  careerHighlights?: CareerHighlight[];
  shoes?: string;
  shoesList?: { name: string; primary: boolean }[];
  apparel?: string;
  social?: Social;
  userId?: string;
  elo_rating?: number;
  singles_elo?: number;
  doubles_elo?: number;
  mixed_elo?: number;
  isApproved?: boolean;
  role?: 'master_admin' | 'admin' | 'umpire' | 'player';
  buddies?: string[];
  buddyRequests?: string[];
  singles_record?: string;
  doubles_record?: string;
  mixed_record?: string;
}

const MATCH_SELECT =
  "*, player1:players!player1_id(id, full_name, avatar_url), player2:players!player2_id(id, full_name, avatar_url), partner1:players!team1_partner_id(id, full_name, avatar_url), partner2:players!team2_partner_id(id, full_name, avatar_url)";

function matchParticipantIds(match: any): string[] {
  return [
    match.player1_id,
    match.player2_id,
    match.team1_partner_id,
    match.team2_partner_id,
  ].filter(Boolean);
}

function isMatchParticipant(match: any, playerId?: string | null): boolean {
  return !!playerId && matchParticipantIds(match).includes(playerId);
}

function visibleMatchesForViewer(
  matches: any[],
  viewerPlayerId?: string | null,
): any[] {
  return matches.filter(
    (match) =>
      match.status === "confirmed" || isMatchParticipant(match, viewerPlayerId),
  );
}

async function fetchProfileMatches(profileId: string, signal?: AbortSignal) {
  const runQuery = (participantFilter: string) => {
    const query = supabase
      .from("matches")
      .select(MATCH_SELECT)
      .in("status", ["confirmed", "pending"])
      .or(participantFilter)
      .order("created_at", { ascending: false })
      .limit(50);

    return signal ? query : query;
  };

  const fullParticipantFilter = `player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`;
  const legacyParticipantFilter = `player1_id.eq.${profileId},player2_id.eq.${profileId}`;

  const fullRes = await runQuery(fullParticipantFilter);
  if (!fullRes.error) return fullRes;

  if (signal?.aborted || fullRes.error?.message?.includes("aborted")) {
    return fullRes;
  }

  console.warn(
    "Falling back to legacy match participant query:",
    fullRes.error.message,
  );
  return runQuery(legacyParticipantFilter);
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function getYouTubeId(url: string) {
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function AnimatedCounter({ value, className }: { value: number, className?: string }) {
  const spring = useSpring(0, { duration: 1500, bounce: 0 });

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const display = useTransform(spring, (current) => Math.round(current));

  return <motion.span className={className}>{display}</motion.span>;
}

export default function PlayerProfile({
  matchesOnly,
  params,
}: { matchesOnly?: boolean; params?: any } = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const {
    session: authSession,
    user: currentUser,
    profile: ownPlayerProfile,
    isAdmin,
    isMainAdmin,
    updateRole,
    refreshProfile,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();

  // If we're in matchesOnly mode and no routeId is provided, use the logged-in user's profile ID
  const rawId = routeId || (matchesOnly ? ownPlayerProfile?.id : undefined);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isSlug = rawId && !UUID_RE.test(rawId);

  // Resolve legacy slug → UUID by matching against full_name, then redirect
  useEffect(() => {
    if (!isSlug || !rawId) return;
    const namePattern = rawId.replace(/-/g, " ");
    supabase
      .from("players")
      .select("id")
      .ilike("full_name", namePattern)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setLocation(`/player/${data.id}`, { replace: true });
      });
  }, [rawId, isSlug]);

  const id = isSlug ? undefined : rawId;

  const [player, setPlayer] = useState<Player | null>(null);
  

  const isUnranked = false;

  const [loading, setLoading] = useState(true);
  const [showEloAudit, setShowEloAudit] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [eloRank, setEloRank] = useState<number | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [rawMatches, setRawMatches] = useState<any[]>([]);
  const [eloLogs, setEloLogs] = useState<any[]>([]);
  const [h2hRecord, setH2hRecord] = useState<{
    wins: number;
    losses: number;
  } | null>(null);
  const [allPlayers, setAllPlayers] = useState<
    { id: string; full_name: string; avatar_url?: string; gender?: string }[]
  >([]);

  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [matchHistoryFilter, setMatchHistoryFilter] = useState<
    "all" | "friendly" | "tournament"
  >("all");
  const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);
  const [eloChartFilter, setEloChartFilter] = useState<"ALL" | "S" | "D" | "XD">("ALL");
  const [activeTab, setActiveTab] = useHashTab(
    ["OVERVIEW", "RANKING", "STATS", "MATCHES"] as const,
    "OVERVIEW"
  );
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBuddy, setIsBuddy] = useState(false);
  const [hasSentRequest, setHasSentRequest] = useState(false);
  const [hasReceivedRequest, setHasReceivedRequest] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const [introPhase, setIntroPhase] = useState(0);
  const profileLoadRetried = useRef(false);
  const validAchievements = useMemo(
    () =>
      player ? player.achievements.filter((a) => a && a.trim() !== "") : [],
    [player],
  );

  const {
    profileCompleteness,
    dynamicBadges,
    winPct,
    totalMatches,
    splitStats,
    streakStats,
    totalPlayedGames
  } = usePlayerStats(player as any as import("@/types").PlayerRow, liveMatches, validAchievements);

  const {
    handleConfirmMatch,
    handleRejectMatch,
    handleResendRequest,
    handleWithdrawMatch
  } = useMatchActions(ownPlayerProfile, refreshProfile, () => {}, pendingMatches);


  useEffect(() => {
    if (ownPlayerProfile && player?.id) {
      // Check buddy status from buddy_requests table
      checkBuddyStatus();
      // Check following status
      setIsFollowing(ownPlayerProfile.following?.includes(player.id) || false);
    }
  }, [ownPlayerProfile, player]);

  const checkBuddyStatus = async () => {
    if (!ownPlayerProfile?.id || !player?.id) return;

    try {
      const { data } = await supabase
        .from("buddy_requests")
        .select("id, status, sender_id")
        .or(`and(sender_id.eq.${ownPlayerProfile.id},receiver_id.eq.${player.id}),and(sender_id.eq.${player.id},receiver_id.eq.${ownPlayerProfile.id})`)
        .maybeSingle();

      if (data) {
        if (data.status === "accepted") {
          setIsBuddy(true);
          setHasSentRequest(false);
          setHasReceivedRequest(false);
        } else if (data.sender_id === ownPlayerProfile.id) {
          setIsBuddy(false);
          setHasSentRequest(true);
          setHasReceivedRequest(false);
        } else {
          setIsBuddy(false);
          setHasSentRequest(false);
          setHasReceivedRequest(true);
        }
      } else {
        setIsBuddy(false);
        setHasSentRequest(false);
        setHasReceivedRequest(false);
      }
    } catch (err) {
      console.error("Error checking buddy status:", err);
    }
  };

  // Sports broadcast intro sequence — plays every time a profile is opened
  useEffect(() => {
    if (!player) return;
    setIntroPhase(0);
    const timers = [
      setTimeout(() => setIntroPhase(1), 150),   // spotlight + left section slides in
      setTimeout(() => setIntroPhase(2), 340),   // photo slams up
      setTimeout(() => setIntroPhase(3), 720),   // first name letters
      setTimeout(() => setIntroPhase(4), 960),   // last name letters + nickname
      setTimeout(() => setIntroPhase(5), 1320),  // stats strip + form + CTAs
    ];
    return () => timers.forEach(clearTimeout);
  }, [player?.id]);

  const handleToggleFollow = async () => {
    if (!player?.id || !currentUser?.id) return;
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);
    try {
      const { data: myProfile, error: fetchErr } = await supabase
        .from("players")
        .select("following")
        .eq("id", currentUser.id)
        .single();
      if (fetchErr) throw fetchErr;
      let arr: string[] = myProfile?.following || [];
      arr = newFollowing
        ? [...new Set([...arr, player.id])]
        : arr.filter((s) => s !== player.id);
      const { error: updateErr } = await supabase
        .from("players")
        .update({ following: arr })
        .eq("id", currentUser.id);
      if (updateErr) throw updateErr;
      await refreshProfile();
      toast.success(
        newFollowing
          ? `Following ${player.fullName}!`
          : `Unfollowed ${player.fullName}.`,
      );
    } catch (e) {
      console.error("Follow toggle failed:", e);
      setIsFollowing(!newFollowing);
      toast.error("Could not update follow status. Try again.");
    }
  };

  const handleBuddyAction = async (action: 'send' | 'cancel' | 'accept' | 'remove') => {
    if (!player?.id || !ownPlayerProfile?.id) return;

    try {
      if (action === 'send') {
        setHasSentRequest(true);
        const { error } = await supabase.from('buddy_requests').insert({
          sender_id: ownPlayerProfile.id,
          receiver_id: player.id,
        });
        if (error) throw error;
        toast.success(`Buddy request sent to ${player.fullName}!`);
      }
      else if (action === 'cancel') {
        setHasSentRequest(false);
        const { error } = await supabase
          .from('buddy_requests')
          .delete()
          .eq('sender_id', ownPlayerProfile.id)
          .eq('receiver_id', player.id);
        if (error) throw error;
        toast.success(`Buddy request cancelled.`);
      }
      else if (action === 'accept') {
        setIsBuddy(true);
        setHasReceivedRequest(false);

        // Find the request and mark as accepted
        const { data: request, error: findErr } = await supabase
          .from('buddy_requests')
          .select('id')
          .eq('sender_id', player.id)
          .eq('receiver_id', ownPlayerProfile.id)
          .single();
        if (findErr) throw findErr;

        const { error: updateErr } = await supabase
          .from('buddy_requests')
          .update({ status: 'accepted' })
          .eq('id', request.id);
        if (updateErr) throw updateErr;

        toast.success(`You and ${player.fullName} are now buddies!`);

        // Trigger push notification to the sender
        await supabase.from("site_data").upsert({
          key: "latest_buddy_acceptance",
          value: {
            accepterId: ownPlayerProfile.id,
            accepterName: ownPlayerProfile.full_name,
            senderId: player.id,
            timestamp: Date.now()
          }
        }, { onConflict: "key" });
      }
      else if (action === 'remove') {
        setIsBuddy(false);
        // Delete the buddy request record
        const { error } = await supabase
          .from('buddy_requests')
          .delete()
          .or(`and(sender_id.eq.${ownPlayerProfile.id},receiver_id.eq.${player.id}),and(sender_id.eq.${player.id},receiver_id.eq.${ownPlayerProfile.id})`);
        if (error) throw error;
        toast.success(`Removed ${player.fullName} from Buddies.`);
      }
      await refreshProfile();
    } catch (e) {
      console.error("Buddy action failed:", e);
      toast.error("Could not complete action. Try again.");
      await refreshProfile();
    }
  };

  /* ── Shared helper: map DB row → Player interface ──────────────── */
  function formatPlayerData(data: any): Player {
    const parseShoesList = (shoes: string | null) => {
      if (!shoes) return [];
      try {
        if (shoes.startsWith("[")) return JSON.parse(shoes);
        return [{ name: shoes, primary: true }];
      } catch {
        return [{ name: shoes, primary: true }];
      }
    };
    return {
      id: data.id,
      fullName: data.full_name,
      nickname: data.nickname,
      avatar: data.avatar_url,
      department: data.department,
      joinedYear: data.joined_year,
      playingLevel: data.playing_level,
      dominantHand: data.dominant_hand,
      gender: data.gender,
      playingStyle: data.playing_style,
      favoriteShot: data.favorite_shot,
      favoriteIdol: data.favorite_idol,
      favoriteFormat: data.favorite_format,
      quote: data.quote,
      currentRacket: data.current_racket,
      racketDetails: data.racket_details || [],
      tournamentHistory: data.tournament_history || [],
      achievements: data.achievements || [],
      winLossRecord: (() => {
        let wins = 0,
          losses = 0;
        if (data.win_loss_record) {
          try {
            const parsed =
              typeof data.win_loss_record === "string"
                ? JSON.parse(data.win_loss_record)
                : data.win_loss_record;
            wins = parsed?.wins || 0;
            losses = parsed?.losses || 0;
          } catch {
            // fallback if it's already a string like "10W - 5L"
            return data.win_loss_record;
          }
        } else if (data.stats) {
          wins = data.stats.wins || 0;
          losses = data.stats.losses || 0;
        }
        return `${wins}W - ${losses}L`;
      })(),
      nationality: data.nationality,
      homeState: data.home_state,
      height: data.height,
      yearsPlaying: data.years_playing,
      coach: data.coach,
      bio: data.bio,
      currentRanking: data.current_ranking,
      highestRanking: data.highest_ranking,
      stats: data.stats,
      recentForm: data.recent_form,
      recentMatches: data.recent_matches,
      frequentPartners: data.frequent_partners,
      careerHighlights: data.career_highlights,
      shoes:
        data.shoes && data.shoes.startsWith("[")
          ? JSON.parse(data.shoes).find((s: any) => s.primary)?.name ||
          JSON.parse(data.shoes)[0]?.name ||
          ""
          : data.shoes,
      shoesList: parseShoesList(data.shoes),
      apparel: data.apparel,
      social:
        data.instagram || data.email
          ? { instagram: data.instagram, email: data.email }
          : undefined,
      userId: data.id,
      isApproved: data.is_approved,
      role: data.role ?? 'player',
      buddies: data.buddies || [],
      buddyRequests: data.buddy_requests || [],
      elo_rating: data.elo_rating,
      singles_elo: data.singles_elo,
      doubles_elo: data.doubles_elo,
      mixed_elo: data.mixed_elo,
      singles_record: data.singles_record,
      doubles_record: data.doubles_record,
      mixed_record: data.mixed_record,
    };
  }

  /* ── Fetch pending matches for verification ────────────────────── */
  const fetchPendingMatches = useCallback(async (profileId: string) => {
    try {
      const fullRes = await supabase
        .from("matches")
        .select(
          "*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)",
        )
        .eq("status", "pending")
        .neq("submitted_by", profileId)
        .or(
          `player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`,
        );
      const res = fullRes.error
        ? await supabase
          .from("matches")
          .select(
            "*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)",
          )
          .eq("status", "pending")
          .neq("submitted_by", profileId)
          .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        : fullRes;
      setPendingMatches(
        (res.data || []).filter((match) =>
          isMatchParticipant(match, profileId),
        ),
      );
    } catch (err) {
      console.warn("fetchPendingMatches error:", err);
    }
  }, []);

  /* ══════════════════════════════════════════════════════════════════
     EFFECT 1: Load page data (player profile, matches, ELO rank).
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!id) {
      if (!isSlug) setLoading(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const failsafe = setTimeout(() => {
      if (!signal.aborted) {
        console.warn(
          "[PlayerProfile] Effect 1 failsafe — clearing loading state.",
        );
        setLoading(false);
      }
    }, 15_000);

    (async () => {
      setLoading(true);
      try {
        const [playerRes, matchesRes, eloRes, eloLogsRes] = await Promise.all([
          supabase.from("players").select("*").eq("id", id).maybeSingle(),
          fetchProfileMatches(id, signal),
          supabase
            .from("players")
            .select("id, elo_rating")
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false }),
          supabase
            .from("elo_calculation_logs")
            .select("*")
            .eq("player_id", id)
            .order("created_at", { ascending: true })
        ]);

        if (signal.aborted) return;

        if (playerRes.error) {
          console.error("Player fetch error:", playerRes.error.message);
          setPlayer(null);
        } else {
          setPlayer(playerRes.data ? formatPlayerData(playerRes.data) : null);
        }

        setRawMatches(matchesRes.data || []);
        if (eloLogsRes.data) {
          setEloLogs(eloLogsRes.data);
        }

        if (eloRes.data) {
          const rank = eloRes.data.findIndex((p: any) => p.id === id) + 1;
          setEloRank(rank > 0 ? rank : null);
        }
      } catch (err: any) {
        if (signal.aborted) return;
        console.error("loadPageData error:", err?.message);
        setPlayer(null);
      } finally {
        if (!signal.aborted) setLoading(false);
        clearTimeout(failsafe);
      }
    })();

    return () => {
      controller.abort();
      clearTimeout(failsafe);
    };
  }, [id]);

  /* ── Derive liveMatches from rawMatches + ownPlayerProfile ── */
  useEffect(() => {
    setLiveMatches(visibleMatchesForViewer(rawMatches, ownPlayerProfile?.id));
  }, [rawMatches, ownPlayerProfile?.id]);

  /* ══════════════════════════════════════════════════════════════════
     EFFECT 2: Auth — trigger pending matches & all players load.
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    let cancelled = false;

    if (!authSession) {
      setPendingMatches([]);
      return;
    }

    const loadAuxData = async () => {
      const { data } = await supabase
        .from("players")
        .select("id, full_name, avatar_url, gender")
        .is("deleted_at", null);
      if (cancelled) return;
      if (data) setAllPlayers(data);
    };

    loadAuxData();

    if (ownPlayerProfile?.id) {
      fetchPendingMatches(ownPlayerProfile.id);
    }

    return () => {
      cancelled = true;
    };
  }, [authSession, ownPlayerProfile?.id, fetchPendingMatches]);

  /* ══════════════════════════════════════════════════════════════════
     EFFECT 3: Retry — if initial fetch returned null but auth is now
     ready, try once more. Handles token-not-yet-valid race on SPA nav.
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!id || loading || player !== null || profileLoadRetried.current) return;
    profileLoadRetried.current = true;
    // Retry once after 1.5 s — covers Supabase cold-start and auth token not-yet-valid races.
    // No longer gated on ownPlayerProfile so anonymous users get the retry too.
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [playerRes, matchesRes, eloRes, eloLogsRes] = await Promise.all([
          supabase.from("players").select("*").eq("id", id).maybeSingle(),
          fetchProfileMatches(id),
          supabase
            .from("players")
            .select("id, elo_rating")
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false }),
          supabase
            .from("elo_calculation_logs")
            .select("*")
            .eq("player_id", id)
            .order("created_at", { ascending: true })
        ]);
        if (playerRes.data) setPlayer(formatPlayerData(playerRes.data));
        if (matchesRes.data) setRawMatches(matchesRes.data);
        if (eloLogsRes.data) setEloLogs(eloLogsRes.data);
        if (eloRes.data) {
          const rank = eloRes.data.findIndex((p: any) => p.id === id) + 1;
          setEloRank(rank > 0 ? rank : null);
        }
      } catch (err) {
        console.error("[PlayerProfile] Retry fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [id, loading, player]);

  const silentRefresh = useCallback(async () => {
    if (!id) return;
    try {
      const [playerRes, matchesRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", id).maybeSingle(),
        fetchProfileMatches(id),
      ]);
      if (playerRes.data) setPlayer(formatPlayerData(playerRes.data));
      if (matchesRes.data)
        setLiveMatches(
          visibleMatchesForViewer(matchesRes.data, ownPlayerProfile?.id),
        );
      if (ownPlayerProfile?.id) fetchPendingMatches(ownPlayerProfile.id);
    } catch {
      /* silent */
    }
  }, [id, ownPlayerProfile?.id, fetchPendingMatches]);

  useAutoRefresh(silentRefresh, 60_000, !loading);

  // H2H record vs logged-in user
  useEffect(() => {
    if (
      !ownPlayerProfile ||
      !id ||
      ownPlayerProfile.id === id ||
      liveMatches.length === 0
    )
      return;
    const h2h = liveMatches.filter(
      (m) =>
        m.status === "confirmed" &&
        ((m.player1_id === ownPlayerProfile.id && m.player2_id === id) ||
          (m.player1_id === id && m.player2_id === ownPlayerProfile.id)),
    );
    if (h2h.length === 0) return;
    const wins = h2h.filter((m) => m.winner_id === ownPlayerProfile.id).length;
    const losses = h2h.filter((m) => m.winner_id === id).length;
    setH2hRecord({ wins, losses });
  }, [liveMatches, ownPlayerProfile, id]);

  const recentOpponents = useMemo(() => {
    if (!id || liveMatches.length === 0) return [];
    const confirmed = liveMatches.filter(m => m.status === "confirmed").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const opponents: any[] = [];
    for (const m of confirmed) {
      const isP1 = m.player1_id === id || m.team1_partner_id === id;
      const opps = isP1 ? [m.player2, m.partner2] : [m.player1, m.partner1];
      for (const op of opps) {
        if (op && !seen.has(op.id)) {
          seen.add(op.id);
          opponents.push(op);
          if (opponents.length >= 5) return opponents;
        }
      }
    }
    return opponents;
  }, [liveMatches, id]);

  const bestOpponent = useMemo(() => {
    if (!id || liveMatches.length === 0) return null;
    const confirmed = liveMatches.filter(m => m.status === "confirmed");
    let highestElo = -1;
    let bestOpp: any = null;
    for (const m of confirmed) {
      if (m.winner_id === id) {
        const isP1 = m.player1_id === id || m.team1_partner_id === id;
        const opps = isP1 ? [m.player2, m.partner2] : [m.player1, m.partner1];
        for (const op of opps) {
          if (op && op.elo_rating > highestElo) {
            highestElo = op.elo_rating;
            bestOpp = op;
          }
        }
      }
    }
    return bestOpp;
  }, [liveMatches, id]);

  // Generate ELO progression data for the chart from actual calculation logs
  const eloHistoryData = useMemo(() => {
    if (!id || !player) return [];

    let currentElo = 1200;
    if (eloChartFilter === "ALL" && player.elo_rating) currentElo = player.elo_rating;
    if (eloChartFilter === "S" && player.singles_elo) currentElo = player.singles_elo;
    if (eloChartFilter === "D" && player.doubles_elo) currentElo = player.doubles_elo;
    if (eloChartFilter === "XD" && player.mixed_elo) currentElo = player.mixed_elo;

    const history = [];

    // Filter logs based on category
    const filteredLogs = eloLogs.filter(log => {
      if (eloChartFilter === "S" && log.category !== "Singles") return false;
      if ((eloChartFilter === "D" || eloChartFilter === "XD") && log.category !== "Doubles") return false;
      // We don't have enough data in elo_calculation_logs to perfectly differentiate D vs XD historically without joining, 
      // but for now this is much better than reverse calculating.
      return true;
    });

    // If we have logs, we push the history forward
    if (filteredLogs.length > 0) {
      // Starting point (the Elo BEFORE the very first logged match in this category)
      // We can approximate it from the first log's previous_elo
      history.push({
        name: "Start",
        elo: eloChartFilter === "ALL" ? 1200 : filteredLogs[0].previous_elo,
      });

      // Add each match point
      let rollingAllElo = 1200;
      filteredLogs.forEach(log => {
        if (eloChartFilter === "ALL") {
          rollingAllElo += Math.trunc((log.elo_change || 0) / 3);
        }
        history.push({
          name: new Date(log.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }),
          elo: eloChartFilter === "ALL" ? rollingAllElo : log.new_elo,
        });
      });

      // Ensure the final point matches current Elo to avoid weird chart drops/spikes at the end
      if (history.length > 0) {
        history[history.length - 1].elo = currentElo;
      }
    } else {
      // Fallback if no logs exist yet
      history.push({ name: "Current", elo: currentElo });
    }

    return history;
  }, [eloLogs, id, player, eloChartFilter]);

  const [generatingWrapped, setGeneratingWrapped] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  if (isSlug) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-[#060d1b]">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Looking up player profile…</p>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#060d1b] py-20 px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white/90 mb-4 tracking-tight">
            Player Not Found
          </h1>
          <p className="text-slate-500 mb-8 text-lg">
            The profile you are looking for has vanished from the court.
          </p>
          <Button
            onClick={() => setLocation("/")}
            variant="default"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 rounded-full px-6 shadow-lg shadow-emerald-500/20"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Base
          </Button>
        </motion.div>
      </div>
    );
  }

  const streak = player.stats?.currentStreak;
  const isWinStreak = streak?.startsWith("W");

  const handleShare = async () => {
    const url = `${getBaseShareUrl()}/player/${id}`;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: player.fullName,
          url,
          dialogTitle: "Share Profile",
        });
      } else if (navigator.share) {
        await navigator.share({ title: player.fullName, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied!");
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("cancel")) {
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success("Profile link copied!"))
          .catch(() => { });
      }
    }
  };

  const handleExportPdf = () => {
    const recentMatches = liveMatches
      .filter((m: any) => m.status === "confirmed")
      .slice(0, 15)
      .map((m: any) => {
        const isP1 = m.player1_id === id;
        const opponentName = isP1
          ? m.player2?.full_name ?? "Unknown"
          : m.player1?.full_name ?? "Unknown";
        const won = m.winner_id === id;
        return {
          date: m.created_at,
          opponent: opponentName,
          score: m.match_score?.split("[")[0]?.trim() ?? "",
          result: (won ? "W" : "L") as "W" | "L",
        };
      });

    exportProfilePdf({
      name: player.fullName,
      elo: player.elo_rating ?? 1200,
      wins: player.stats?.wins ?? 0,
      losses: player.stats?.losses ?? 0,
      avatarUrl: player.avatar ?? null,
      recentMatches,
    });
  };


  const handleWrapped = async () => {
    if (!player) return;
    setGeneratingWrapped(true);
    toast.info("Generating your Year in Review...", { duration: 2000 });

    try {
      const match = player.winLossRecord?.match(/(\d+)W\s*-\s*(\d+)L/) || ["", "0", "0"];
      const totalMatches = parseInt(match[1]) + parseInt(match[2]);
      const winPctStr = (player.stats?.winPercentage ?? 0).toFixed(1) + "%";

      const safeStreak = String(player.stats?.currentStreak || "0").replace("W", "");
      const safeName = player.fullName || "Player";

      const canvas = await renderWrappedShareCard({
        playerName: safeName,
        avatarUrl: player.avatar,
        totalMatches: player.stats?.totalMatches || totalMatches,
        winRate: winPctStr,
        biggestRival: "Unknown", // Can be dynamically calculated later
        bestStreak: parseInt(safeStreak) || 0,
        highestElo: player.elo_rating || 1200
      });

      if (!canvas) throw new Error("Canvas rendering failed");

      // Use toDataURL which is synchronous and avoids unhandled promise rejections
      const dataUrl = canvas.toDataURL("image/png");
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const fileName = `wrapped_${safeName.replace(/\s+/g, "_")}.png`;

      if (Capacitor.isNativePlatform()) {
        // On native Android: save to gallery via Filesystem then open share sheet
        const { Filesystem, Directory } = await import("@capacitor/filesystem");

        // Save to Pictures/DCIM so it appears in the gallery
        const base64 = dataUrl.split(",")[1];
        let savedPath: string | null = null;
        try {
          const saved = await Filesystem.writeFile({
            path: `Pictures/${fileName}`,
            data: base64,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
          savedPath = saved.uri;
          toast.success("Saved to gallery!");
        } catch (e) {
          console.error("Gallery save failed:", e);
          toast.error("Could not save to gallery — check storage permission.");
        }

        // Open share sheet with the saved file (or fall back to base64)
        try {
          await Share.share({
            title: "My IISc Badminton Club Year in Review",
            url: savedPath ?? dataUrl,
            dialogTitle: "Share your Wrapped card",
          });
        } catch (e: any) {
          if (e?.name !== "AbortError") console.error("Share error:", e);
        }
      } else {
        // Web fallback: share sheet via navigator.share, then download
        let shared = false;
        if (navigator.share && navigator.canShare) {
          const file = new File([blob], fileName, { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({ title: "My IISc Badminton Club Year in Review", files: [file] });
              shared = true;
            } catch (e: any) {
              if (e?.name !== "AbortError") console.error("Share error:", e);
            }
          }
        }
        if (!shared) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast.success("Wrapped image saved to Downloads!");
        }
      }
      setGeneratingWrapped(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Wrapped card");
      setGeneratingWrapped(false);
    }
  };

  const handleAdminDelete = async () => {
    if (!player || !currentUser) return;
    toast("Delete Player?", {
      description: `Delete "${player.fullName}"? This soft-deletes the player and removes them from the directory.`,
      action: {
        label: "Delete",
        onClick: async () => {
          const { error } = await supabase.rpc("soft_delete_player", {
            player_id: player.id,
            admin_email: currentUser.email,
          });
          if (error) {
            toast.error("Delete failed", { description: error.message });
            return;
          }
          toast.success(`${player.fullName} has been removed.`);
          setLocation("/");
        },
      },
      cancel: { label: "Cancel", onClick: () => { } },
    });
  };

  const handleSelfDelete = async () => {
    if (!player || !currentUser) return;
    toast("Delete Account & Data?", {
      description: "This action is irreversible. Your profile, matches, and all associated personal data will be permanently deleted from our servers in accordance with Play Store policies.",
      action: {
        label: "Delete Permanently",
        onClick: async () => {
          // Soft delete in the database which triggers server-side cleanup policies
          const { error } = await supabase
            .from("players")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", player.id);

          if (error) {
            toast.error("Failed to delete account", { description: error.message });
            return;
          }

          // Clear local data
          localStorage.clear();
          sessionStorage.clear();

          toast.success("Account and all data successfully deleted.");
          await supabase.auth.signOut();
          setLocation("/join");
        },
      },
      cancel: { label: "Cancel", onClick: () => { } },
      duration: 10000,
    });
  };

  const nameParts = player.fullName.trim().split(/\s+/);
  // Last word is the giant display word; everything before it is the smaller label.
  const heroLastWord = nameParts.length > 0 ? nameParts[nameParts.length - 1] : "";
  const heroRestName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "";
  const targetUserRole = player.role ?? 'player';

  if (matchesOnly) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#060d1b] selection:bg-amber-500/30 font-sans pb-24 pt-4 lg:pt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6 mt-2">
            <div>
              <h1 className="text-3xl font-black text-white">
                Matches
              </h1>
              <p className="text-slate-500 dark:text-white/45 text-sm mt-1">
                Your recent activity
              </p>
            </div>

          </div>
          <MatchHistorySection
            id={id}
            liveMatches={liveMatches}
            ownPlayerProfile={ownPlayerProfile}
            handleWithdrawMatch={handleWithdrawMatch}
            handleConfirmMatch={handleConfirmMatch}
            handleRejectMatch={handleRejectMatch}
            handleResendRequest={handleResendRequest}
            defaultOpen={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060d1b] font-sans pb-24">
      <div className="relative w-full bg-slate-50 dark:bg-[#060d1b]">
        {/* Profile Banner — theme-aware: light banner for light mode, dark for dark */}
        <div className="absolute top-0 left-0 w-full h-[380px] md:h-[460px] overflow-hidden">
          <img
            src="/profile_banner_dark.png"
            alt="Profile Banner"
            className="w-full h-full object-cover dark:hidden"
          />
          <img
            src="/profile_banner_light.png"
            alt="Profile Banner"
            className="w-full h-full object-cover hidden dark:block"
          />
          {/* Light mode: soft white veil so dark text stays readable; dark mode: strong dark scrim */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-white/20 to-transparent dark:from-black/65 dark:via-black/35 dark:to-transparent" />
          {/* Bottom fade blends banner into page background */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-50 dark:from-[#060d1b] to-transparent" />
        </div>

        {/* Navigation */}
        <nav className="relative z-20 flex items-center justify-between px-6 lg:px-10 pt-5 pb-3">
          <button
            onClick={() => setLocation("/players")}
            className="group flex items-center gap-2 text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-all duration-200 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Players</span>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && player && currentUser?.id !== player.userId && (
              <>
                <select
                  value={targetUserRole}
                  onChange={(e) => updateRole(player.id, e.target.value)}
                  className="bg-black/20 border border-white/20 text-white text-xs font-semibold rounded-xl px-2 py-2 outline-none hover:bg-black/40 transition backdrop-blur-md"
                  title="Assign Role"
                >
                  <option value="player" className="text-slate-800 font-medium">Regular Player</option>
                  <option value="umpire" className="text-slate-800 font-medium">Umpire</option>
                  {isAdmin && <option value="admin" className="text-slate-800 font-medium">Admin</option>}
                  {isMainAdmin && <option value="master_admin" className="text-slate-800 font-medium">Master Admin</option>}
                </select>
                <button
                  onClick={handleAdminDelete}
                  className="p-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow"
                  title="Admin: Delete player"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {currentUser && player && currentUser.id === player.userId && (
              <>
                <button
                  onClick={() => setLocation("/profile/setup")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-200 transition-all text-xs font-black uppercase tracking-wider shadow"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Edit Profile</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-2.5 rounded-xl bg-white/80 dark:bg-black/20 border border-slate-200/80 dark:border-white/20 text-slate-700 dark:text-white hover:bg-white dark:hover:bg-black/40 transition-all backdrop-blur-md shadow-sm"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={async () => {
                        if (confirm("Sign out?")) {
                          await supabase.auth.signOut();
                          setLocation("/join");
                        }
                      }}
                      className="cursor-pointer font-medium"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        if (confirm("Clear all local app data? You will need to sign in again.")) {
                          localStorage.clear();
                          sessionStorage.clear();
                          supabase.auth.signOut().then(() => {
                            window.location.href = "/join";
                          });
                        }
                      }}
                      className="cursor-pointer font-medium text-orange-600 focus:text-orange-600 focus:bg-orange-50 dark:focus:bg-orange-950/50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Data
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSelfDelete}
                      className="cursor-pointer font-medium text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/50"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Delete Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            <button
              onClick={handleWrapped}
              disabled={generatingWrapped}
              className="group relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
              title="Generate Year in Review"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{generatingWrapped ? "Loading..." : "Wrapped"}</span>
            </button>

            <button
              onClick={handleExportPdf}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-black/20 border border-slate-200/80 dark:border-white/20 text-slate-700 dark:text-white hover:bg-white dark:hover:bg-black/40 transition-all backdrop-blur-md shadow-sm"
              title="Export PDF"
            >
              <FileDown className="w-4 h-4" />
            </button>

            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-black/20 border border-slate-200/80 dark:border-white/20 text-slate-700 dark:text-white hover:bg-white dark:hover:bg-black/40 transition-all backdrop-blur-md shadow-sm"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-4 pb-12">
          <div className="flex flex-col md:flex-row gap-8 items-end relative">
            {/* Left: Avatar overlapping header */}
            <div className="relative mt-8 md:mt-24 shrink-0 z-20">
              <div className="w-40 h-40 md:w-64 md:h-64 rounded-2xl border-4 border-slate-200/70 dark:border-white/35 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.55)] bg-slate-200 dark:bg-slate-800">
                {player.avatar ? (
                  <img src={player.avatar} alt={player.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl font-black text-slate-400">
                    {player.fullName.charAt(0)}
                  </div>
                )}
              </div>
              {/* Floating rank badge */}
              {eloRank && (
                <div className="absolute -bottom-4 -right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg font-black text-xl shadow-lg border-2 border-white dark:border-slate-950 flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> #{eloRank}
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex-1 pb-2 md:pb-4 text-slate-900 dark:text-white mt-4 md:mt-0">
              {/* Name */}
              <div className="flex flex-col">
                {heroRestName && (
                  <span
                    className="text-xl md:text-3xl font-bold uppercase tracking-[0.2em] text-white/95 dark:text-slate-900"
                    style={theme === "light" ? { textShadow: "0 2px 12px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)" } : undefined}
                  >{heroRestName}</span>
                )}
                <div className="flex items-center flex-wrap gap-4">
                  <h1
                    className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none text-white dark:text-slate-900"
                    style={theme === "light" ? { textShadow: "0 4px 24px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)" } : undefined}
                  >{heroLastWord}</h1>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Floating Details Section - Placed beautifully below the avatar/name to keep the banner clean */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-8 mt-2 md:mt-8">
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start">
            
            {/* Left/Main Column: Stats, Tags, CTAs */}
            <div className="flex flex-col gap-5 w-full lg:w-2/3">
              {/* Instagram link */}
              {player.social?.instagram && (
                <a
                  href={`https://instagram.com/${player.social.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 w-max bg-white dark:bg-slate-900 border border-pink-200 dark:border-pink-900/50 text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-900/20 font-bold rounded-2xl transition-all shadow-sm"
                  title="Instagram"
                >
                  <Instagram className="w-5 h-5" />
                  <span className="text-sm tracking-widest">@{player.social.instagram.replace("@", "")}</span>
                </a>
              )}

              {/* Stats / Details Pill Row */}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-400" /> {player.department}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm">
                  {player.playingLevel}
                </span>
                {player.dominantHand && (
                  <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold uppercase shadow-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-violet-400" /> {player.dominantHand.split("-")[0]} Hand
                  </span>
                )}
              </div>

              {/* ELO Row */}
              <div className="flex flex-wrap gap-2">
                {player.elo_rating != null && (
                  <span className={`px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sm font-black uppercase shadow-sm flex items-center gap-1.5 ${getEloTier(player.elo_rating).bg} ${getEloTier(player.elo_rating).text}`}>
                    <Trophy className="w-4 h-4" /> {getEloTier(player.elo_rating).name} • <AnimatedCounter value={player.elo_rating} /> OVR
                  </span>
                )}
                {player.singles_elo != null && (
                  <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
                    <User className="w-4 h-4 text-emerald-500" /> S: {player.singles_elo}
                  </span>
                )}
                {player.doubles_elo != null && (
                  <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-500" /> D: {player.doubles_elo}
                  </span>
                )}
                {player.mixed_elo != null && (
                  <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-200 text-sm font-bold shadow-sm flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500" /> XD: {player.mixed_elo}
                  </span>
                )}
              </div>

              {/* Next Tier Progress Bar */}
              {player.elo_rating != null && (() => {
                const tierOrder = [
                  { name: "Bronze", minElo: 0 },
                  { name: "Silver", minElo: 1000 },
                  { name: "Gold", minElo: 1200 },
                  { name: "Platinum", minElo: 1400 },
                  { name: "Diamond", minElo: 1600 },
                  { name: "Grandmaster", minElo: 1800 },
                ];
                const currentTierInfo = getEloTier(player.elo_rating);
                const currentIdx = tierOrder.findIndex(t => t.name === currentTierInfo.name);
                const nextTier = tierOrder[currentIdx + 1];
                
                if (!nextTier) return (
                  <div className="mt-1 max-w-sm bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Max Tier Reached</span>
                      <span className="text-xs font-black text-amber-500">👑</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" />
                    </div>
                  </div>
                );
                
                const currentMin = tierOrder[currentIdx].minElo;
                const progress = Math.min(100, Math.max(0, ((player.elo_rating - currentMin) / (nextTier.minElo - currentMin)) * 100));
                const remaining = nextTier.minElo - player.elo_rating;
                return (
                  <div className="mt-1 max-w-sm bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">{remaining} ELO to {nextTier.name}</span>
                      <span className="text-[10px] font-black text-slate-600 dark:text-slate-300">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {currentUser && player && currentUser.id !== player.userId && ownPlayerProfile && (
                  <>
                    <button
                      onClick={handleToggleFollow}
                      className={`flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider ${isFollowing
                          ? "bg-violet-600 text-white hover:bg-rose-500"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-violet-50 dark:hover:bg-violet-900/30 hover:border-violet-300 dark:hover:border-violet-700"
                        }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4 group-hover:hidden" />
                          <span className="group-hover:hidden">Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" /> Follow
                        </>
                      )}
                    </button>
                    {isBuddy ? (
                      <button
                        onClick={() => handleBuddyAction('remove')}
                        className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <Heart className="w-4 h-4 fill-white text-white" />
                        Buddy
                      </button>
                    ) : hasReceivedRequest ? (
                      <button
                        onClick={() => handleBuddyAction('accept')}
                        className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Heart className="w-4 h-4" />
                        Accept Request
                      </button>
                    ) : hasSentRequest ? (
                      <button
                        onClick={() => handleBuddyAction('cancel')}
                        className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-slate-600 text-white hover:bg-slate-700"
                      >
                        <Heart className="w-4 h-4" />
                        Request Sent
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuddyAction('send')}
                        className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:border-rose-300 dark:hover:border-rose-700"
                      >
                        <Heart className="w-4 h-4" />
                        Add Buddy
                      </button>
                    )}
                    <button
                      onClick={() => setIsChallengeModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-2.5 font-black rounded-xl transition-all shadow-md text-sm uppercase tracking-wider bg-orange-500 text-white hover:bg-orange-600 border border-orange-400"
                    >
                      <Swords className="w-4 h-4" />
                      Challenge
                    </button>
                  </>
                )}
              </div>
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
                  className={`py-4 text-sm font-black tracking-widest uppercase transition-colors relative ${activeTab === tab
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT                                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-24 space-y-8"
      >
        {/* Pending Match Verification Banner */}
        {(activeTab === "MATCHES" || activeTab === "OVERVIEW") &&
          currentUser &&
          player &&
          currentUser.id === player.userId &&
          pendingMatches.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden"
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
                      <span className="text-amber-400 font-black italic mx-2">
                        VS
                      </span>
                      <span className="font-bold">{m.player2?.full_name}</span>
                      <div className="text-xs text-slate-500 mt-1">
                        Score:{" "}
                        <span className="font-bold text-white">
                          {m.score}
                        </span>
                        <span className="mx-2 opacity-40">•</span>
                        Winner:{" "}
                        <span className="font-bold text-emerald-400">
                          {m.winner_id === m.player1_id
                            ? m.player1?.full_name
                            : m.player2?.full_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleConfirmMatch(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-emerald-500/25"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                      <button
                        onClick={() => handleRejectMatch(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white dark:bg-white/7 hover:bg-slate-50 dark:hover:bg-white/12 text-slate-600 dark:text-white/60 text-xs font-black rounded-xl transition-all border border-slate-200 dark:border-white/8"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        {/* ── Split Stats (Friendly / Tournament / Overall) ── */}
        {activeTab === "OVERVIEW" && splitStats && splitStats.all.total > 0 && (
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Overall */}
              <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-500/[0.05] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-white/35">
                      Overall
                    </span>
                    <CircularProgress
                      value={splitStats.all.winPct}
                      size={44}
                      stroke={4}
                    />
                  </div>
                  <div className="text-3xl font-black text-white tabular-nums mb-1">
                    <span className="text-emerald-500">
                      {splitStats.all.wins}W
                    </span>
                    <span className="text-white/20 mx-1.5 font-light">
                      ·
                    </span>
                    <span className="text-rose-500">
                      {splitStats.all.losses}L
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/35 font-medium">
                    {splitStats.all.total} matches total
                  </div>
                  {streak && (
                    <div
                      className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${isWinStreak ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}
                    >
                      <Flame className="w-3 h-3" /> {streak} streak
                    </div>
                  )}
                  {streakStats.max > 0 && (
                    <div className="mt-3 ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-orange-500/15 text-orange-400" title="All-Time Best Win Streak">
                      <Trophy className="w-3 h-3" /> Max {streakStats.max}W
                    </div>
                  )}
                  {bestOpponent && (
                    <div className="mt-2 text-[10px] text-slate-500 dark:text-white/40 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                      <Swords className="w-3 h-3 text-indigo-400" /> Best win vs {bestOpponent.full_name} ({bestOpponent.elo_rating})
                    </div>
                  )}
                </div>
              </div>

              {/* Friendly */}
              <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-300 to-emerald-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/[0.12] flex items-center justify-center text-base shrink-0">
                      🏸
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                      Friendly
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white tabular-nums mb-1">
                    {splitStats.friendly.wins}W
                    <span className="text-white/20 font-light mx-1">
                      –
                    </span>
                    {splitStats.friendly.losses}L
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                    {splitStats.friendly.total} matches ·{" "}
                    {splitStats.friendly.winPct}% win
                  </div>
                  {/* Animated win rate bar */}
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${splitStats.friendly.winPct}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                  {splitStats.friendly.recentForm.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] uppercase tracking-[0.15em] font-black text-slate-500 dark:text-white/35 mr-0.5">
                        Form
                      </span>
                      {splitStats.friendly.recentForm.map((r, i) => (
                        <FormPill key={i} result={r} index={i} />
                      ))}
                    </div>
                  )}
                  {splitStats.friendly.streak && (
                    <div
                      className={`mt-2 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black ${splitStats.friendly.streak.startsWith("W") ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}
                    >
                      {splitStats.friendly.streak}
                    </div>
                  )}
                </div>
              </div>

              {/* Tournament */}
              <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-300 to-orange-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/[0.12] flex items-center justify-center text-base shrink-0">
                      🏆
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
                      Tournament
                    </span>
                  </div>
                  {splitStats.tournament.total > 0 ? (
                    <>
                      <div className="text-3xl font-black text-white tabular-nums mb-1">
                        {splitStats.tournament.wins}W
                        <span className="text-white/20 font-light mx-1">
                          –
                        </span>
                        {splitStats.tournament.losses}L
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                        {splitStats.tournament.total} matches ·{" "}
                        {splitStats.tournament.winPct}% win
                      </div>
                      {/* Animated win rate bar */}
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${splitStats.tournament.winPct}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                      {splitStats.tournament.recentForm.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] uppercase tracking-[0.15em] font-black text-slate-500 dark:text-white/35 mr-0.5">
                            Form
                          </span>
                          {splitStats.tournament.recentForm.map((r, i) => (
                            <FormPill key={i} result={r} index={i} />
                          ))}
                        </div>
                      )}
                      {splitStats.tournament.streak && (
                        <div
                          className={`mt-2 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black ${splitStats.tournament.streak.startsWith("W") ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}
                        >
                          {splitStats.tournament.streak}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-white/35 italic">
                      No tournament matches yet
                    </div>
                  )}
                </div>
              </div>

              {/* Singles */}
              <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-300 to-blue-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-blue-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/[0.12] flex items-center justify-center text-base shrink-0">
                      👤
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                      Singles
                    </span>
                  </div>
                  {splitStats.singles.total > 0 ? (
                    <>
                      <div className="text-3xl font-black text-white tabular-nums mb-1">
                        {splitStats.singles.wins}W
                        <span className="text-white/20 font-light mx-1">–</span>
                        {splitStats.singles.losses}L
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                        {splitStats.singles.total} matches · {splitStats.singles.winPct}% win
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${splitStats.singles.winPct}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-white/35 italic">
                      No singles matches
                    </div>
                  )}
                </div>
              </div>

              {/* Doubles */}
              <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-300 to-purple-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-purple-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/[0.12] flex items-center justify-center text-base shrink-0">
                      👥
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">
                      Doubles
                    </span>
                  </div>
                  {splitStats.doubles.total > 0 ? (
                    <>
                      <div className="text-3xl font-black text-white tabular-nums mb-1">
                        {splitStats.doubles.wins}W
                        <span className="text-white/20 font-light mx-1">–</span>
                        {splitStats.doubles.losses}L
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                        {splitStats.doubles.total} matches · {splitStats.doubles.winPct}% win
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${splitStats.doubles.winPct}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-white/35 italic">
                      No doubles matches
                    </div>
                  )}
                </div>
              </div>

              {/* Mixed */}
              <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-300 to-rose-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-rose-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/[0.12] flex items-center justify-center text-base shrink-0">
                      👫
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-400">
                      Mixed
                    </span>
                  </div>
                  {splitStats.mixed.total > 0 ? (
                    <>
                      <div className="text-3xl font-black text-white tabular-nums mb-1">
                        {splitStats.mixed.wins}W
                        <span className="text-white/20 font-light mx-1">–</span>
                        {splitStats.mixed.losses}L
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/35 font-medium mb-2">
                        {splitStats.mixed.total} matches · {splitStats.mixed.winPct}% win
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-white/8 overflow-hidden mb-3">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${splitStats.mixed.winPct}%` }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-white/35 italic">
                      No mixed matches
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Main 2-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {activeTab === "OVERVIEW" && (
              <>
                {/* Player Attributes */}
                <motion.section variants={itemVariants}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0">
                      Player Attributes
                    </span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {(
                      [
                        {
                          Icon: Crosshair,
                          label: "Playing Style",
                          value: player.playingStyle,
                          accent: "from-amber-400 to-orange-500",
                          iconBg: "bg-amber-500/[0.12]",
                          iconColor: "text-amber-500",
                        },
                        {
                          Icon: Zap,
                          label: "Signature Shot",
                          value: player.favoriteShot,
                          accent: "from-rose-400 to-pink-500",
                          iconBg: "bg-rose-500/[0.12]",
                          iconColor: "text-rose-500",
                        },
                        {
                          Icon: User,
                          label: "Dominant Hand",
                          value: player.dominantHand,
                          accent: "from-blue-400 to-cyan-500",
                          iconBg: "bg-blue-500/[0.12]",
                          iconColor: "text-blue-500",
                        },
                        {
                          Icon: Sparkles,
                          label: "Badminton Idol",
                          value: player.favoriteIdol,
                          accent: "from-violet-400 to-purple-500",
                          iconBg: "bg-violet-500/[0.12]",
                          iconColor: "text-violet-500",
                        },
                        {
                          Icon: Activity,
                          label: "Favorite Format",
                          value: player.favoriteFormat,
                          accent: "from-emerald-400 to-teal-500",
                          iconBg: "bg-emerald-500/[0.12]",
                          iconColor: "text-emerald-500",
                        },
                      ] as const
                    ).map((attr) => (
                      <div
                        key={attr.label}
                        className="relative overflow-hidden bg-white/5 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/14 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 hover:-translate-y-0.5 transition-all duration-300 group"
                      >
                        <div
                          className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${attr.accent}`}
                        />
                        <div
                          className={`w-9 h-9 rounded-xl ${attr.iconBg} flex items-center justify-center mb-4`}
                        >
                          <attr.Icon className={`w-4 h-4 ${attr.iconColor}`} />
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-white/35 mb-1.5 uppercase tracking-wider">
                          {attr.label}
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-800 dark:text-white/90 leading-snug">
                          {attr.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>

                {/* Performance Breakdown */}
                {player.stats?.categoryStats && (
                  <motion.section variants={itemVariants}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                      <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0">
                        Performance Breakdown
                      </span>
                      <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                    </div>
                    <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 space-y-5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-blue-500 to-blue-700" />
                      {player.stats.categoryStats.singles && (
                        <CategoryBar
                          label="Singles"
                          wins={player.stats.categoryStats.singles.wins}
                          losses={player.stats.categoryStats.singles.losses}
                          color="bg-emerald-500"
                        />
                      )}
                      {player.stats.categoryStats.doubles && (
                        <CategoryBar
                          label="Doubles"
                          wins={player.stats.categoryStats.doubles.wins}
                          losses={player.stats.categoryStats.doubles.losses}
                          color="bg-blue-500"
                        />
                      )}
                      {player.stats.categoryStats.mixed && (
                        <CategoryBar
                          label="Mixed"
                          wins={player.stats.categoryStats.mixed.wins}
                          losses={player.stats.categoryStats.mixed.losses}
                          color="bg-violet-500"
                        />
                      )}
                    </div>
                  </motion.section>
                )}

                {/* Match History */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0 flex items-center gap-2">
                    <Swords className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> Match History
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />

                </div>
                <MatchHistorySection
                  id={id}
                  liveMatches={liveMatches}
                  ownPlayerProfile={ownPlayerProfile}
                  handleWithdrawMatch={handleWithdrawMatch}
                  handleConfirmMatch={handleConfirmMatch}
                  handleRejectMatch={handleRejectMatch}
                  handleResendRequest={handleResendRequest}
                />

                {/* Equipment Arsenal */}
                <EquipmentArsenalSection player={player} />

                {/* Career Highlights */}
                <CareerHighlightsSection player={player} />
              </>
            )}
            {/* ── RANKING TAB ── */}
            {activeTab === "RANKING" && (
              <motion.section variants={itemVariants} className="space-y-6 md:space-y-8">
                {authSession?.user?.id && player.userId && authSession.user.id !== player.userId && (
                  <HeadToHeadWidget
                    currentUserId={authSession.user.id}
                    targetUserId={player.userId}
                    targetUserName={player.fullName || ""}
                    matches={liveMatches.filter((m) => m.status === "confirmed")}
                  />
                )}

                <Badges
                  matches={liveMatches.filter((m) => m.status === "confirmed")}
                  playerId={id!}
                />

                <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-white/8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-white/45 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-400" /> ELO Progression
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowEloAudit(true)}
                        className="px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-500 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition"
                      >
                        Audit Log
                      </button>
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                        {["ALL", "S", "D", "XD"].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setEloChartFilter(filter as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${eloChartFilter === filter
                                ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                              }`}
                          >
                            {filter === "ALL" ? "OVR" : filter}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {eloHistoryData.length > 1 ? (
                    <div className="h-64 w-full" aria-label="ELO rating progression chart" role="img">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={eloHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} dy={10} minTickGap={30} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} domain={["auto", "auto"]} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "16px",
                              border: "1px solid rgba(255,255,255,0.08)",
                              boxShadow: "0 20px 40px -8px rgb(0 0 0 / 0.4)",
                              background: "#0f172a",
                              color: "#f8fafc",
                            }}
                            itemStyle={{ color: "#f59e0b", fontWeight: "bold" }}
                            labelStyle={{ color: "#94a3b8", fontSize: "12px", marginBottom: "4px" }}
                            formatter={(value: any, name: string) => [`${value} ELO`, "Rating"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="elo"
                            stroke="#f59e0b"
                            strokeWidth={4}
                            dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                            activeDot={{ r: 6 }}
                            isAnimationActive={true}
                            animationDuration={800}
                            animationEasing="ease-out"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 w-full flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                        <TrendingUp className="w-6 h-6 text-slate-400" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">No Data Available</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                        Play more {eloChartFilter === "S" ? "Singles" : eloChartFilter === "D" ? "Doubles" : eloChartFilter === "XD" ? "Mixed Doubles" : ""} matches to unlock the progression chart.
                      </p>
                    </div>
                  )}
                </div>

                {(!authSession?.user?.id || player.userId === authSession.user.id) && eloHistoryData.length <= 1 && liveMatches.length < 5 && (
                  <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-8 border border-slate-200 dark:border-white/8 text-center">
                    <Trophy className="w-12 h-12 text-slate-300 dark:text-white/10 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-500 dark:text-white/40">Not Enough Data</h3>
                    <p className="text-xs text-slate-400 dark:text-white/20 mt-1">Play more matches to unlock ranking analytics.</p>
                  </div>
                )}
              </motion.section>
            )}

            {/* ── STATS TAB ── */}
            {activeTab === "STATS" && (
              <motion.section variants={itemVariants} className="space-y-6 md:space-y-8">

                <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-white/45 flex items-center gap-2 mb-6">
                    <Target className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> Player Type Analysis
                  </h2>
                  <div className="h-72 w-full" aria-label="Player strengths radar chart" role="img">
                    {(() => {
                      const sRecord = player.singles_record || "0W - 0L";
                      const dRecord = player.doubles_record || "0W - 0L";
                      const xdRecord = player.mixed_record || "0W - 0L";
                      const parseWinPct = (r: string) => {
                        const m = r.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
                        if (!m) return 0;
                        const w = +m[1];
                        const l = +m[2];
                        return (w + l) ? Math.round((w / (w + l)) * 100) : 0;
                      };
                      const data = [
                        { subject: 'Singles', A: parseWinPct(sRecord) || 20, fullMark: 100 },
                        { subject: 'Doubles', A: parseWinPct(dRecord) || 20, fullMark: 100 },
                        { subject: 'Mixed', A: parseWinPct(xdRecord) || 20, fullMark: 100 },
                        { subject: 'Activity', A: Math.min(100, Math.max(20, liveMatches.length * 5)), fullMark: 100 },
                        { subject: 'Synergy', A: (player.doubles_elo || 1200) > 1300 ? 90 : 50, fullMark: 100 },
                      ];
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                            <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-800" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Performance" dataKey="A" stroke="#10b981" strokeWidth={3} fill="#10b981" fillOpacity={0.4} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--tw-colors-slate-900)', borderColor: 'var(--tw-colors-slate-800)', borderRadius: '12px' }}
                              itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                <DoublesSynergyWidget
                  matches={liveMatches.filter((m) => m.status === "confirmed")}
                  playerId={id!}
                  allPlayers={allPlayers}
                />
                <AchievementBadges
                  matches={liveMatches}
                  playerId={id!}
                  elo={player.elo_rating ?? 1200}
                  wins={player.stats?.wins ?? 0}
                  losses={player.stats?.losses ?? 0}
                />
                <PerformanceTrends matches={liveMatches} playerId={id!} />
                <WrappedCard
                  playerName={player.fullName}
                  avatarUrl={(player as any).avatar_url}
                  elo={player.elo_rating ?? 1200}
                  matches={liveMatches}
                  playerId={id!}
                />
                <PlayerAnalyticsWidget
                  matches={liveMatches}
                  playerId={id!}
                  playerElo={player.elo_rating ?? 1200}
                />
                <ActivityHeatmap
                  matches={liveMatches.filter((m) => m.status === "confirmed")}
                />
              </motion.section>
            )}

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">
            {/* Quote */}
            {activeTab === "OVERVIEW" && player.quote && (
              <motion.div variants={itemVariants} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-800 to-amber-500 rounded-[1.75rem] blur opacity-25 group-hover:opacity-50 transition duration-500" />
                <div className="relative bg-gradient-to-br from-[#1a3a7a] via-[#0f2347] to-[#070d1a] rounded-[1.75rem] p-7 shadow-lg shadow-blue-950/40 overflow-hidden border border-amber-500/20">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-400/0 via-amber-400/50 to-amber-400/0" />
                  <Quote className="absolute -bottom-3 -right-3 w-24 h-24 text-amber-400/[0.12] -rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                  <div className="relative z-10">
                    <p className="text-base sm:text-lg font-serif italic text-white/85 leading-snug">
                      "{player.quote}"
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bio */}
            {activeTab === "OVERVIEW" && player.bio && (
              <motion.section
                variants={itemVariants}
                className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 to-cyan-500" />
                <h2 className="text-[10px] font-black text-slate-500 dark:text-white/35 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> About
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-white/65">
                  {player.bio}
                </p>
                {(player.coach ||
                  player.yearsPlaying != null ||
                  player.highestRanking != null) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/8 space-y-2.5">
                      {player.coach && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 dark:text-white/35 font-medium">
                            Coach
                          </span>
                          <span className="font-bold text-slate-800 dark:text-white/90">
                            {player.coach}
                          </span>
                        </div>
                      )}
                      {player.yearsPlaying != null && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 dark:text-white/35 font-medium">
                            Years Playing
                          </span>
                          <span className="font-bold text-slate-800 dark:text-white/90">
                            {player.yearsPlaying} yrs
                          </span>
                        </div>
                      )}
                      {player.highestRanking != null && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 dark:text-white/35 font-medium">
                            Career-High Rank
                          </span>
                          <span className="font-bold text-slate-800 dark:text-white/90">
                            #{player.highestRanking}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
              </motion.section>
            )}

            {/* Career Record + Achievements */}
            {activeTab === "OVERVIEW" && (
              <motion.section
                variants={itemVariants}
                className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-500" />
                <h2 className="text-[10px] font-black text-slate-500 dark:text-white/35 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" /> Career Record
                </h2>

                {/* W/L block */}
                <div className="mb-6 p-5 bg-black/40 rounded-xl relative overflow-hidden border border-slate-300 dark:border-white/6">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.08] to-transparent" />
                  <div className="relative z-10">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2">
                      Overall W/L
                    </div>
                    <div className="text-2xl font-black text-white">
                      {player.winLossRecord}
                    </div>
                  </div>
                </div>

                {/* Achievements */}
                {validAchievements.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-500 dark:text-white/35 mb-4 flex items-center gap-1.5">
                      <Medal className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Achievements
                    </h3>
                    <div className="relative ml-5 space-y-3">
                      <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-amber-400/70 via-amber-300/40 to-amber-500/60 rounded-full" />
                      {[...validAchievements]
                        .sort((a, b) => {
                          const yearA = parseInt(
                            a.match(/\b(20\d{2})\b/)?.[1] || "0",
                            10,
                          );
                          const yearB = parseInt(
                            b.match(/\b(20\d{2})\b/)?.[1] || "0",
                            10,
                          );
                          return yearA !== yearB
                            ? yearB - yearA
                            : a.localeCompare(b);
                        })
                        .map((ach, idx) => {
                          const lower = ach.toLowerCase();
                          const isGold =
                            lower.includes("winner") ||
                            lower.includes("champion") ||
                            lower.includes("1st") ||
                            lower.includes("gold");
                          const isSilver =
                            lower.includes("runner-up") ||
                            lower.includes("2nd") ||
                            lower.includes("silver");
                          const isBronze =
                            lower.includes("semifinalist") ||
                            lower.includes("bronze") ||
                            lower.includes("3rd");
                          const icon = isGold
                            ? "🥇"
                            : isSilver
                              ? "🥈"
                              : isBronze
                                ? "🥉"
                                : "⭐";
                          const bg = isGold
                            ? "bg-amber-500/10 ring-amber-500/25"
                            : isSilver
                              ? "bg-slate-200 dark:bg-white/8 ring-white/20"
                              : isBronze
                                ? "bg-orange-500/10 ring-orange-500/25"
                                : "bg-emerald-500/10 ring-emerald-500/25";
                          return (
                            <div
                              key={idx}
                              className="relative flex gap-3 items-start"
                            >
                              <div
                                className={`relative -ml-[18px] mt-0.5 shrink-0 w-8 h-8 rounded-full ${bg} ring-2 flex items-center justify-center shadow-sm`}
                              >
                                <span className="text-xs">{icon}</span>
                              </div>
                              <div className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-white/4 border border-slate-300 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 transition-colors">
                                <span className="text-xs font-bold text-slate-700 dark:text-white/80 leading-snug">
                                  {ach}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Tournament history */}
                {player.tournamentHistory.length > 0 && (
                  <div
                    className={
                      validAchievements.length > 0
                        ? "pt-5 border-t border-slate-200 dark:border-white/8"
                        : ""
                    }
                  >
                    <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-500 dark:text-white/35 mb-4 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-blue-500" /> Tournaments
                    </h3>
                    <div className="relative ml-5 space-y-2.5">
                      <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-blue-500/50 to-indigo-500/50 rounded-full" />
                      {[...player.tournamentHistory]
                        .sort((a, b) => {
                          const yearA = parseInt(
                            a.match(/\b(20\d{2})\b/)?.[1] || "0",
                            10,
                          );
                          const yearB = parseInt(
                            b.match(/\b(20\d{2})\b/)?.[1] || "0",
                            10,
                          );
                          return yearA !== yearB
                            ? yearB - yearA
                            : a.localeCompare(b);
                        })
                        .map((t, idx) => (
                          <div
                            key={idx}
                            className="relative flex gap-3 items-center"
                          >
                            <div className="relative -ml-[11px] shrink-0 w-6 h-6 rounded-full bg-blue-500/10 ring-2 ring-blue-500/25 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                            </div>
                            <div className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-white/4 border border-slate-300 dark:border-white/6 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 transition-colors">
                              <span className="text-xs font-bold text-slate-700 dark:text-white/80">
                                {t}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Frequent Partners */}
            {activeTab === "STATS" && player.frequentPartners && player.frequentPartners.length > 0 && (
              <motion.section
                variants={itemVariants}
                className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400 to-emerald-500" />
                <h2 className="text-[10px] font-black text-slate-500 dark:text-white/35 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-amber-400" /> Frequent
                  Partners
                </h2>
                <div className="space-y-2">
                  {player.frequentPartners.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => p.id && setLocation(`/player/${p.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-white/4 hover:bg-slate-50 dark:hover:bg-slate-200 dark:bg-white/8 border border-slate-300 dark:border-white/7 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1a3a7a] to-[#0f2347] border border-amber-500/30 flex items-center justify-center text-amber-300 font-black text-xs shrink-0">
                          {p.name
                            .split(" ")
                            .map((s: string) => s[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 dark:text-white/90 truncate">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-white/45">
                            {p.matchesTogether != null && (
                              <>{p.matchesTogether} matches</>
                            )}
                            {p.winRate != null && <> · {p.winRate}% win rate</>}
                          </div>
                        </div>
                      </div>
                      {p.id && (
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {/* H2H vs logged-in user */}
            {activeTab === "RANKING" && h2hRecord && ownPlayerProfile && (
              <motion.section
                variants={itemVariants}
                className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-2xl p-6 border border-slate-200 dark:border-white/8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-400 to-pink-500" />
                <h2 className="text-[10px] font-black text-slate-500 dark:text-white/35 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Swords className="w-3.5 h-3.5 text-rose-500" /> You vs{" "}
                  {player.fullName.split(" ")[0]}
                </h2>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-5xl font-black text-emerald-500 tabular-nums">
                      {h2hRecord.wins}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mt-1.5">
                      You
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white/15">
                    VS
                  </div>
                  <div className="text-center">
                    <div className="text-5xl font-black text-rose-500 tabular-nums">
                      {h2hRecord.losses}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mt-1.5">
                      {player.fullName.split(" ")[0]}
                    </div>
                  </div>
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-4">
                  {h2hRecord.wins + h2hRecord.losses} match
                  {h2hRecord.wins + h2hRecord.losses !== 1 ? "es" : ""} total
                </p>
              </motion.section>
            )}

            {/* Recently Played Against */}
            {activeTab === "RANKING" && recentOpponents.length > 0 && (
              <motion.section variants={itemVariants} className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Recently Played Against
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
                </div>
                <div className="flex overflow-x-auto gap-3 pb-4 hide-scrollbar snap-x">
                  {recentOpponents.map((opp, idx) => (
                    <Link key={idx} href={`/player/${opp.id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/8 hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md transition-all group cursor-pointer shrink-0 w-40 sm:w-48 snap-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-white/10 group-hover:border-emerald-400 shrink-0">
                          {opp.avatar_url ? (
                            <img src={opp.avatar_url} alt={opp.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-full h-full p-2 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {opp.full_name}
                          </div>
                          <div className="text-[10px] font-bold text-slate-500 dark:text-white/40 uppercase tracking-widest flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-emerald-500" /> {opp.elo_rating}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.section>
            )}
          </div>
        </div>

        {/* Media Showcase */}
        {activeTab === "OVERVIEW" && player.stats?.media && player.stats.media.length > 0 && (
          <motion.section
            variants={itemVariants}
            className="mt-4 pt-8 border-t border-slate-200 dark:border-white/8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-white/35 shrink-0">
                Media Showcase
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {player.stats.media.some((m) => m.type === "image") && (
                <div>
                  <h3 className="text-sm font-black text-white/70 flex items-center gap-2 mb-3">
                    <Image className="w-4 h-4 text-amber-400" /> Game Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {player.stats.media
                      .filter((m) => m.type === "image")
                      .map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setLightboxImage(img.url)}
                          className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-slate-200 dark:border-white/8 hover:-translate-y-1 hover:border-slate-300 dark:border-white/15 hover:shadow-lg transition-all duration-300"
                        >
                          <img
                            loading="lazy"
                            src={img.url}
                            alt={img.caption || "Game Photo"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                            <span className="text-white text-xs font-bold line-clamp-2">
                              {img.caption || "View"}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {player.stats.media.some((m) => m.type === "video") && (
                <div>
                  <h3 className="text-sm font-black text-white/70 flex items-center gap-2 mb-3">
                    <Video className="w-4 h-4 text-rose-500" /> Video Highlights
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {player.stats.media
                      .filter((m) => m.type === "video")
                      .map((vid, idx) => {
                        const yId = getYouTubeId(vid.url);
                        const thumb = yId
                          ? `https://img.youtube.com/vi/${yId}/mqdefault.jpg`
                          : "";
                        return (
                          <div
                            key={idx}
                            onClick={() => yId && setActiveVideoId(yId)}
                            className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-slate-200 dark:border-white/8 bg-black/30 hover:-translate-y-1 hover:border-slate-300 dark:border-white/15 hover:shadow-lg transition-all duration-300"
                          >
                            {thumb && (
                              <img
                                loading="lazy"
                                src={thumb}
                                alt={vid.caption || "Video"}
                                className="w-full h-full object-cover opacity-75 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                              <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                                <Play className="w-4 h-4 fill-white ml-0.5" />
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex items-end p-3">
                              <span className="text-white text-xs font-bold line-clamp-2">
                                {vid.caption || "Watch"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* ── MATCHES TAB ── */}
        {activeTab === "MATCHES" && (
          <motion.section variants={itemVariants}>
            <MatchHistorySection
              id={id!}
              liveMatches={liveMatches}
              ownPlayerProfile={ownPlayerProfile}
              handleWithdrawMatch={handleWithdrawMatch}
              handleConfirmMatch={handleConfirmMatch}
              handleRejectMatch={handleRejectMatch}
              handleResendRequest={handleResendRequest}
              defaultOpen={true}
            />
          </motion.section>
        )}
      </motion.div>

      {/* ─── Photo Lightbox ─── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button className="absolute top-6 right-6 text-white hover:text-slate-300 text-3xl font-light">
            ×
          </button>
          <img
            loading="lazy"
            src={lightboxImage}
            alt="Fullscreen"
            className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* ─── Avatar Modal ─── */}
      <AnimatePresence>
        {isAvatarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAvatarOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.2)] bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={player.avatar}
                alt={player.fullName}
                className="max-w-[85vw] max-h-[85vh] object-cover"
              />
              <button
                onClick={() => setIsAvatarOpen(false)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/75 backdrop-blur-md border border-slate-300 dark:border-white/15 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-light transition"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* ─── YouTube Player Modal ─── */}
      {activeVideoId && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveVideoId(null)}
        >
          <button className="absolute top-6 right-6 text-white text-3xl font-light">
            ×
          </button>
          <div
            className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
              title="YouTube player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
      {player && (
        <ChallengeModal
          isOpen={isChallengeModalOpen}
          onClose={() => setIsChallengeModalOpen(false)}
          currentUser={currentUser}
          targetPlayer={player}
        />
      )}

      <EloAuditModal
        isOpen={showEloAudit}
        onClose={() => setShowEloAudit(false)}
        matches={liveMatches}
        playerId={id!}
      />
    </div>
    </div>
  );
}
