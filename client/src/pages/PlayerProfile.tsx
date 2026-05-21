import { useParams, useLocation } from "wouter";
import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, User, Activity, MapPin, Calendar, Swords, Zap,
  Target, Dna, Crosshair, Sparkles, Quote, Medal, ArrowLeft,
  TrendingUp, Award, Flame, BarChart3, Share2, Trash2,
  Instagram, Mail, Users, Star, Hash, Ruler, BookOpen,
  ChevronRight, Footprints, Shirt, ArrowUpRight, Clock, LogOut,
  CheckCircle, XCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import LogMatchModal from "@/components/LogMatchModal";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { isAdminEmail } from "@/lib/admin";

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

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

const CircularProgress = ({ value, size = 72, stroke = 7 }: { value: number; size?: number; stroke?: number; }) => {
  const radius = (size - stroke) / 2;
  const c = radius * 2 * Math.PI;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor"
          strokeWidth={stroke} fill="none" className="text-slate-200 dark:text-slate-700" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="url(#progressGrad)" strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-black text-slate-900 dark:text-white">{Math.round(value)}%</span>
      </div>
    </div>
  );
};

const FormPill = ({ result, index }: { result: MatchResult; index: number; }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.4 + index * 0.07, type: "spring", stiffness: 220 }}
    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-md
      ${result === "W"
        ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/40"
        : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/40"}`}
  >
    {result}
  </motion.div>
);

const CategoryBar = ({ label, wins, losses, color }: { label: string; wins: number; losses: number; color: string; }) => {
  const total = wins + losses;
  const winPct = total ? (wins / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">({total} matches)</span>
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {wins}<span className="text-slate-400 font-normal">W</span> – {losses}<span className="text-slate-400 font-normal">L</span>
        </div>
      </div>
      <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${winPct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - winPct}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
          className="h-full bg-slate-300 dark:bg-slate-700"
        />
      </div>
    </div>
  );
};

const KPI = ({
  icon: Icon, label, value, sub, accent
}: { icon: any; label: string; value: string | number; sub?: string; accent: string; }) => (
  <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden group">
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${accent}`} />
    <div className="relative z-10">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accent} bg-opacity-15`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{value}</div>
      {sub && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{sub}</div>}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function PlayerProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [eloRank, setEloRank] = useState<number | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [h2hRecord, setH2hRecord] = useState<{ wins: number; losses: number } | null>(null);
  const [ownPlayerProfile, setOwnPlayerProfile] = useState<{ id: string; full_name: string; avatar_url?: string; gender?: string } | null>(null);
  const [allPlayers, setAllPlayers] = useState<{ id: string; full_name: string; avatar_url?: string; gender?: string }[]>([]);
  const [isLogMatchOpen, setIsLogMatchOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<any[]>([]);
  const [matchHistoryFilter, setMatchHistoryFilter] = useState<"all" | "friendly" | "tournament">("all");

  const fetchPendingMatches = async (profileId: string) => {
    const { data } = await supabase
      .from("matches")
      .select("*, player1:players!player1_id(full_name), player2:players!player2_id(full_name)")
      .eq("status", "pending")
      .neq("submitted_by", profileId)
      .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`);
    setPendingMatches(data || []);
  };

  const handleConfirmMatch = async (matchId: string) => {
    try {
      const { data, error } = await supabase.rpc("confirm_friendly_match", { match_uuid: matchId, confirmer_id: ownPlayerProfile?.id });
      if (error) throw error;
      alert(`Match Confirmed! Elo Ratings Updated.\nYour Elo Change: ${data.p1_elo_change || data.p2_elo_change}`);
      fetchPendingMatches(ownPlayerProfile!.id);
    } catch (e: any) {
      alert("Error confirming match: " + e.message);
    }
  };

  const handleRejectMatch = async (matchId: string) => {
    try {
      const { error } = await supabase.rpc("reject_friendly_match", { match_uuid: matchId, rejecter_id: ownPlayerProfile?.id });
      if (error) throw error;
      alert("Match Rejected.");
      fetchPendingMatches(ownPlayerProfile!.id);
    } catch (e: any) {
      alert("Error rejecting match: " + e.message);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Fetch logged-in user session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setCurrentUser(session.user);
        const { data: ownProfile } = await supabase
          .from("players")
          .select("id, full_name, avatar_url, gender")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (ownProfile) setOwnPlayerProfile(ownProfile);
        const { data: everyone } = await supabase
          .from("players")
          .select("id, full_name, avatar_url, gender")
          .is("deleted_at", null);
        if (everyone) setAllPlayers(everyone);
      }
    }).catch(err => {
      console.error("Auth session error:", err);
    });

    // Fetch pending matches for own profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: ownProfile } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (ownProfile) fetchPendingMatches(ownProfile.id);
      }
    }).catch(() => {});

    async function fetchPlayer() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("players")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Error fetching player:", error);
          setPlayer(null);
        } else if (data) {
          // Map database snake_case columns back to camelCase frontend interface
          const formattedPlayer: Player = {
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
            shoesList: (() => {
              if (!data.shoes) return [];
              try {
                if (data.shoes.startsWith("[")) {
                  return JSON.parse(data.shoes);
                }
                return [{ name: data.shoes, primary: true }];
              } catch {
                return [{ name: data.shoes, primary: true }];
              }
            })(),
            apparel: data.apparel,
            social: data.instagram || data.email ? { instagram: data.instagram, email: data.email } : undefined,
            userId: data.user_id,
            isApproved: data.is_approved,
          };
          setPlayer(formattedPlayer);
        } else {
          setPlayer(null);
        }
      } catch (err) {
        console.error(err);
        setPlayer(null);
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchPlayer();
    } else {
      setLoading(false);
    }
  }, [id]);

  // ELO club rank
  useEffect(() => {
    if (!id) return;
    supabase
      .from("players")
      .select("id, elo_rating")
      .is("deleted_at", null)
      .order("elo_rating", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const rank = data.findIndex((p) => p.id === id) + 1;
          setEloRank(rank > 0 ? rank : null);
        }
      });
  }, [id]);

  // All matches for this player (confirmed + pending for full history)
  useEffect(() => {
    if (!id) return;
    supabase
      .from("matches")
      .select("*, player1:players!player1_id(id, full_name), player2:players!player2_id(id, full_name)")
      .in("status", ["confirmed", "pending"])
      .or(`player1_id.eq.${id},player2_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setLiveMatches(data);
      });
  }, [id]);

  // Auto-refresh player + matches every 30s (silently, scroll preserved)
  const silentRefresh = useCallback(async () => {
    if (!id) return;
    try {
      // Re-fetch player data
      const { data: pData } = await supabase.from("players").select("*").eq("id", id).single();
      if (pData) {
        const formattedPlayer: Player = {
          id: pData.id, fullName: pData.full_name, nickname: pData.nickname,
          avatar: pData.avatar_url, department: pData.department, joinedYear: pData.joined_year,
          playingLevel: pData.playing_level, dominantHand: pData.dominant_hand,
          playingStyle: pData.playing_style, favoriteShot: pData.favorite_shot,
          favoriteIdol: pData.favorite_idol, quote: pData.quote,
          currentRacket: pData.current_racket, racketDetails: pData.racket_details || [],
          tournamentHistory: pData.tournament_history || [], achievements: pData.achievements || [],
          winLossRecord: pData.win_loss_record || `${pData.stats?.wins || 0}W - ${pData.stats?.losses || 0}L`,
          nationality: pData.nationality, homeState: pData.home_state, height: pData.height,
          yearsPlaying: pData.years_playing, coach: pData.coach, bio: pData.bio,
          currentRanking: pData.current_ranking, highestRanking: pData.highest_ranking,
          stats: pData.stats, recentForm: pData.recent_form, recentMatches: pData.recent_matches,
          frequentPartners: pData.frequent_partners, careerHighlights: pData.career_highlights,
          shoes: pData.shoes && pData.shoes.startsWith("[") 
            ? (JSON.parse(pData.shoes).find((s: any) => s.primary)?.name || JSON.parse(pData.shoes)[0]?.name || "")
            : pData.shoes,
          shoesList: (() => { try { if (!pData.shoes) return []; if (pData.shoes.startsWith("[")) return JSON.parse(pData.shoes); return [{ name: pData.shoes, primary: true }]; } catch { return [{ name: pData.shoes, primary: true }]; } })(),
          apparel: pData.apparel,
          social: pData.instagram || pData.email ? { instagram: pData.instagram, email: pData.email } : undefined,
          userId: pData.user_id,
        };
        setPlayer(formattedPlayer);
      }
      // Re-fetch matches
      const { data: mData } = await supabase.from("matches")
        .select("*, player1:players!player1_id(id, full_name), player2:players!player2_id(id, full_name)")
        .eq("status", "confirmed")
        .or(`player1_id.eq.${id},player2_id.eq.${id}`)
        .order("created_at", { ascending: false }).limit(10);
      if (mData) setLiveMatches(mData);
    } catch {}
  }, [id]);
  useAutoRefresh(silentRefresh, 30_000, !loading);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 py-20 px-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400 animate-pulse">
          Loading Player Profile...
        </p>
      </div>
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

  const isAdmin = isAdminEmail(currentUser?.email);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: player.fullName, url }); } catch { }
    } else {
      try { await navigator.clipboard.writeText(url); alert("Profile link copied!"); } catch { }
    }
  };

  const handleAdminDelete = async () => {
    if (!player || !currentUser) return;
    if (!confirm(`Delete "${player.fullName}"? This soft-deletes the player and removes them from the directory.`)) return;
    const { error } = await supabase.rpc("soft_delete_player", {
      player_id: player.id,
      admin_email: currentUser.email,
    });
    if (error) { alert("Delete failed: " + error.message); return; }
    alert(`${player.fullName} has been removed.`);
    setLocation('/');
  };



  const handleSelfDelete = async () => {
    if (!player || !currentUser) return;
    const confirmed = window.confirm(
      "Are you absolutely sure you want to delete your profile? \n\n" +
      "This will immediately hide your profile from the directory and matches. " +
      "It will remain in the database bin for 30 days before permanent deletion by an admin."
    );
    if (!confirmed) return;
    
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
            {liveMatches.length > 0 && (() => {
              const confirmedMatches = liveMatches.filter(m => m.status === "confirmed");
              const pendingMatchesList = liveMatches.filter(m => m.status === "pending");
              const filteredMatches = matchHistoryFilter === "all"
                ? confirmedMatches
                : matchHistoryFilter === "friendly"
                  ? confirmedMatches.filter(m => m.is_friendly !== false)
                  : confirmedMatches.filter(m => m.is_friendly === false);

              return (
                <motion.section variants={itemVariants}>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-3 ml-2">
                    <Clock className="w-6 h-6 text-blue-500" />
                    Match History
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">{confirmedMatches.length}</span>
                  </h2>

                  {/* Filter Tabs */}
                  <div className="flex gap-2 ml-2 mb-4">
                    {(["all", "friendly", "tournament"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setMatchHistoryFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border
                          ${matchHistoryFilter === tab
                            ? tab === "tournament"
                              ? "bg-amber-50 dark:bg-amber-900/30 border-amber-400 text-amber-700 dark:text-amber-400"
                              : tab === "friendly"
                                ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-400"
                                : "bg-blue-50 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-400"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                      >
                        {tab === "all" ? `All (${confirmedMatches.length})` : tab === "friendly" ? `🏸 Friendly (${confirmedMatches.filter(m => m.is_friendly !== false).length})` : `🏆 Tournament (${confirmedMatches.filter(m => m.is_friendly === false).length})`}
                      </button>
                    ))}
                  </div>

                  {/* Pending Matches Banner */}
                  {pendingMatchesList.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 mb-4 ml-2">
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">⏳ {pendingMatchesList.length} Pending Verification</div>
                      <div className="space-y-2">
                        {pendingMatchesList.map((m, idx) => {
                          const isP1 = m.player1_id === id;
                          const opponent = isP1 ? m.player2 : m.player1;
                          return (
                            <div key={`pen-${idx}`} className="flex items-center gap-3 text-sm">
                              <div className="w-8 h-8 rounded-lg bg-amber-200 dark:bg-amber-800/40 flex items-center justify-center text-xs font-black text-amber-700 dark:text-amber-400">?</div>
                              <div className="flex-1 min-w-0">
                                <span className="text-slate-600 dark:text-slate-300">vs </span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{opponent?.full_name ?? "Unknown"}</span>
                                <span className="text-slate-400 mx-1">·</span>
                                <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">{m.score}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">{new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Match List — BWF table style */}
                  <div className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                    {/* Table Header */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">
                      <div className="col-span-1 text-center">Result</div>
                      <div className="col-span-1">Type</div>
                      <div className="col-span-4">Opponent</div>
                      <div className="col-span-3">Score</div>
                      <div className="col-span-3 text-right">Date & Time</div>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredMatches.length > 0 ? filteredMatches.map((m, idx) => {
                        const isP1 = m.player1_id === id;
                        const opponent = isP1 ? m.player2 : m.player1;
                        const won = m.winner_id === id;
                        const matchDate = new Date(m.created_at);
                        const isFriendly = m.is_friendly !== false;

                        return (
                          <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 p-4 sm:px-5 sm:py-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors items-center">
                            {/* Result Badge */}
                            <div className="col-span-1 flex sm:justify-center">
                              <div className={`w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md
                                ${won
                                  ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30"
                                  : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/30"}`}>
                                {won ? "W" : "L"}
                              </div>
                            </div>

                            {/* Match Type */}
                            <div className="col-span-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                                isFriendly
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
                                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30"
                              }`}>
                                {isFriendly ? "FRD" : "TRN"}
                              </span>
                            </div>

                            {/* Opponent */}
                            <div className="col-span-4">
                              <div className="text-sm text-slate-600 dark:text-slate-300">
                                <span className="text-slate-400 mr-1">vs</span>
                                <button
                                  onClick={() => opponent?.id && setLocation(`/player/${opponent.id}`)}
                                  className="font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                  {opponent?.full_name ?? "Unknown"}
                                </button>
                              </div>
                              {m.round && m.round !== "Tournament" && (
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{m.round}</div>
                              )}
                            </div>

                            {/* Score */}
                            <div className="col-span-3">
                              <div className="font-mono text-sm font-black text-slate-700 dark:text-slate-200 tracking-tight">
                                {m.score?.replace(/\s*\[.*\]/, "") || "—"}
                              </div>
                            </div>

                            {/* Date & Time */}
                            <div className="col-span-3 text-right">
                              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {matchDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                {matchDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500 italic">
                          No {matchHistoryFilter === "all" ? "" : matchHistoryFilter} matches found
                        </div>
                      )}
                    </div>
                  </div>
                </motion.section>
              );
            })()}

            {/* Equipment Arsenal */}
            <motion.section variants={itemVariants}>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
                <Target className="w-6 h-6 text-rose-500" />
                Equipment Arsenal
              </h2>

              <div className="space-y-4">
                {player.racketDetails.map((racket, idx) => {
                  const isMain = racket.name === player.currentRacket;
                  return (
                    <div
                      key={idx}
                      className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 group
                        ${isMain
                          ? 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                          : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/30'}`}
                    >
                      {isMain && (
                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-xl text-slate-900 dark:text-white">{racket.name}</h3>
                            {isMain && (
                              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-emerald-500 text-white rounded-lg shadow-sm">
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                            <span className="flex items-center gap-1.5"><Dna className="w-4 h-4 text-blue-500" /> String: <span className="font-semibold text-slate-800 dark:text-slate-200">{racket.string}</span></span>
                            <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-rose-500" /> Tension: <span className="font-semibold text-slate-800 dark:text-slate-200">{racket.tension}</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Shoes & apparel */}
                {((player.shoesList && player.shoesList.length > 0) || player.shoes || player.apparel) && (
                  <div className="space-y-4 mt-4">
                    {player.shoesList && player.shoesList.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {player.shoesList.map((shoe, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center justify-between gap-4 relative overflow-hidden group">
                            {shoe.primary && (
                              <div className="absolute -right-10 -top-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />
                            )}
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                                <Footprints className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold font-sans">Footwear</div>
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{shoe.name}</div>
                              </div>
                            </div>
                            {shoe.primary && (
                              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 bg-emerald-500 text-white rounded z-10 shrink-0">
                                Primary
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : player.shoes ? (
                      <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                          <Footprints className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Footwear</div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{player.shoes}</div>
                        </div>
                      </div>
                    ) : null}

                    {player.apparel && (
                      <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
                          <Shirt className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Apparel</div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{player.apparel}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.section>

            {/* Career Highlights Timeline */}
            {player.careerHighlights && player.careerHighlights.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
                  <Star className="w-6 h-6 text-amber-500" />
                  Career Highlights
                </h2>
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-7 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50">
                  <ol className="relative border-l-2 border-dashed border-emerald-500/30 ml-2 space-y-6">
                    {player.careerHighlights.map((h, idx) => (
                      <li key={idx} className="ml-6">
                        <span className="absolute -left-[11px] w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 ring-4 ring-white dark:ring-slate-800 shadow shadow-emerald-500/30" />
                        <div className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{h.year}</div>
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{h.title}</div>
                        {h.description && <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{h.description}</div>}
                      </li>
                    ))}
                  </ol>
                </div>
              </motion.section>
            )}
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
