import { useParams, useLocation } from "wouter";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Trophy, User, Activity, MapPin, Calendar, Swords, Zap,
  Target, Dna, Crosshair, Sparkles, Quote, Medal, ArrowLeft,
  TrendingUp, Award, Flame, BarChart3, Share2, Trash2,
  Instagram, Mail, Users, Star, Hash, Ruler, BookOpen,
  ChevronRight, Footprints, Shirt, ArrowUpRight, Clock, LogOut,
  CheckCircle, XCircle, Play, Image, Video
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import LogMatchModal from "@/components/LogMatchModal";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { isAdminEmail } from "@/lib/admin";
import { MatchHistorySection } from "@/components/player-profile/MatchHistorySection";
import { EquipmentArsenalSection, CareerHighlightsSection } from "@/components/player-profile/PlayerProfileSections";
import { LoadingScreen, FormPill, CircularProgress, KPI, CategoryBar, Badges, ActivityHeatmap, PlayerRadarChart, EloHistoryChart } from "@/components/player-profile/PlayerProfileWidgets";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { toast } from "sonner";
import { getEloTier } from "@/lib/tiers";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

interface CategoryStat { wins: number; losses: number; }

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
  media?: { type: string; url: string; caption?: string; }[];
}

interface CareerHighlight { year: number; title: string; description?: string; }
interface Partner { name: string; id?: string; matchesTogether?: number; winRate?: number; }
interface Social { instagram?: string; email?: string; }

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
  favoriteShot: string;
  favoriteIdol: string;
  quote?: string;
  currentRacket: string;
  racketDetails: { name: string; string: string; tension: string; }[];
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
  shoesList?: { name: string; primary: boolean; }[];
  apparel?: string;
  social?: Social;
  userId?: string;
  elo_rating?: number;
  isApproved?: boolean;
}

const MATCH_SELECT =
  "*, player1:players!player1_id(id, full_name), player2:players!player2_id(id, full_name)";

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

function visibleMatchesForViewer(matches: any[], viewerPlayerId?: string | null): any[] {
  return matches.filter((match) => (
    match.status === "confirmed" || isMatchParticipant(match, viewerPlayerId)
  ));
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

  const fullParticipantFilter =
    `player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`;
  const legacyParticipantFilter = `player1_id.eq.${profileId},player2_id.eq.${profileId}`;

  const fullRes = await runQuery(fullParticipantFilter);
  if (!fullRes.error) return fullRes;

  if (signal?.aborted || fullRes.error?.message?.includes("aborted")) {
    return fullRes;
  }

  console.warn("Falling back to legacy match participant query:", fullRes.error.message);
  return runQuery(legacyParticipantFilter);
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } }
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function PlayerProfile({ matchesOnly, params }: { matchesOnly?: boolean; params?: any } = {}) {
  const { id: routeId } = useParams<{id: string}>();
  const [, setLocation] = useLocation();
  const { session: authSession, user: currentUser, profile: ownPlayerProfile, isAdmin, isMainAdmin, userRoles, updateRole } = useAuth();
  
  // If we're in matchesOnly mode and no routeId is provided, use the logged-in user's profile ID
  const id = routeId || (matchesOnly ? ownPlayerProfile?.id : undefined);

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [eloRank, setEloRank] = useState<number | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [rawMatches, setRawMatches] = useState<any[]>([]);
  const [h2hRecord, setH2hRecord] = useState<{ wins: number; losses: number } | null>(null);
  const [allPlayers, setAllPlayers] = useState<{ id: string; full_name: string; avatar_url?: string; gender?: string }[]>([]);
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [matchHistoryFilter, setMatchHistoryFilter] = useState<"all" | "friendly" | "tournament">("all");
  const [isMatchHistoryOpen, setIsMatchHistoryOpen] = useState(false);

  /* ── Shared helper: map DB row → Player interface ──────────────── */
  function formatPlayerData(data: any): Player {
    const parseShoesList = (shoes: string | null) => {
      if (!shoes) return [];
      try {
        if (shoes.startsWith("[")) return JSON.parse(shoes);
        return [{ name: shoes, primary: true }];
      } catch { return [{ name: shoes, primary: true }]; }
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
      playingStyle: data.playing_style,
      favoriteShot: data.favorite_shot,
      favoriteIdol: data.favorite_idol,
      quote: data.quote,
      currentRacket: data.current_racket,
      racketDetails: data.racket_details || [],
      tournamentHistory: data.tournament_history || [],
      achievements: data.achievements || [],
      winLossRecord: (() => {
        let wins = 0, losses = 0;
        if (data.win_loss_record) {
          try {
            const parsed = typeof data.win_loss_record === 'string' ? JSON.parse(data.win_loss_record) : data.win_loss_record;
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
      shoes: data.shoes && data.shoes.startsWith("[")
        ? (JSON.parse(data.shoes).find((s: any) => s.primary)?.name || JSON.parse(data.shoes)[0]?.name || "")
        : data.shoes,
      shoesList: parseShoesList(data.shoes),
      apparel: data.apparel,
      social: data.instagram || data.email ? { instagram: data.instagram, email: data.email } : undefined,
      userId: data.user_id,
      isApproved: data.is_approved,
    };
  }

  /* ── Fetch pending matches for verification ────────────────────── */
  const fetchPendingMatches = useCallback(async (profileId: string) => {
    try {
      const fullRes = await supabase
        .from("matches")
        .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
        .eq("status", "pending")
        .neq("submitted_by", profileId)
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId},team1_partner_id.eq.${profileId},team2_partner_id.eq.${profileId}`);
      const res = fullRes.error
        ? await supabase
          .from("matches")
          .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
          .eq("status", "pending")
          .neq("submitted_by", profileId)
          .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        : fullRes;
      setPendingMatches((res.data || []).filter((match) => isMatchParticipant(match, profileId)));
    } catch (err) { console.warn("fetchPendingMatches error:", err); }
  }, []);

  /* ── Match action handlers ─────────────────────────────────────── */
  const handleConfirmMatch = async (matchId: string) => {
    try {
      const { data, error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchId, confirmer_id: ownPlayerProfile?.id });
      if (error) throw error;
      toast.success("Match Confirmed!", { description: `Elo Ratings Updated. Your Elo Change: ${data.p1_elo_change || data.p2_elo_change}` });
      if (ownPlayerProfile) fetchPendingMatches(ownPlayerProfile.id);
    } catch (e: any) { toast.error("Error confirming match", { description: e.message }); }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      const { error } = await supabase.rpc("reject_friendly_match", { match_uuid: matchId, rejecter_id: ownPlayerProfile?.id });
      if (error) throw error;
      toast.success("Match Rejected", { description: "The match request has been dismissed." });
      if (ownPlayerProfile) fetchPendingMatches(ownPlayerProfile.id);
    } catch (e: any) { toast.error("Error rejecting match", { description: e.message }); }
  };

  const handleResendRequest = async (match: any) => {
    try {
      const { error } = await supabase.functions.invoke('notify-match', {
        body: { type: 'INSERT', table: 'matches', record: match }
      });
      if (error) throw error;
      toast.success("Request resent to opponent(s)");
    } catch (e: any) {
      toast.error("Failed to resend request", { description: e.message });
    }
  };

  const handleWithdrawMatch = async (matchId: string) => {
    toast("Withdraw this match?", {
      description: "Are you sure you want to withdraw this pending match log? It will be deleted permanently.",
      action: {
        label: "Withdraw",
        onClick: async () => {
          try {
            const { data, error } = await supabase.from("matches").delete().eq("id", matchId).select("id");
            if (error) throw error;
            if (!data || data.length === 0) {
              throw new Error("Delete was denied by the server. You may not have permission to withdraw this match.");
            }
            toast.success("Match withdrawn successfully.");
            setRawMatches(prev => prev.filter(m => m.id !== matchId));
            if (ownPlayerProfile) fetchPendingMatches(ownPlayerProfile.id);
          } catch (e: any) { toast.error("Error withdrawing match", { description: e.message }); }
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  /* ══════════════════════════════════════════════════════════════════
     EFFECT 1: Load page data (player profile, matches, ELO rank).
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!id) { setLoading(false); return; }

    const controller = new AbortController();
    const { signal } = controller;

    const failsafe = setTimeout(() => {
      if (!signal.aborted) {
        console.warn("[PlayerProfile] Effect 1 failsafe — clearing loading state.");
        setLoading(false);
      }
    }, 15_000);

    (async () => {
      setLoading(true);
      try {
        const [playerRes, matchesRes, eloRes] = await Promise.all([
          supabase.from("players").select("*")
            .eq("id", id).maybeSingle(),
          fetchProfileMatches(id, signal),
          supabase.from("players").select("id, elo_rating")
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false }),
        ]);

        if (signal.aborted) return;

        if (playerRes.error) {
          console.error("Player fetch error:", playerRes.error.message);
          setPlayer(null);
        } else {
          setPlayer(playerRes.data ? formatPlayerData(playerRes.data) : null);
        }

        setRawMatches(matchesRes.data || []);

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

    return () => { controller.abort(); clearTimeout(failsafe); };
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
      const { data } = await supabase.from("players").select("id, full_name, avatar_url, gender").is("deleted_at", null);
      if (cancelled) return;
      if (data) setAllPlayers(data);
    };

    loadAuxData();

    if (ownPlayerProfile?.id) {
      fetchPendingMatches(ownPlayerProfile.id);
    }

    return () => { cancelled = true; };
  }, [authSession, ownPlayerProfile?.id, fetchPendingMatches]);

  const silentRefresh = useCallback(async () => {
    if (!id) return;
    try {
      const [playerRes, matchesRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", id).maybeSingle(),
        fetchProfileMatches(id),
      ]);
      if (playerRes.data) setPlayer(formatPlayerData(playerRes.data));
      if (matchesRes.data) setLiveMatches(visibleMatchesForViewer(matchesRes.data, ownPlayerProfile?.id));
      if (ownPlayerProfile?.id) fetchPendingMatches(ownPlayerProfile.id);
    } catch { /* silent */ }
  }, [id, ownPlayerProfile?.id, fetchPendingMatches]);

  // H2H record vs logged-in user
  useEffect(() => {
    if (!ownPlayerProfile || !id || ownPlayerProfile.id === id || liveMatches.length === 0) return;
    const h2h = liveMatches.filter(
      (m) =>
        m.status === 'confirmed' &&
        ((m.player1_id === ownPlayerProfile.id && m.player2_id === id) ||
        (m.player1_id === id && m.player2_id === ownPlayerProfile.id))
    );
    if (h2h.length === 0) return;
    const wins   = h2h.filter((m) => m.winner_id === ownPlayerProfile.id).length;
    const losses = h2h.filter((m) => m.winner_id === id).length;
    setH2hRecord({ wins, losses });
  }, [liveMatches, ownPlayerProfile, id]);

  const validAchievements = useMemo(
    () => (player ? player.achievements.filter((a) => a && a.trim() !== "") : []),
    [player]
  );

  const dynamicBadges = useMemo(() => {
    if (!player) return [];
    const _badges: { id: string; label: string; icon: string; description: string; color: string }[] = [];
    
    // Centurion Badge
    let totalMatches = 0;
    if (player.winLossRecord) {
      const match = player.winLossRecord.match(/(\d+)W\s*-\s*(\d+)L/);
      if (match) totalMatches = parseInt(match[1]) + parseInt(match[2]);
    } else if (player.stats?.totalMatches) {
      totalMatches = player.stats.totalMatches;
    }
    
    if (totalMatches >= 100) {
      _badges.push({ id: 'centurion', label: 'Centurion', icon: '💯', description: 'Played 100+ matches', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30 ring-amber-500/20' });
    } else if (totalMatches >= 50) {
      _badges.push({ id: 'veteran', label: 'Veteran', icon: '⚔️', description: 'Played 50+ matches', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30 ring-slate-500/20' });
    }
    
    // Win Streak Badge
    const streak = player.stats?.currentStreak;
    if (streak && streak.startsWith('W')) {
      const streakCount = parseInt(streak.replace('W', '')) || 0;
      if (streakCount >= 5) {
        _badges.push({ id: 'unstoppable', label: 'Unstoppable', icon: '⚡', description: '5+ Match Win Streak', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 ring-indigo-500/20' });
      } else if (streakCount >= 3) {
        _badges.push({ id: 'on_fire', label: 'On Fire', icon: '🔥', description: '3 Match Win Streak', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30 ring-orange-500/20' });
      }
    }

    // Giant Slayer Badge
    const hasGiantSlayer = validAchievements.some(a => a.toLowerCase().includes('giant slayer') || a.toLowerCase().includes('upset'));
    if (hasGiantSlayer) {
      _badges.push({ id: 'giant_slayer', label: 'Giant Slayer', icon: '🗡️', description: 'Defeated a much higher ranked opponent', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30 ring-rose-500/20' });
    }
    
    return _badges;
  }, [player, validAchievements]);

  const profileCompleteness = useMemo(() => {
    if (!player) return 0;
    const checks = [
      !!player.avatar,
      !!player.bio,
      !!player.quote,
      !!player.nationality,
      !!player.height,
      !!player.coach,
      player.yearsPlaying != null,
      player.racketDetails.length > 0,
      !!(player.shoesList?.length || player.shoes),
      !!player.social?.instagram,
      !!(player.stats?.media?.length),
      validAchievements.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [player, validAchievements]);

  const winPct = useMemo(() => {
    if (!player) return 0;
    if (player.stats?.winPercentage != null) return player.stats.winPercentage;
    const w = player.stats?.wins ?? 0;
    const l = player.stats?.losses ?? 0;
    if (w + l === 0) {
      const m = player.winLossRecord?.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
      if (m) {
        const ww = +m[1], ll = +m[2];
        return ww + ll ? (ww / (ww + ll)) * 100 : 0;
      }
      return 0;
    }
    return (w / (w + l)) * 100;
  }, [player]);

  const totalMatches = useMemo(() => {
    if (!player) return 0;
    if (player.stats?.totalMatches != null) return player.stats.totalMatches;
    const m = player.winLossRecord?.match(/(\d+)\s*W\s*-\s*(\d+)\s*L/i);
    if (m) return +m[1] + +m[2];
    return (player.stats?.wins ?? 0) + (player.stats?.losses ?? 0);
  }, [player]);

  // BWF-style Split Stats
  const splitStats = useMemo(() => {
    if (!id) return null;
    const confirmed = liveMatches.filter(m => m.status === "confirmed");
    const friendly = confirmed.filter(m => m.is_friendly !== false);
    const tournament = confirmed.filter(m => m.is_friendly === false);

    const computeStats = (matches: any[]) => {
      const wins = matches.filter(m => m.winner_id === id).length;
      const losses = matches.length - wins;
      const winPct = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;
      const recentForm = matches.slice(0, 5).map(m => m.winner_id === id ? "W" : "L") as ("W" | "L")[];
      let streak = "";
      if (matches.length > 0) {
        const firstResult = matches[0].winner_id === id ? "W" : "L";
        let count = 0;
        for (const m of matches) {
          const r = m.winner_id === id ? "W" : "L";
          if (r === firstResult) count++;
          else break;
        }
        streak = `${firstResult}${count}`;
      }
      return { wins, losses, total: matches.length, winPct, recentForm, streak };
    };

    return {
      all: computeStats(confirmed),
      friendly: computeStats(friendly),
      tournament: computeStats(tournament),
    };
  }, [liveMatches, id]);

  // Generate ELO progression data for the chart
  const eloHistoryData = useMemo(() => {
    if (!id || liveMatches.length === 0 || !player?.elo_rating) return [];
    const confirmed = liveMatches.filter(m => m.status === "confirmed").sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let currentElo = player.elo_rating;
    
    // Reverse calculate the past ELOs
    const history = [];
    history.push({ name: "Current", elo: currentElo });

    for (let i = confirmed.length - 1; i >= 0; i--) {
      const match = confirmed[i];
      if (match.player1_id === id && match.p1_elo_change) {
        currentElo -= match.p1_elo_change;
      } else if (match.player2_id === id && match.p2_elo_change) {
        currentElo -= match.p2_elo_change;
      }
      history.push({ name: new Date(match.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}), elo: currentElo });
    }
    return history.reverse();
  }, [liveMatches, id, player?.elo_rating]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 py-20 px-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <h1 className="text-4xl font-extrabold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">Player Not Found</h1>
          <p className="text-slate-500 mb-8 text-lg">The profile you are looking for has vanished from the court.</p>
          <Button onClick={() => setLocation('/')} variant="default" className="gap-2 bg-emerald-600 hover:bg-emerald-700 rounded-full px-6 shadow-lg shadow-emerald-500/20">
            <ArrowLeft className="w-4 h-4" /> Return to Base
          </Button>
        </motion.div>
      </div>
    );
  }

  const streak = player.stats?.currentStreak;
  const isWinStreak = streak?.startsWith("W");

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: player.fullName, url, dialogTitle: 'Share Profile' });
      } else if (navigator.share) {
        await navigator.share({ title: player.fullName, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied!");
      }
    } catch (err: any) {
      if (err.message && !err.message.includes("cancel")) {
        navigator.clipboard.writeText(url).then(() => toast.success("Profile link copied!")).catch(() => {});
      }
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
          if (error) { toast.error("Delete failed", { description: error.message }); return; }
          toast.success(`${player.fullName} has been removed.`);
          setLocation('/');
        }
      },
      cancel: { label: "Cancel", onClick: () => {} }
    });
  };

  const handleSelfDelete = async () => {
    if (!player || !currentUser) return;
    const { error } = await supabase
      .from('players')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', player.id);
    if (error) { alert("Failed to delete profile: " + error.message); return; }
    alert("Your profile has been deleted.");
    await supabase.auth.signOut();
    setLocation('/join');
  };

  const nameParts = player.fullName.trim().split(/\s+/);
  const heroFirstName = nameParts[0];
  const heroLastName = nameParts.slice(1).join(' ');
  const targetUserRole = userRoles.find(r => r.id === player.id)?.role;

  if (matchesOnly) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070d1a] selection:bg-emerald-500/30 font-sans pb-24 pt-4 lg:pt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-6 mt-2">
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">Matches</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your recent activity</p>
            </div>
            {ownPlayerProfile && (
              <button
                onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                className="bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 px-5 py-3 rounded-2xl font-bold"
              >
                <Swords className="w-5 h-5" />
                <span className="hidden sm:inline">Log a Match</span>
                <span className="sm:hidden">Log</span>
              </button>
            )}
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#070d1a] selection:bg-emerald-500/30 font-sans">

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CINEMATIC HERO                                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-slate-950" style={{ minHeight: '88vh' }}>

        {/* Atmospheric background */}
        <div className="absolute inset-0">
          <img src={player.avatar} alt="" className="w-full h-full object-cover opacity-[0.12] scale-110 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/30 to-slate-950/60" />
        </div>

        {/* Ambient glow orbs */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.18, 0.35, 0.18] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-[30%] w-[700px] h-[700px] bg-emerald-500/[0.12] rounded-full blur-[180px] pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.25, 0.12] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
          className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] bg-cyan-400/[0.08] rounded-full blur-[140px] pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.08, 0.18, 0.08] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute top-[5%] right-[10%] w-[400px] h-[400px] bg-violet-500/[0.06] rounded-full blur-[120px] pointer-events-none"
        />

        {/* ── Navigation ── */}
        <nav className="relative z-20 flex items-center justify-between px-6 lg:px-10 pt-5 pb-3">
          <button
            onClick={() => setLocation('/players')}
            className="group flex items-center gap-2 text-white/40 hover:text-white/90 transition-all duration-200 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Players</span>
          </button>

          <div className="flex items-center gap-2">
            {isAdmin && player && currentUser?.id !== player.userId && (
              <>
                <select
                  value={targetUserRole || ""}
                  onChange={(e) => updateRole(player.id, e.target.value || null)}
                  className="bg-white/5 border border-white/10 text-white/70 text-xs font-semibold rounded-xl px-2 py-2 outline-none hover:bg-white/10 transition"
                  title="Assign Role"
                >
                  <option value="" className="text-slate-800 font-medium">Regular Player</option>
                  <option value="umpire" className="text-slate-800 font-medium">Umpire</option>
                  {isMainAdmin && <option value="admin" className="text-slate-800 font-medium">Admin</option>}
                </select>
                <button onClick={handleAdminDelete}
                  className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                  title="Admin: Delete player">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {currentUser && player && currentUser.id === player.userId && (
              <>
                <button onClick={() => setLocation('/profile/setup')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline">Edit Profile</span>
                </button>
                <button onClick={handleSelfDelete}
                  className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                  title="Delete profile">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => { if (confirm("Sign out?")) { await supabase.auth.signOut(); setLocation('/join'); } }}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
                  title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}

            {currentUser && player && currentUser.id !== player.userId && ownPlayerProfile && (
              <button onClick={() => setIsLogMatchOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-black uppercase tracking-wider">
                <Swords className="w-3.5 h-3.5" /><span className="hidden sm:inline">Log Match</span>
              </button>
            )}

            <button onClick={handleShare}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/30 hover:text-white/70 hover:bg-white/10 transition-all"
              title="Share">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </nav>

        {/* ── Hero Body ── */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-6 pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center min-h-[60vh]">

            {/* LEFT: Identity */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col justify-center"
            >
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2.5 mb-7">
                <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-black tracking-[0.15em] uppercase">
                  {player.playingLevel}
                </span>
                {targetUserRole && (
                  <span className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-black tracking-[0.15em] uppercase">
                    {targetUserRole}
                  </span>
                )}
                {eloRank && (
                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-black tracking-[0.1em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    Rank #{eloRank}
                  </span>
                )}
                {player.elo_rating != null && (
                  <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r ${getEloTier(player.elo_rating).color} text-white text-[11px] font-black tracking-[0.1em] uppercase shadow-lg`}>
                    {getEloTier(player.elo_rating).icon} {getEloTier(player.elo_rating).name} ({player.elo_rating})
                  </span>
                )}
                {player.isApproved === false && (
                  <span className="px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold">
                    Pending Approval
                  </span>
                )}
              </div>

              {/* Name — massive split typography */}
              <div className="mb-8 select-none">
                <div
                  className="font-black leading-[0.88] tracking-tight text-white"
                  style={{ fontSize: 'clamp(3.2rem, 10vw, 6rem)' }}
                >
                  {heroFirstName}
                </div>
                {heroLastName && (
                  <div
                    className="font-black leading-[0.88] tracking-tight"
                    style={{
                      fontSize: 'clamp(3.2rem, 10vw, 6rem)',
                      WebkitTextStroke: '2px rgba(16,185,129,0.55)',
                      color: 'transparent',
                    }}
                  >
                    {heroLastName}
                  </div>
                )}
                {player.nickname && (
                  <p className="mt-4 text-lg sm:text-xl text-emerald-400/70 italic font-serif tracking-wide">
                    "{player.nickname}"
                  </p>
                )}
              </div>

              {/* Meta tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/45 text-xs font-medium">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />{player.department}
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/45 text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />Class of {player.joinedYear}
                </span>
                {player.dominantHand && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/45 text-xs font-medium">
                    <User className="w-3.5 h-3.5 text-violet-400 shrink-0" />{player.dominantHand} Handed
                  </span>
                )}
                {player.height && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/45 text-xs font-medium">
                    <Ruler className="w-3.5 h-3.5 text-teal-400 shrink-0" />{player.height}
                  </span>
                )}
                {player.nationality && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/45 text-xs font-medium">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />{player.nationality}{player.homeState ? ` · ${player.homeState}` : ''}
                  </span>
                )}
              </div>

              {/* Dynamic Badges */}
              {dynamicBadges.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-8">
                  {dynamicBadges.map(badge => (
                    <div 
                      key={badge.id}
                      title={badge.description}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ring-1 ring-inset backdrop-blur-sm cursor-help transition-transform hover:scale-105 ${badge.color}`}
                    >
                      <span className="text-sm drop-shadow-md">{badge.icon}</span>
                      <span className="text-xs font-black tracking-wide uppercase drop-shadow-sm">{badge.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Stats strip */}
              {splitStats && (
                <div className="flex items-stretch mb-8 bg-white/[0.04] rounded-2xl border border-white/[0.08] p-1 w-fit max-w-full overflow-x-auto overflow-y-hidden">
                  {[
                    { value: splitStats.all.wins, label: 'Wins', color: 'text-emerald-400' },
                    { value: splitStats.all.losses, label: 'Losses', color: 'text-rose-400' },
                    { value: `${splitStats.all.winPct}%`, label: 'Win Rate', color: 'text-amber-400' },
                    ...(player.stats?.titlesWon ? [{ value: player.stats.titlesWon, label: 'Titles', color: 'text-amber-300' }] : []),
                    ...(splitStats.all.total ? [{ value: splitStats.all.total, label: 'Matches', color: 'text-white/70' }] : []),
                  ].map((stat, i, arr) => (
                    <div key={stat.label} className="flex items-stretch shrink-0">
                      <div className="px-5 py-3 text-center">
                        <div className={`text-2xl sm:text-3xl font-black ${stat.color} leading-none tabular-nums`}>
                          {stat.value}
                        </div>
                        <div className="text-[9px] text-white/25 font-black uppercase tracking-[0.18em] mt-1.5">
                          {stat.label}
                        </div>
                      </div>
                      {i < arr.length - 1 && <div className="w-px bg-white/[0.08] my-2 shrink-0" />}
                    </div>
                  ))}
                  
                  {/* Head to Head Widget */}
                  {h2hRecord && (
                    <>
                      <div className="w-px bg-white/[0.08] my-2 shrink-0 ml-1 mr-1" />
                      <div className="flex items-stretch shrink-0 bg-blue-500/5 rounded-xl ml-1 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 pointer-events-none" />
                        <div className="px-5 py-3 text-center relative z-10 flex flex-col justify-center">
                          <div className="flex items-center justify-center gap-2 mb-1.5">
                            <span className="text-xl font-black text-blue-400">{h2hRecord.wins}</span>
                            <span className="text-white/30 text-sm font-bold">vs</span>
                            <span className="text-xl font-black text-indigo-400">{h2hRecord.losses}</span>
                          </div>
                          <div className="text-[9px] text-blue-300/70 font-black uppercase tracking-[0.18em]">
                            You vs {heroFirstName}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Recent form */}
              {player.recentForm && player.recentForm.length > 0 && (
                <div className="flex items-center gap-3 mb-8">
                  <span className="text-[9px] text-white/20 font-black uppercase tracking-[0.22em] shrink-0">Form</span>
                  <div className="flex gap-1.5">
                    {player.recentForm.slice(0, 5).map((r, i) => <FormPill key={i} result={r} index={i} />)}
                  </div>
                  {streak && (
                    <div className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-black ${isWinStreak ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'}`}>
                      <Flame className="w-3 h-3 inline mr-1" />{streak}
                    </div>
                  )}
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                {currentUser && player && currentUser.id !== player.userId && ownPlayerProfile && (
                  <button onClick={() => setIsLogMatchOpen(true)}
                    className="group flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 text-sm tracking-wide">
                    <Swords className="w-4 h-4" /> Log Match
                  </button>
                )}
                {currentUser && player && currentUser.id === player.userId && (
                  <button onClick={() => setLocation('/profile/setup')}
                    className="group flex items-center gap-2 px-7 py-3.5 bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.12] text-white font-black rounded-2xl transition-all hover:-translate-y-0.5 text-sm tracking-wide">
                    <Sparkles className="w-4 h-4 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" /> Edit Profile
                  </button>
                )}
                {player.social?.instagram && (
                  <a href={`https://instagram.com/${player.social.instagram.replace('@', '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-5 py-3.5 bg-gradient-to-r from-pink-500/10 to-orange-500/10 border border-pink-500/20 text-pink-400 hover:border-pink-400/50 font-bold rounded-2xl transition-all text-sm">
                    <Instagram className="w-4 h-4" /><span className="hidden sm:inline">Instagram</span>
                  </a>
                )}
              </div>
            </motion.div>

            {/* RIGHT: Photo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
              className="flex justify-center lg:justify-end items-center"
            >
              <div className="relative">
                {/* Glow halo */}
                <div className="absolute -inset-12 bg-gradient-to-b from-emerald-400/10 via-teal-400/[0.05] to-transparent rounded-[5rem] blur-3xl pointer-events-none" />

                {/* Photo card */}
                <div
                  onClick={() => setIsAvatarOpen(true)}
                  className="relative w-60 sm:w-72 lg:w-[22rem] rounded-[2.5rem] overflow-hidden border border-white/[0.08] shadow-[0_50px_130px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)] cursor-zoom-in group"
                >
                  <img
                    src={player.avatar}
                    alt={player.fullName}
                    className="w-full object-cover group-hover:scale-[1.04] transition-transform duration-700"
                    style={{ height: 'clamp(18rem, 45vh, 28rem)' }}
                  />
                  {/* Bottom fade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />

                  {/* Profile completeness bar */}
                  {currentUser && currentUser.id === player.userId && (
                    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-white/30 mb-1.5">
                        <span>Profile</span><span>{profileCompleteness}%</span>
                      </div>
                      <div className="h-[2px] bg-white/[0.08] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${profileCompleteness}%` }}
                          transition={{ duration: 1.6, delay: 0.6, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rank badge */}
                {player.currentRanking != null && (
                  <div className="absolute -bottom-5 -right-4 p-0.5 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 shadow-2xl shadow-amber-500/35">
                    <div className="rounded-[14px] bg-slate-950 px-4 py-2.5 flex flex-col items-center min-w-[56px]">
                      <span className="text-[8px] font-black uppercase text-amber-400/60 tracking-widest">Rank</span>
                      <span className="text-2xl font-black text-white leading-tight">#{player.currentRanking}</span>
                    </div>
                  </div>
                )}

                {/* ELO badge */}
                {eloRank && (
                  <div className="absolute -top-4 -left-4 px-3.5 py-2 rounded-xl bg-slate-900/95 border border-white/[0.08] backdrop-blur-sm shadow-xl hidden md:flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-black text-white/70">ELO Rank <span className="text-emerald-400">#{eloRank}</span></span>
                  </div>
                )}

                {/* Quote floating badge */}
                {player.quote && (
                  <div className="absolute -top-2 -left-8 max-w-[190px] bg-slate-900/95 border border-white/[0.07] rounded-2xl px-4 py-3.5 shadow-2xl hidden xl:block backdrop-blur-sm">
                    <Quote className="w-3 h-3 text-emerald-400 mb-1.5" />
                    <p className="text-white/55 text-[11px] font-medium italic leading-relaxed line-clamp-3">
                      "{player.quote}"
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Hero → content transition */}
        <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-slate-50 dark:from-[#070d1a] to-transparent z-20 pointer-events-none" />
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
        {currentUser && player && currentUser.id === player.userId && pendingMatches.length > 0 && (
          <motion.div variants={itemVariants}
            className="bg-amber-500/[0.07] dark:bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />
            <h3 className="text-amber-700 dark:text-amber-400 font-black mb-4 flex items-center gap-2 text-sm">
              <Swords className="w-4 h-4" /> Pending Match Verifications ({pendingMatches.length})
            </h3>
            <div className="space-y-3">
              {pendingMatches.map(m => (
                <div key={m.id} className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 dark:bg-black/30 p-4 rounded-xl border border-amber-500/[0.12]">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center sm:text-left">
                    <span className="font-bold">{m.player1?.full_name}</span>
                    <span className="text-amber-600 dark:text-amber-500 font-black italic mx-2">VS</span>
                    <span className="font-bold">{m.player2?.full_name}</span>
                    <div className="text-xs text-slate-500 mt-1">
                      Score: <span className="font-bold text-slate-800 dark:text-white">{m.score}</span>
                      <span className="mx-2 opacity-40">•</span>
                      Winner: <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {m.winner_id === m.player1_id ? m.player1?.full_name : m.player2?.full_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={() => handleConfirmMatch(m.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-emerald-500/25">
                      <CheckCircle className="w-3.5 h-3.5" /> Confirm
                    </button>
                    <button onClick={() => handleRejectMatch(m.id)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-black rounded-xl transition-all">
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Split Stats (Friendly / Tournament / Overall) ── */}
        {splitStats && splitStats.all.total > 0 && (
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Overall */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-500/[0.05] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Overall</span>
                    <CircularProgress value={splitStats.all.winPct} size={44} stroke={4} />
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums mb-1">
                    <span className="text-emerald-500">{splitStats.all.wins}W</span>
                    <span className="text-slate-300 dark:text-slate-600 mx-1.5 font-light">·</span>
                    <span className="text-rose-500">{splitStats.all.losses}L</span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">{splitStats.all.total} matches total</div>
                  {streak && (
                    <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black ${isWinStreak ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}>
                      <Flame className="w-3 h-3" /> {streak} streak
                    </div>
                  )}
                </div>
              </div>

              {/* Friendly */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-300 to-emerald-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-base shrink-0">🏸</div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Friendly</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums mb-1">
                    {splitStats.friendly.wins}W<span className="text-slate-300 dark:text-slate-600 font-light mx-1">–</span>{splitStats.friendly.losses}L
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-3">
                    {splitStats.friendly.total} matches · {splitStats.friendly.winPct}% win
                  </div>
                  {splitStats.friendly.recentForm.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[8px] uppercase tracking-[0.15em] font-black text-slate-400 dark:text-slate-500 mr-0.5">Form</span>
                      {splitStats.friendly.recentForm.map((r, i) => <FormPill key={i} result={r} index={i} />)}
                    </div>
                  )}
                  {splitStats.friendly.streak && (
                    <div className={`mt-2 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black ${splitStats.friendly.streak.startsWith('W') ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}>
                      {splitStats.friendly.streak}
                    </div>
                  )}
                </div>
              </div>

              {/* Tournament */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-300 to-orange-500" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-amber-500/[0.04] rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-base shrink-0">🏆</div>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">Tournament</span>
                  </div>
                  {splitStats.tournament.total > 0 ? (
                    <>
                      <div className="text-3xl font-black text-slate-900 dark:text-white tabular-nums mb-1">
                        {splitStats.tournament.wins}W<span className="text-slate-300 dark:text-slate-600 font-light mx-1">–</span>{splitStats.tournament.losses}L
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-3">
                        {splitStats.tournament.total} matches · {splitStats.tournament.winPct}% win
                      </div>
                      {splitStats.tournament.recentForm.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] uppercase tracking-[0.15em] font-black text-slate-400 dark:text-slate-500 mr-0.5">Form</span>
                          {splitStats.tournament.recentForm.map((r, i) => <FormPill key={i} result={r} index={i} />)}
                        </div>
                      )}
                      {splitStats.tournament.streak && (
                        <div className={`mt-2 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black ${splitStats.tournament.streak.startsWith('W') ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'}`}>
                          {splitStats.tournament.streak}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-400 dark:text-slate-500 italic">No tournament matches yet</div>
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

            {/* Player Attributes */}
            <motion.section variants={itemVariants}>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 shrink-0">
                  Player Attributes
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {([
                  { Icon: Crosshair, label: 'Playing Style', value: player.playingStyle, accent: 'from-amber-400 to-orange-500', iconBg: 'bg-amber-50 dark:bg-amber-950/30', iconColor: 'text-amber-500' },
                  { Icon: Zap, label: 'Signature Shot', value: player.favoriteShot, accent: 'from-rose-400 to-pink-500', iconBg: 'bg-rose-50 dark:bg-rose-950/20', iconColor: 'text-rose-500' },
                  { Icon: User, label: 'Dominant Hand', value: player.dominantHand, accent: 'from-blue-400 to-cyan-500', iconBg: 'bg-blue-50 dark:bg-blue-950/20', iconColor: 'text-blue-500' },
                  { Icon: Sparkles, label: 'Badminton Idol', value: player.favoriteIdol, accent: 'from-violet-400 to-purple-500', iconBg: 'bg-violet-50 dark:bg-violet-950/20', iconColor: 'text-violet-500' },
                ] as const).map(attr => (
                  <div key={attr.label}
                    className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
                    <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${attr.accent}`} />
                    <div className={`w-9 h-9 rounded-xl ${attr.iconBg} flex items-center justify-center mb-4`}>
                      <attr.Icon className={`w-4 h-4 ${attr.iconColor}`} />
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wider">{attr.label}</div>
                    <div className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 leading-snug">{attr.value}</div>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* Performance Breakdown */}
            {player.stats?.categoryStats && (
              <motion.section variants={itemVariants}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 shrink-0">
                    Performance Breakdown
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400" />
                  {player.stats.categoryStats.singles && (
                    <CategoryBar label="Singles" wins={player.stats.categoryStats.singles.wins}
                      losses={player.stats.categoryStats.singles.losses} color="bg-emerald-500" />
                  )}
                  {player.stats.categoryStats.doubles && (
                    <CategoryBar label="Doubles" wins={player.stats.categoryStats.doubles.wins}
                      losses={player.stats.categoryStats.doubles.losses} color="bg-blue-500" />
                  )}
                  {player.stats.categoryStats.mixed && (
                    <CategoryBar label="Mixed" wins={player.stats.categoryStats.mixed.wins}
                      losses={player.stats.categoryStats.mixed.losses} color="bg-violet-500" />
                  )}
                </div>
              </motion.section>
            )}

            {/* Match History */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold"></h3>
              {ownPlayerProfile && (
                <button
                  onClick={() => window.dispatchEvent(new Event('openLogMatchModal'))}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-2 px-4 rounded-xl shadow-md text-sm flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Swords className="w-4 h-4" />
                  Log a Match
                </button>
              )}
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
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-5">

            {/* Quote */}
            {player.quote && (
              <motion.div variants={itemVariants} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[1.75rem] blur opacity-20 group-hover:opacity-40 transition duration-500" />
                <div className="relative bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[1.75rem] p-7 shadow-lg overflow-hidden">
                  <Quote className="absolute -bottom-3 -right-3 w-24 h-24 text-white/[0.08] -rotate-12 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                  <div className="relative z-10">
                    <p className="text-base sm:text-lg font-serif italic text-white/85 leading-snug">"{player.quote}"</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bio */}
            {player.bio && (
              <motion.section variants={itemVariants}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-400 to-cyan-500" />
                <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-blue-400" /> About
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{player.bio}</p>
                {(player.coach || player.yearsPlaying != null || player.highestRanking != null) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    {player.coach && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Coach</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{player.coach}</span>
                      </div>
                    )}
                    {player.yearsPlaying != null && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Years Playing</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{player.yearsPlaying} yrs</span>
                      </div>
                    )}
                    {player.highestRanking != null && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Career-High Rank</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">#{player.highestRanking}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.section>
            )}

            {/* Career Record + Achievements */}
            <motion.section variants={itemVariants}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-orange-500" />
              <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> Career Record
              </h2>

              {/* W/L block */}
              <div className="mb-6 p-5 bg-slate-900 dark:bg-slate-950 rounded-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.08] to-transparent" />
                <div className="relative z-10">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">Overall W/L</div>
                  <div className="text-2xl font-black text-white">{player.winLossRecord}</div>
                </div>
              </div>

              {/* Achievements */}
              {validAchievements.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1.5">
                    <Medal className="w-3 h-3 text-emerald-500" /> Achievements
                  </h3>
                  <div className="relative ml-5 space-y-3">
                    <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-emerald-300 via-blue-300 to-amber-300 dark:from-emerald-700 dark:via-blue-700 dark:to-amber-700 rounded-full" />
                    {[...validAchievements]
                      .sort((a, b) => {
                        const yearA = parseInt(a.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                        const yearB = parseInt(b.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                        return yearA !== yearB ? yearB - yearA : a.localeCompare(b);
                      })
                      .map((ach, idx) => {
                        const lower = ach.toLowerCase();
                        const isGold = lower.includes("winner") || lower.includes("champion") || lower.includes("1st") || lower.includes("gold");
                        const isSilver = lower.includes("runner-up") || lower.includes("2nd") || lower.includes("silver");
                        const isBronze = lower.includes("semifinalist") || lower.includes("bronze") || lower.includes("3rd");
                        const icon = isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : '⭐';
                        const bg = isGold
                          ? 'bg-amber-50 dark:bg-amber-950/30 ring-amber-200 dark:ring-amber-900/40'
                          : isSilver
                          ? 'bg-slate-50 dark:bg-slate-800 ring-slate-200 dark:ring-slate-700'
                          : isBronze
                          ? 'bg-orange-50 dark:bg-orange-950/30 ring-orange-200 dark:ring-orange-900/40'
                          : 'bg-emerald-50 dark:bg-emerald-950/30 ring-emerald-200 dark:ring-emerald-900/40';
                        return (
                          <div key={idx} className="relative flex gap-3 items-start">
                            <div className={`relative -ml-[18px] mt-0.5 shrink-0 w-8 h-8 rounded-full ${bg} ring-2 flex items-center justify-center shadow-sm`}>
                              <span className="text-xs">{icon}</span>
                            </div>
                            <div className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-snug">{ach}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Tournament history */}
              {player.tournamentHistory.length > 0 && (
                <div className={validAchievements.length > 0 ? 'pt-5 border-t border-slate-100 dark:border-slate-800' : ''}>
                  <h3 className="text-[9px] uppercase tracking-[0.18em] font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-blue-500" /> Tournaments
                  </h3>
                  <div className="relative ml-5 space-y-2.5">
                    <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-blue-300 to-indigo-300 dark:from-blue-700 dark:to-indigo-700 rounded-full" />
                    {[...player.tournamentHistory]
                      .sort((a, b) => {
                        const yearA = parseInt(a.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                        const yearB = parseInt(b.match(/\b(20\d{2})\b/)?.[1] || "0", 10);
                        return yearA !== yearB ? yearB - yearA : a.localeCompare(b);
                      })
                      .map((t, idx) => (
                        <div key={idx} className="relative flex gap-3 items-center">
                          <div className="relative -ml-[11px] shrink-0 w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-200 dark:ring-blue-900/40 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          </div>
                          <div className="flex-1 py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/40 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{t}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </motion.section>

            {/* Badges and ELO History Section */}
            {eloHistoryData.length > 1 && (
              <motion.section variants={itemVariants} className="mt-6 md:mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <Badges matches={liveMatches.filter(m => m.status === "confirmed")} playerId={id!} />
                    <ActivityHeatmap matches={liveMatches.filter(m => m.status === "confirmed")} />
                  </div>
                  <div>
                    <PlayerRadarChart playerId={id!} />
                    <EloHistoryChart playerId={id!} currentElo={player.elo_rating || 1200} />
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 sm:p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 mt-6 md:mt-8">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> ELO Progression
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={eloHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorElo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} minTickGap={30} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', background: 'var(--tw-colors-slate-900)' }}
                          itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                        />
                        <Line type="monotone" dataKey="elo" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.section>
            )}


            {/* Frequent Partners */}
            {player.frequentPartners && player.frequentPartners.length > 0 && (
              <motion.section variants={itemVariants}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-400 to-emerald-500" />
                <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-emerald-500" /> Frequent Partners
                </h2>
                <div className="space-y-2">
                  {player.frequentPartners.map((p, idx) => (
                    <button key={idx}
                      onClick={() => p.id && setLocation(`/player/${p.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-700/50 transition-all group text-left">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                          {p.name.split(' ').map((s: string) => s[0]).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {p.matchesTogether != null && <>{p.matchesTogether} matches</>}
                            {p.winRate != null && <> · {p.winRate}% win rate</>}
                          </div>
                        </div>
                      </div>
                      {p.id && <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />}
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {/* H2H vs logged-in user */}
            {h2hRecord && ownPlayerProfile && (
              <motion.section variants={itemVariants}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-400 to-pink-500" />
                <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <Swords className="w-3.5 h-3.5 text-rose-500" /> You vs {player.fullName.split(' ')[0]}
                </h2>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-5xl font-black text-emerald-500 tabular-nums">{h2hRecord.wins}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mt-1.5">You</div>
                  </div>
                  <div className="text-2xl font-black text-slate-200 dark:text-slate-700">VS</div>
                  <div className="text-center">
                    <div className="text-5xl font-black text-rose-500 tabular-nums">{h2hRecord.losses}</div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 mt-1.5">{player.fullName.split(' ')[0]}</div>
                  </div>
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-4">
                  {h2hRecord.wins + h2hRecord.losses} match{h2hRecord.wins + h2hRecord.losses !== 1 ? 'es' : ''} total
                </p>
              </motion.section>
            )}

          </div>
        </div>

        {/* Media Showcase */}
        {player.stats?.media && player.stats.media.length > 0 && (
          <motion.section variants={itemVariants} className="mt-4 pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500 shrink-0">
                Media Showcase
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {player.stats.media.some(m => m.type === "image") && (
                <div>
                  <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                    <Image className="w-4 h-4 text-emerald-500" /> Game Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {player.stats.media.filter(m => m.type === "image").map((img, idx) => (
                      <div key={idx} onClick={() => setLightboxImage(img.url)}
                        className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                        <img loading="lazy" src={img.url} alt={img.caption || "Game Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                          <span className="text-white text-xs font-bold line-clamp-2">{img.caption || "View"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {player.stats.media.some(m => m.type === "video") && (
                <div>
                  <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                    <Video className="w-4 h-4 text-rose-500" /> Video Highlights
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {player.stats.media.filter(m => m.type === "video").map((vid, idx) => {
                      const yId = getYouTubeId(vid.url);
                      const thumb = yId ? `https://img.youtube.com/vi/${yId}/mqdefault.jpg` : '';
                      return (
                        <div key={idx} onClick={() => yId && setActiveVideoId(yId)}
                          className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 bg-slate-900 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                          {thumb && <img loading="lazy" src={thumb} alt={vid.caption || "Video"} className="w-full h-full object-cover opacity-75 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />}
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="w-10 h-10 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex items-end p-3">
                            <span className="text-white text-xs font-bold line-clamp-2">{vid.caption || "Watch"}</span>
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
      </motion.div>

      {/* ─── Photo Lightbox ─── */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}>
          <button className="absolute top-6 right-6 text-white hover:text-slate-300 text-3xl font-light">×</button>
          <img loading="lazy" src={lightboxImage} alt="Fullscreen" className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl" />
        </div>
      )}

      {/* ─── Avatar Modal ─── */}
      <AnimatePresence>
        {isAvatarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsAvatarOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 cursor-zoom-out">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.2)] bg-slate-900"
              onClick={e => e.stopPropagation()}>
              <img src={player.avatar} alt={player.fullName} className="max-w-[85vw] max-h-[85vh] object-cover" />
              <button onClick={() => setIsAvatarOpen(false)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-light transition">
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Log Match Modal ─── */}
      {isLogMatchOpen && ownPlayerProfile && (
        <LogMatchModal
          isOpen={isLogMatchOpen}
          onClose={() => setIsLogMatchOpen(false)}
          currentUser={ownPlayerProfile}
          otherPlayers={allPlayers.filter(p => p.id !== ownPlayerProfile.id)}
          defaultOpponentId={player?.id}
          onSuccess={() => {}}
          userEmail={currentUser?.email}
        />
      )}

      {/* ─── YouTube Player Modal ─── */}
      {activeVideoId && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveVideoId(null)}>
          <button className="absolute top-6 right-6 text-white text-3xl font-light">×</button>
          <div className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={e => e.stopPropagation()}>
            <iframe src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
              title="YouTube player" frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen className="w-full h-full" />
          </div>
        </div>
      )}
    </div>
  );
}
