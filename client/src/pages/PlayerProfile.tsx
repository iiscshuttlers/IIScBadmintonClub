import { useParams, useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy, User, Activity, MapPin, Calendar, Swords, Zap,
  Target, Dna, Crosshair, Sparkles, Quote, Medal, ArrowLeft,
  TrendingUp, Award, Flame, BarChart3, Share2,
  Instagram, Mail, Users, Star, Hash, Ruler, BookOpen,
  ChevronRight, Footprints, Shirt, ArrowUpRight, Clock
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

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
  apparel?: string;
  social?: Social;
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

export default function PlayerProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
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
            shoes: data.shoes,
            apparel: data.apparel,
            social: data.instagram || data.email ? { instagram: data.instagram, email: data.email } : undefined,
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
    }
  }, [id]);

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

  const validAchievements = player.achievements.filter(a => a && a.trim() !== "");
  const streak = player.stats?.currentStreak;
  const isWinStreak = streak?.startsWith("W");

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: player.fullName, url }); } catch { }
    } else {
      try { await navigator.clipboard.writeText(url); alert("Profile link copied!"); } catch { }
    }
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
          onClick={() => setLocation('/')}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="absolute top-6 right-6 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
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

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-8">
            {/* Avatar */}
            <div className="relative z-10 shrink-0">
              <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full blur-lg opacity-40 group-hover:opacity-70 transition duration-700" />
              <img
                src={player.avatar}
                alt={player.fullName}
                className="relative w-40 h-40 sm:w-52 sm:h-52 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-2xl transform group-hover:scale-105 transition duration-500"
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
              </div>

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
            </div>
          </div>
        </motion.div>

        {/* ============== KPI Row ============== */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">

          {/* Win % – special: uses circular progress */}
          <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 flex items-center gap-4 relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl bg-emerald-500/20 group-hover:bg-emerald-500/40 transition-opacity" />
            <CircularProgress value={winPct} />
            <div className="relative z-10 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">Win Rate</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{player.winLossRecord}</div>
            </div>
          </div>

          <KPI
            icon={Trophy}
            label="Titles Won"
            value={player.stats?.titlesWon ?? "—"}
            sub={player.stats?.runnerUp != null ? `${player.stats.runnerUp} runner-up` : undefined}
            accent="bg-amber-500"
          />

          <KPI
            icon={Flame}
            label="Current Streak"
            value={streak ?? "—"}
            sub={isWinStreak ? "on a hot run" : streak ? "rebuilding" : undefined}
            accent={isWinStreak ? "bg-rose-500" : "bg-slate-500"}
          />

          <KPI
            icon={BarChart3}
            label="Total Matches"
            value={totalMatches || "—"}
            sub={player.stats?.longestWinStreak != null ? `Best streak: ${player.stats.longestWinStreak}` : undefined}
            accent="bg-blue-500"
          />
        </motion.div>

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

            {/* Recent Matches */}
            {player.recentMatches && player.recentMatches.length > 0 && (
              <motion.section variants={itemVariants}>
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 ml-2">
                  <Clock className="w-6 h-6 text-blue-500" />
                  Recent Matches
                </h2>
                <div className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {player.recentMatches.map((m, idx) => (
                      <div key={idx} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-md
                            ${m.result === "W"
                              ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30"
                              : "bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-rose-500/30"}`}>
                            {m.result}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{m.tournament}</span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-semibold">{m.category}</span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">{m.round}</span>
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              vs <span className="font-semibold text-slate-800 dark:text-slate-100">{m.opponent}</span>
                              {m.partner && <> · with <span className="font-semibold text-slate-800 dark:text-slate-100">{m.partner}</span></>}
                            </div>
                            <div className="mt-1 font-mono text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">{m.score}</div>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 hidden sm:block">
                            {new Date(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

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
                {(player.shoes || player.apparel) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {player.shoes && (
                      <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                          <Footprints className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Footwear</div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{player.shoes}</div>
                        </div>
                      </div>
                    )}
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
                    <h3 className="text-xs uppercase tracking-widest font-black text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                      <Medal className="w-4 h-4" /> Top Achievements
                    </h3>
                    <ul className="space-y-4">
                      {validAchievements.map((ach, idx) => (
                        <li key={idx} className="flex items-start gap-3 group">
                          <div className="mt-1.5 w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 shrink-0 shadow-sm shadow-amber-500/50 group-hover:scale-150 transition-transform" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">{ach}</span>
                        </li>
                      ))}
                    </ul>
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

            {/* Social */}
            {player.social && (player.social.instagram || player.social.email) && (
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
                  {player.social.email && (
                    <a
                      href={`mailto:${player.social.email}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Mail className="w-4 h-4" /> Email
                    </a>
                  )}
                </div>
              </motion.section>
            )}

          </div>
        </div>
      </motion.div>
    </div>
  );
}