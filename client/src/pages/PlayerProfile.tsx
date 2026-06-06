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
import { LoadingScreen, FormPill, CircularProgress, KPI, CategoryBar } from "@/components/player-profile/PlayerProfileWidgets";
import { toast } from "sonner";

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

export default function PlayerProfile() {
  const { id } = useParams<{id: string}>();
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const { session: authSession, user: currentUser, profile: ownPlayerProfile, isAdmin } = useAuth();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [eloRank, setEloRank] = useState<number | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [rawMatches, setRawMatches] = useState<any[]>([]); // unfiltered matches — filtered into liveMatches reactively
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
      winLossRecord: data.win_loss_record || `${data.stats?.wins || 0}W - ${data.stats?.losses || 0}L`,
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
      toast.info("Match Rejected.");
      if (ownPlayerProfile) fetchPendingMatches(ownPlayerProfile.id);
    } catch (e: any) { toast.error("Error rejecting match", { description: e.message }); }
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
     Fires ONLY when the player `id` changes — never on auth changes.
     Uses AbortController for clean cancellation on unmount/re-render.
     A 15-second failsafe prevents permanent loading on slow networks.
     ══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!id) { setLoading(false); return; }

    const controller = new AbortController();
    const { signal } = controller;

    // Failsafe: force-clear loading if fetch hangs for 15 seconds
    const failsafe = setTimeout(() => {
      if (!signal.aborted) {
        console.warn("[PlayerProfile] Effect 1 failsafe — clearing loading state.");
        setLoading(false);
      }
    }, 15_000);

    (async () => {
      setLoading(true);
      try {
        // Fire all 3 requests in parallel — zero waterfalls
        const [playerRes, matchesRes, eloRes] = await Promise.all([
          supabase.from("players").select("*")
            .eq("id", id).maybeSingle(),
          fetchProfileMatches(id, signal),
          supabase.from("players").select("id, elo_rating")
            .is("deleted_at", null)
            .order("elo_rating", { ascending: false })
            ,
        ]);

        if (signal.aborted) return;

        // Player profile
        if (playerRes.error) {
          console.error("Player fetch error:", playerRes.error.message);
          setPlayer(null);
        } else {
          setPlayer(playerRes.data ? formatPlayerData(playerRes.data) : null);
        }

        // Store raw matches — filtered into liveMatches by a separate reactive effect
        setRawMatches(matchesRes.data || []);

        // ELO rank
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

  /* ── Derive liveMatches from rawMatches + ownPlayerProfile (no network, no spinner) ── */
  useEffect(() => {
    setLiveMatches(visibleMatchesForViewer(rawMatches, ownPlayerProfile?.id));
  }, [rawMatches, ownPlayerProfile?.id]);

  /* ══════════════════════════════════════════════════════════════════
     EFFECT 2: Auth — trigger pending matches & all players load.
     Independent from Effect 1. Never touches the `loading` flag.
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
    } catch { /* silent — don't disturb the user */ }
  }, [id, ownPlayerProfile?.id]);



  // H2H record vs logged-in user
  useEffect(() => {
    if (!ownPlayerProfile || !id || ownPlayerProfile.id === id || liveMatches.length === 0) return;
    const h2h = liveMatches.filter(
      (m) =>
        (m.player1_id === ownPlayerProfile.id && m.player2_id === id) ||
        (m.player1_id === id && m.player2_id === ownPlayerProfile.id)
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

  // Derive a computed win % if not provided explicitly
  const winPct = useMemo(() => {
    if (!player) return 0;
    if (player.stats?.winPercentage != null) return player.stats.winPercentage;
    const w = player.stats?.wins ?? 0;
    const l = player.stats?.losses ?? 0;
    if (w + l === 0) {
      // Try to parse "24W - 6L" record as a fallback
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

  // ---- BWF-style Split Stats (Friendly vs Tournament) ----
  const splitStats = useMemo(() => {
    if (!id) return null;
    const confirmed = liveMatches.filter(m => m.status === "confirmed");
    const friendly = confirmed.filter(m => m.is_friendly !== false);
    const tournament = confirmed.filter(m => m.is_friendly === false);

    const computeStats = (matches: any[]) => {
      const wins = matches.filter(m => m.winner_id === id).length;
      const losses = matches.length - wins;
      const winPct = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

      // Recent form (last 5)
      const recentForm = matches.slice(0, 5).map(m => m.winner_id === id ? "W" : "L") as ("W" | "L")[];

      // Current streak
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
      friendly: computeStats(friendly),
      tournament: computeStats(tournament),
      all: computeStats(confirmed),
    };
  }, [liveMatches, id]);

  if (loading) {
    return (
      <LoadingScreen />
    );
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

  // isAdmin is now pulled directly from useAuth()

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: player.fullName, url }); } catch { }
    } else {
      try { await navigator.clipboard.writeText(url); toast.success("Profile link copied!"); } catch { }
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
    
    // RLS allows users to update their own profile
    const { error } = await supabase
      .from('players')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', player.id);
      
    if (error) {
      alert("Failed to delete profile: " + error.message);
      return;
    }
    
    alert("Your profile has been deleted.");
    await supabase.auth.signOut();
    setLocation('/join');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0B1121] pb-24 selection:bg-emerald-500/30 font-sans">

      {/* ============== Hero Banner ============== */}
      <div className="h-72 md:h-96 w-full relative overflow-hidden bg-slate-900">
        <img
          src={player.avatar}
          alt="Banner background"
          className="absolute inset-0 w-full h-full object-cover opacity-30 blur-2xl transform scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] dark:from-[#0B1121] via-transparent to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/40 to-teal-900/40 mix-blend-overlay" />

        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/30 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-10 right-10 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px]"
        />

        {/* Back button */}
        <button
          onClick={() => setLocation('/players')}
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Right-side actions — flex row so they never overlap */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Admin: delete this player */}
          {isAdmin && player && currentUser?.id !== player.userId && (
            <button
              onClick={handleAdminDelete}
              className="p-2 rounded-full bg-rose-600/80 backdrop-blur-md border border-rose-500 text-white hover:bg-rose-700 transition shadow-lg shadow-rose-500/25"
              title="Admin: Delete player"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Challenge / Log Match (other player's profile, logged in with own profile) */}
          {currentUser && player && currentUser.id !== player.userId && ownPlayerProfile && (
            <button
              onClick={() => setIsLogMatchOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-blue-600/80 backdrop-blur-md border border-blue-500 text-white text-sm font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-500/25"
            >
              <Swords className="w-4 h-4" />
              <span className="hidden sm:inline">Log Match</span>
            </button>
          )}

          {/* Own profile: Edit Profile + Log Out */}
          {currentUser && player && currentUser.id === player.userId && (
            <>
              <button
                onClick={() => setLocation('/profile/setup')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-600/80 backdrop-blur-md border border-emerald-500 text-white text-sm font-semibold hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/25"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={handleSelfDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-600/80 backdrop-blur-md border border-rose-500 text-white text-sm font-semibold hover:bg-rose-700 transition shadow-lg shadow-rose-500/25"
                title="Delete your profile"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Delete</span>
              </button>
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to sign out?")) {
                    await supabase.auth.signOut();
                    setLocation('/join');
                  }
                }}
                className="p-2 rounded-full bg-rose-600/80 backdrop-blur-md border border-rose-500 text-white hover:bg-rose-700 transition shadow-lg shadow-rose-500/25"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition"
            title="Share profile"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 sm:-mt-48 relative z-20"
      >


        {/* ============== Identity Card ============== */}
        <motion.div
          variants={itemVariants}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-white/50 dark:border-slate-700/50 p-6 sm:p-10 mb-8 overflow-hidden relative group"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-blue-500" />

          {/* Pending Match Verification Banner (own profile only) */}
          {currentUser && player && currentUser.id === player.userId && pendingMatches.length > 0 && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-5 shadow-md">
              <h3 className="text-amber-800 dark:text-amber-400 font-black mb-4 flex items-center gap-2 text-sm">
                <Swords className="w-5 h-5" /> Pending Match Verifications ({pendingMatches.length})
              </h3>
              <div className="space-y-3">
                {pendingMatches.map(m => (
                  <div key={m.id} className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/70 dark:bg-black/20 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-center sm:text-left">
                      <span className="font-bold">{m.player1?.full_name}</span>
                      <span className="text-amber-600 dark:text-amber-500 font-black italic mx-2">VS</span>
                      <span className="font-bold">{m.player2?.full_name}</span>
                      <div className="text-xs text-slate-500 mt-1">
                        Score: <span className="font-bold">{m.score}</span>
                        {" • Winner: "}
                        <span className="font-bold text-emerald-600">
                          {m.winner_id === m.player1_id ? m.player1?.full_name : m.player2?.full_name}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleConfirmMatch(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                      <button
                        onClick={() => handleRejectMatch(m.id)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-8">
            {/* Avatar */}
            <div className="relative z-10 shrink-0">
              <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full blur-lg opacity-40 group-hover:opacity-70 transition duration-700" />
              <img
                src={player.avatar}
                alt={player.fullName}
                onClick={() => setIsAvatarOpen(true)}
                className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-2xl transform group-hover:scale-105 transition duration-500 cursor-zoom-in"
              />
              {player.currentRanking != null && (
                <div className="absolute -bottom-2 -right-2 w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex flex-col items-center justify-center shadow-xl shadow-amber-500/40 border-2 border-white dark:border-slate-900">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/90 leading-none">Rank</span>
                  <span className="text-lg font-black text-white leading-none">#{player.currentRanking}</span>
                </div>
              )}
            </div>

            {/* Identity text */}
            <div className="flex-1 text-center sm:text-left relative z-10 pb-2 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 justify-center sm:justify-start">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                  {player.fullName}
                </h1>
                {player.nickname && (
                  <span className="px-4 py-1.5 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20 text-emerald-800 dark:text-emerald-300 rounded-full text-sm font-bold tracking-widest uppercase border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
                    "{player.nickname}"
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>{player.department}</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span>Class of {player.joinedYear}</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span>{player.playingLevel}</span>
                </div>
                {player.nationality && (
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <Hash className="w-4 h-4 text-indigo-500" />
                    <span>{player.nationality}{player.homeState ? ` · ${player.homeState}` : ''}</span>
                  </div>
                )}
                {player.height && (
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <Ruler className="w-4 h-4 text-violet-500" />
                    <span>{player.height}</span>
                  </div>
                )}
                {/* {player.elo_rating != null && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400/20 to-orange-500/20 px-3 py-1.5 rounded-lg border border-amber-300/30 text-amber-700 dark:text-amber-400 font-black">
                    <Trophy className="w-4 h-4" />
                    <span>{player.elo_rating} ELO</span>
                  </div>
                )}
                {eloRank != null && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-400/20 to-teal-500/20 px-3 py-1.5 rounded-lg border border-emerald-300/30 text-emerald-700 dark:text-emerald-400 font-black">
                    <Hash className="w-4 h-4" />
                    <span>Club Rank #{eloRank}</span>
                  </div>
                )} */}
              </div>

              {/* Edit Profile button inline for mobile */}
              {currentUser && currentUser.id === player.userId && (
                <div className="mt-4 flex justify-center sm:justify-start">
                  <button
                    onClick={() => setLocation('/profile/setup')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold uppercase tracking-wider transition border border-slate-200 dark:border-slate-750 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-spin" style={{ animationDuration: '4s' }} /> Edit Your Profile
                  </button>
                </div>
              )}

              {/* Recent form */}
              {player.recentForm && player.recentForm.length > 0 && (
                <div className="mt-5 flex items-center gap-3 justify-center sm:justify-start">
                  <span className="text-xs uppercase tracking-widest font-black text-slate-500 dark:text-slate-400">Recent Form</span>
                  <div className="flex gap-1.5">
                    {player.recentForm.slice(0, 5).map((r, i) => (
                      <FormPill key={i} result={r} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Profile completeness (own profile only) */}
              {currentUser && currentUser.id === player.userId && (
                <div className="mt-5 space-y-1.5 max-w-xs">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-400">Profile completeness</span>
                    <span className={profileCompleteness === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {profileCompleteness}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${profileCompleteness}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    />
                  </div>
                  {profileCompleteness < 100 && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Add more details to complete your profile
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ============== BWF-Style Split Stats ============== */}
        {splitStats && (splitStats.all.total > 0) && (
          <motion.div variants={itemVariants} className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Friendly Stats Card */}
              <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-emerald-100 dark:border-emerald-700/30 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl bg-emerald-500/10" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🏸</span>
                    <h3 className="text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Friendly Matches</h3>
                  </div>
                  <div className="flex items-center gap-6 mb-4">
                    <div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white">{splitStats.friendly.wins}W - {splitStats.friendly.losses}L</div>
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{splitStats.friendly.total} matches · {splitStats.friendly.winPct}% win rate</div>
                    </div>
                    {splitStats.friendly.streak && (
                      <div className={`px-3 py-1.5 rounded-xl text-sm font-black ${splitStats.friendly.streak.startsWith("W") ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"}`}>
                        {splitStats.friendly.streak}
                      </div>
                    )}
                  </div>
                  {splitStats.friendly.recentForm.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mr-1">Form</span>
                      {splitStats.friendly.recentForm.map((r, i) => (
                        <FormPill key={`fr-${i}`} result={r} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tournament Stats Card */}
              <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-amber-100 dark:border-amber-700/30 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl bg-amber-500/10" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🏆</span>
                    <h3 className="text-sm font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Tournament Matches</h3>
                  </div>
                  {splitStats.tournament.total > 0 ? (
                    <>
                      <div className="flex items-center gap-6 mb-4">
                        <div>
                          <div className="text-3xl font-black text-slate-900 dark:text-white">{splitStats.tournament.wins}W - {splitStats.tournament.losses}L</div>
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{splitStats.tournament.total} matches · {splitStats.tournament.winPct}% win rate</div>
                        </div>
                        {splitStats.tournament.streak && (
                          <div className={`px-3 py-1.5 rounded-xl text-sm font-black ${splitStats.tournament.streak.startsWith("W") ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"}`}>
                            {splitStats.tournament.streak}
                          </div>
                        )}
                      </div>
                      {splitStats.tournament.recentForm.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mr-1">Form</span>
                          {splitStats.tournament.recentForm.map((r, i) => (
                            <FormPill key={`tn-${i}`} result={r} index={i} />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-400 dark:text-slate-500 italic">No tournament matches logged yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Overall Summary Bar */}
            <div className="mt-4 bg-white dark:bg-slate-800/80 rounded-2xl p-4 shadow-md border border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CircularProgress value={splitStats.all.winPct} size={56} stroke={5} />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">{splitStats.all.wins}W - {splitStats.all.losses}L</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <KPI icon={Trophy} label="Titles Won" value={player.stats?.titlesWon ?? "—"} sub={player.stats?.runnerUp != null ? `${player.stats.runnerUp} runner-up` : undefined} accent="bg-amber-500" />
                <KPI icon={BarChart3} label="Total Matches" value={splitStats.all.total || "—"} accent="bg-blue-500" />
              </div>
            </div>
          </motion.div>
        )}

        {/* ============== Main grid ============== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ============== LEFT COLUMN ============== */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-10">

            {/* Player Attributes */}
            <motion.section variants={itemVariants}>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
                <Swords className="w-6 h-6 text-emerald-500" />
                Player Attributes
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-4">
                    <Crosshair className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Playing Style</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{player.playingStyle}</div>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mb-4">
                    <Zap className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Signature Shot</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{player.favoriteShot}</div>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mb-4">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Dominant Hand</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{player.dominantHand}</div>
                </div>

                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center mb-4">
                    <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">Badminton Idol</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{player.favoriteIdol}</div>
                </div>
              </div>
            </motion.section>

            {/* Performance Breakdown */}
            {player.stats?.categoryStats && (
              <motion.section variants={itemVariants}>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                  Performance Breakdown
                </h2>
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 space-y-6">
                  {player.stats.categoryStats.singles && (
                    <CategoryBar label="Singles" wins={player.stats.categoryStats.singles.wins}
                      losses={player.stats.categoryStats.singles.losses} color="bg-emerald-500" />
                  )}
                  {player.stats.categoryStats.doubles && (
                    <CategoryBar label="Doubles" wins={player.stats.categoryStats.doubles.wins}
                      losses={player.stats.categoryStats.doubles.losses} color="bg-blue-500" />
                  )}
                  {player.stats.categoryStats.mixed && (
                    <CategoryBar label="Mixed Doubles" wins={player.stats.categoryStats.mixed.wins}
                      losses={player.stats.categoryStats.mixed.losses} color="bg-violet-500" />
                  )}
                </div>
              </motion.section>
            )}

            {/* ============== BWF-Style Match History ============== */}
            <MatchHistorySection
              id={id}
              liveMatches={liveMatches}
              ownPlayerProfile={ownPlayerProfile}
              handleWithdrawMatch={handleWithdrawMatch}
            />

            {/* Equipment Arsenal */}
            <EquipmentArsenalSection player={player} />

            {/* Career Highlights Timeline */}
            <CareerHighlightsSection player={player} />
          </div>

          {/* ============== RIGHT COLUMN ============== */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-8">

            {/* Quote */}
            {player.quote && (
              <motion.div variants={itemVariants} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition duration-500" />
                <div className="relative bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2rem] p-8 shadow-xl overflow-hidden">
                  <Quote className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10 -rotate-12 transform group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                    <p className="text-xl sm:text-2xl font-serif italic text-white/90 leading-snug">"{player.quote}"</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Bio */}
            {player.bio && (
              <motion.section variants={itemVariants}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 text-blue-500" /> About
                </h2>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{player.bio}</p>
                {(player.coach || player.yearsPlaying != null || player.highestRanking != null) && (
                  <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700/50 grid grid-cols-1 gap-3 text-sm">
                    {player.coach && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Coach</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-right">{player.coach}</span>
                      </div>
                    )}
                    {player.yearsPlaying != null && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Years Playing</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{player.yearsPlaying} yrs</span>
                      </div>
                    )}
                    {player.highestRanking != null && (
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Career-High Rank</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">#{player.highestRanking}</span>
                      </div>
                    )}
                  </div>
                )}
              </motion.section>
            )}

            {/* Career Record + Achievements */}
            <motion.section
              variants={itemVariants}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-8 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50"
            >
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-8">
                <Trophy className="w-6 h-6 text-amber-500" /> Career Record
              </h2>

              <div className="mb-8 relative p-6 bg-slate-900 dark:bg-slate-950 rounded-3xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />
                <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-24 h-24 bg-teal-500/20 blur-xl rounded-full" />
                <div className="relative z-10">
                  <div className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-2">Overall Win/Loss</div>
                  <div className="text-4xl font-black text-white tracking-tight">{player.winLossRecord}</div>
                </div>
              </div>

              {validAchievements.length > 0 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2">
                      <Medal className="w-4 h-4 text-emerald-500" /> Timeline of Achievements
                    </h3>
                    <div className="space-y-2">
                      {validAchievements.map((ach, idx) => {
                        const lower = ach.toLowerCase();
                        const icon = lower.includes("winner") || lower.includes("champion") || lower.includes("1st") || lower.includes("gold")
                          ? "🥇"
                          : lower.includes("runner-up") || lower.includes("2nd") || lower.includes("silver")
                          ? "🥈"
                          : lower.includes("semifinalist") || lower.includes("bronze") || lower.includes("3rd")
                          ? "🥉"
                          : "⭐";
                        return (
                          <div key={idx} className="flex items-start gap-2.5 py-2 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                            <span className="text-base shrink-0 mt-0.5">{icon}</span>
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-snug">{ach}</span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              )}

              {player.tournamentHistory.length > 0 && (
                <div className="pt-8 mt-8 border-t border-slate-100 dark:border-slate-700/50">
                  <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Tournaments Played
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {player.tournamentHistory.map((tourney, idx) => (
                      <span key={idx} className="text-xs font-bold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-default">
                        {tourney}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>

            {/* Frequent Partners */}
            {player.frequentPartners && player.frequentPartners.length > 0 && (
              <motion.section variants={itemVariants}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-5">
                  <Users className="w-5 h-5 text-emerald-500" /> Frequent Partners
                </h2>
                <div className="space-y-3">
                  {player.frequentPartners.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => p.id && setLocation(`/player/${p.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-slate-100 dark:border-slate-700/50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                          {p.name.split(" ").map(s => s[0]).join("").slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{p.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {p.matchesTogether != null && <>{p.matchesTogether} matches</>}
                            {p.winRate != null && <> · {p.winRate}% win rate</>}
                          </div>
                        </div>
                      </div>
                      {p.id && <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Head-to-Head vs logged-in user */}
            {h2hRecord && ownPlayerProfile && (
              <motion.section variants={itemVariants}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-5">
                  <Swords className="w-5 h-5 text-rose-500" /> Head-to-Head vs You
                </h2>
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{h2hRecord.wins}</div>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">Your Wins</div>
                  </div>
                  <div className="text-3xl font-black text-slate-300 dark:text-slate-600">–</div>
                  <div className="text-center">
                    <div className="text-4xl font-black text-rose-500">{h2hRecord.losses}</div>
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mt-1">Their Wins</div>
                  </div>
                </div>
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-4">
                  {h2hRecord.wins + h2hRecord.losses} match{h2hRecord.wins + h2hRecord.losses !== 1 ? "es" : ""} played
                </p>
              </motion.section>
            )}

            {/* Social */}
            {player.social && player.social.instagram && (
              <motion.section variants={itemVariants}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-[2rem] p-6 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
                <h2 className="text-xs uppercase tracking-widest font-black text-slate-500 dark:text-slate-400 mb-4">Connect</h2>
                <div className="flex flex-wrap gap-2">
                  {player.social.instagram && (
                    <a
                      href={`https://instagram.com/${player.social.instagram.replace('@', '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/40 transition-shadow"
                    >
                      <Instagram className="w-4 h-4" /> {player.social.instagram}
                      <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </motion.section>
            )}

          </div>
        </div>

        {/* Media Showcase */}
        {player.stats?.media && player.stats.media.length > 0 && (
          <motion.section variants={itemVariants} className="mt-12 pt-12 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-3xl font-black text-slate-850 dark:text-slate-100 mb-8 flex items-center gap-3 ml-2 font-sans">
              <Play className="w-8 h-8 text-rose-500 fill-rose-500" />
              Media Showcase
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Game Photos Grid */}
              {player.stats.media.some(m => m.type === "image") && (
                <div className="space-y-4">
                  <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2 font-sans">
                    <Image className="w-5 h-5 text-emerald-500" /> Game Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {player.stats.media.filter(m => m.type === "image").map((img, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setLightboxImage(img.url)}
                        className="group relative aspect-video rounded-3xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 shadow-md hover:-translate-y-1 hover:shadow-lg transition-all duration-305"
                      >
                        <img loading="lazy" src={img.url} alt={img.caption || "Game Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                          <span className="text-white text-xs font-bold leading-tight line-clamp-2">{img.caption || "Zoom View"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube Match Videos Grid */}
              {player.stats.media.some(m => m.type === "video") && (
                <div className="space-y-4">
                  <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-2 font-sans">
                    <Video className="w-5 h-5 text-red-500" /> Video Highlights
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {player.stats.media.filter(m => m.type === "video").map((vid, idx) => {
                      const yId = getYouTubeId(vid.url);
                      const thumbUrl = yId ? `https://img.youtube.com/vi/${yId}/mqdefault.jpg` : "";
                      return (
                        <div 
                          key={idx}
                          onClick={() => yId && setActiveVideoId(yId)}
                          className="group relative aspect-video rounded-3xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 shadow-md hover:-translate-y-1 hover:shadow-lg transition-all duration-305 bg-slate-900"
                        >
                          {thumbUrl ? (
                            <img loading="lazy" src={thumbUrl} alt={vid.caption || "Video Thumbnail"} className="w-full h-full object-cover opacity-75 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-12 h-12 text-slate-600" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg group-hover:bg-red-500 group-hover:scale-110 transition-all duration-300">
                              <Play className="w-5 h-5 fill-white ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex items-end p-4">
                            <span className="text-white text-xs font-bold leading-tight line-clamp-2">{vid.caption || "Watch Video"}</span>
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

      {/* Photo Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button className="absolute top-6 right-6 text-white hover:text-slate-350 text-3xl font-light">×</button>
          <img loading="lazy" src={lightboxImage} alt="Fullscreen View" className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl" />
        </div>
      )}

      {/* Avatar Modal */}
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-full sm:rounded-[3rem] border-4 border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.3)] bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={player.avatar}
                alt={player.fullName}
                className="max-w-[85vw] max-h-[85vh] object-cover"
              />
              <button
                onClick={() => setIsAvatarOpen(false)}
                className="absolute top-6 right-6 bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-light transition"
              >
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Log Match Modal (challenge another player) */}
      {isLogMatchOpen && ownPlayerProfile && (
        <LogMatchModal
          isOpen={isLogMatchOpen}
          onClose={() => setIsLogMatchOpen(false)}
          currentUser={ownPlayerProfile}
          otherPlayers={allPlayers.filter((p) => p.id !== ownPlayerProfile.id)}
          defaultOpponentId={player?.id}
          onSuccess={() => {}}
          userEmail={currentUser?.email}
        />
      )}

      {/* YouTube Video Player Modal */}
      {activeVideoId && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setActiveVideoId(null)}
        >
          <button className="absolute top-6 right-6 text-white hover:text-slate-350 text-3xl font-light">×</button>
          <div 
            className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe 
              src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}



