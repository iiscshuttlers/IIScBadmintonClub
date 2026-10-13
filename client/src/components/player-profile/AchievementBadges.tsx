import { useMemo, useEffect, useRef } from "react";
import { Trophy, Flame, Zap, Star, Shield, Target, Award, Swords, Crown, TrendingUp, Moon, Sun, Scissors } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

// player_achievements is new; generated types regenerate after the migration
// is applied (npx supabase db push). Cast until then.
const sbAch = supabase as any;

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const days = Math.floor(d / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface Match {
  id: string;
  winner_id?: string;
  player1_id?: string;
  player2_id?: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  status?: string;
  created_at?: string;
  date?: string;
  match_score?: string;
  player1?: any;
  player2?: any;
  partner1?: any;
  partner2?: any;
}

interface BadgeProgress {
  earned: boolean;
  current: number;
  max: number;
}

interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  getProgress: (opts: { matches: Match[]; playerId: string; elo: number; wins: number; losses: number }) => BadgeProgress;
}

const BADGES: BadgeDef[] = [
  {
    id: "first_blood",
    label: "First Blood",
    description: "Won your very first match",
    icon: Swords,
    color: "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    getProgress: ({ wins }) => ({ earned: wins >= 1, current: wins, max: 1 }),
  },
  {
    id: "hot_streak",
    label: "Hot Streak",
    description: "Win 5 matches in a row",
    icon: Flame,
    color: "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
    getProgress: ({ matches, playerId }) => {
      const confirmed = matches
        .filter((m) => m.status === "confirmed" && (m.date || m.created_at))
        .sort((a, b) => {
          const timeA = new Date(a.date || a.created_at!).getTime();
          const timeB = new Date(b.date || b.created_at!).getTime();
          return timeA - timeB; // Ascending (oldest to newest)
        });
      let streak = 0;
      let maxStreak = 0;
      for (const m of confirmed) {
        if (m.winner_id === playerId || m.winner_id === m.player1_id && (m.player1_id === playerId || m.team1_partner_id === playerId) || m.winner_id === m.player2_id && (m.player2_id === playerId || m.team2_partner_id === playerId)) { 
          streak++; 
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }
      return { earned: maxStreak >= 5, current: Math.min(maxStreak, 5), max: 5 };
    },
  },
  {
    id: "centurion",
    label: "Centurion",
    description: "Play 100 matches",
    icon: Shield,
    color: "bg-slate-100 dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground",
    getProgress: ({ wins, losses }) => ({ earned: wins + losses >= 100, current: Math.min(wins + losses, 100), max: 100 }),
  },
  {
    id: "half_century",
    label: "Half Century",
    description: "Play 50 matches",
    icon: Target,
    color: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    getProgress: ({ wins, losses }) => ({ earned: wins + losses >= 50, current: Math.min(wins + losses, 50), max: 50 }),
  },
  {
    id: "20_club",
    label: "20 Club",
    description: "Win 20 matches",
    icon: Star,
    color: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    getProgress: ({ wins }) => ({ earned: wins >= 20, current: Math.min(wins, 20), max: 20 }),
  },
  {
    id: "champion",
    label: "Champion",
    description: "Win 50 matches",
    icon: Trophy,
    color: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400",
    getProgress: ({ wins }) => ({ earned: wins >= 50, current: Math.min(wins, 50), max: 50 }),
  },

  {
    id: "rubber_sets",
    label: "Rubber Setter",
    description: "Play 10 three-set matches",
    icon: Award,
    color: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
    getProgress: ({ matches }) => {
      const threeSetters = matches.filter((m) => {
        const score = (m as any).match_score || (m as any).score;
        if (!score || typeof score !== "string") return false;
        const sets = score.split(",").filter((s) => /\d+-\d+/.test(s));
        return sets.length >= 3 && m.status === "confirmed";
      });
      return { earned: threeSetters.length >= 10, current: Math.min(threeSetters.length, 10), max: 10 };
    },
  },
  {
    id: "clean_sweep",
    label: "Clean Sweep",
    description: "Win a match without dropping 10 points",
    icon: Scissors,
    color: "bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400",
    getProgress: ({ matches, playerId }) => {
      let achieved = false;
      matches.filter(m => {
        const score = (m as any).match_score || (m as any).score;
        return m.status === "confirmed" && score && typeof score === "string";
      }).forEach(m => {
        const won = m.winner_id === playerId || m.winner_id === m.player1_id && (m.player1_id === playerId || m.team1_partner_id === playerId) || m.winner_id === m.player2_id && (m.player2_id === playerId || m.team2_partner_id === playerId);
        if (!won) return;

        const isTeam1 = m.player1_id === playerId || m.team1_partner_id === playerId;
        const scoreStr = (m as any).match_score || (m as any).score;
        const sets = scoreStr.split(",").filter((s: string) => /\d+-\d+/.test(s));
        if (sets.length === 2 || sets.length === 1) {
          let dominant = true;
          for (let s of sets) {
            const [p1, p2] = s.split("-").map(Number);
            const myScore = isTeam1 ? p1 : p2;
            const oppScore = isTeam1 ? p2 : p1;
            if (oppScore >= 10 || myScore < 21) dominant = false;
          }
          if (dominant) achieved = true;
        }
      });
      return { earned: achieved, current: achieved ? 1 : 0, max: 1 };
    }
  }
];

interface Props {
  matches: Match[];
  playerId: string;
  elo: number;
  /** When equal to playerId, newly-earned badges trigger a celebration (#21). */
  currentUserId?: string;
}

export function AchievementBadges({ matches: allMatches, playerId, elo, currentUserId }: Props) {
  const matches = useMemo(() => allMatches, [allMatches]);

  const { wins, losses } = useMemo(() => {
    let w = 0;
    let l = 0;
    const isWinner = (m: any) => {
      if (!m.winner_id && !m.winner_side) return false;
      const isTeam1 = m.player1_id === playerId || m.team1_partner_id === playerId;
      if (m.winner_side) return isTeam1 ? m.winner_side === 1 : m.winner_side === 2;
      const isTeam1Winner = m.winner_id === m.player1_id || m.winner_id === m.team1_partner_id;
      return isTeam1 ? isTeam1Winner : !isTeam1Winner;
    };

    matches
      .filter((m) => m.status === "confirmed" || m.status === "completed")
      .forEach((m) => {
        if (isWinner(m)) w++;
        else l++;
      });
    return { wins: w, losses: l };
  }, [matches, playerId]);

  const badgeData = useMemo(() => {
    return BADGES.map(b => ({
      badge: b,
      progress: b.getProgress({ matches, playerId, elo, wins, losses })
    }));
  }, [matches, playerId, elo, wins, losses]);

  const earned = badgeData.filter(d => d.progress.earned);
  const locked = badgeData.filter(d => !d.progress.earned);

  // Persisted unlock timestamps for this player (#21).
  // NOTE: the query cache is persisted to localStorage (PersistQueryClient),
  // and a Map does not survive JSON serialization — it rehydrates as {} and
  // crashes on .get. So cache a plain array and build the Map in-memory.
  const { data: earnedRows } = useQuery({
    queryKey: ["player-achievements", playerId],
    enabled: !!playerId,
    queryFn: async (): Promise<{ achievement_id: string; earned_at: string }[]> => {
      const { data, error } = await sbAch
        .from("player_achievements")
        .select("achievement_id, earned_at")
        .eq("player_id", playerId);
      if (error) throw error;
      return (data || []) as { achievement_id: string; earned_at: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });
  const earnedDates = useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(earnedRows)) {
      for (const r of earnedRows) map.set(r.achievement_id, r.earned_at);
    }
    return map;
  }, [earnedRows]);

  // #21 Celebrate newly-earned badges when a user views their OWN profile.
  // Baseline of seen badges is kept per-user in localStorage; the very first
  // view seeds the baseline silently (no celebration for already-earned ones).
  const queryClient = useQueryClient();
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (celebratedRef.current) return;
    if (!currentUserId || currentUserId !== playerId) return;
    if (!matches || matches.length === 0) return; // wait for data to load
    const earnedIds = earned.map((d) => d.badge.id).sort();
    const key = `ach_seen_${playerId}`;
    const hadBaseline = localStorage.getItem(key) !== null;
    let prev: string[] = [];
    try { prev = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* ignore */ }
    try { localStorage.setItem(key, JSON.stringify(earnedIds)); } catch { /* ignore */ }
    celebratedRef.current = true;
    if (!hadBaseline) return; // first-ever view: seed silently
    const prevSet = new Set(prev);
    const fresh = earnedIds.filter((id) => !prevSet.has(id));
    if (fresh.length === 0) return;
    const labels = fresh.map((id) => BADGES.find((b) => b.id === id)?.label).filter(Boolean);
    track("achievement_unlocked", { ids: fresh });
    toast.success(`🏅 Achievement unlocked: ${labels.join(", ")}!`, { duration: 6000 });
    import("canvas-confetti")
      .then((m) => m.default({ particleCount: 120, spread: 70, origin: { y: 0.6 } }))
      .catch(() => { /* confetti is best-effort */ });
    // Persist the unlocks (own profile only). ignoreDuplicates keeps the
    // original earned_at if the row already exists.
    sbAch
      .from("player_achievements")
      .upsert(fresh.map((id) => ({ player_id: playerId, achievement_id: id })), {
        onConflict: "player_id,achievement_id",
        ignoreDuplicates: true,
      })
      .then(
        () => queryClient.invalidateQueries({ queryKey: ["player-achievements", playerId] }),
        () => { /* best-effort */ },
      );
  }, [currentUserId, playerId, matches, earned, queryClient]);

  return (
    <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl border border-slate-200 dark:border-white/8 p-6 overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-foreground">Achievements</h3>
          <p className="text-xs font-bold text-muted-foreground dark:text-muted-foreground">
            {earned.length} of {BADGES.length} Unlocked
          </p>
        </div>
      </div>

      {earned.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            {earned.map(({ badge }) => {
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  title={badge.description}
                  className={`relative overflow-hidden group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black cursor-pointer shadow-sm ${badge.color}`}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  <Icon className="w-4 h-4 z-10 relative shrink-0" />
                  <div className="z-10 relative flex flex-col">
                    <span>{badge.label}</span>
                    <span className="text-[9px] opacity-75 font-medium normal-case line-clamp-1">
                      {earnedDates?.get(badge.id) ? `Earned ${timeAgo(earnedDates.get(badge.id)!)}` : badge.description}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">In Progress</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {locked.map(({ badge, progress }) => {
              const Icon = badge.icon;
              const percent = Math.min(100, Math.round((progress.current / progress.max) * 100));
              
              const textColors = badge.color.split(' ').filter(c => c.includes('text-')).join(' ');
              
              return (
                <div
                  key={badge.id}
                  title={badge.description}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${badge.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs font-bold truncate pr-2 ${textColors}`}>{badge.label}</span>
                      <span className={`text-[10px] font-black whitespace-nowrap ${textColors}`}>
                        {progress.max > 1 ? `${progress.current} / ${progress.max}` : `${percent}%`}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate mb-1.5" title={badge.description}>{badge.description}</p>
                    <div className={`h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ${textColors}`}>
                      <div 
                        className="h-full bg-current rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
