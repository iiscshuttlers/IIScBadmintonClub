import { useMemo } from "react";
import { Trophy, Flame, Zap, Star, Shield, Target, Award, Swords, Crown, TrendingUp, Moon, Sun, Scissors } from "lucide-react";
import { motion } from "framer-motion";

interface Match {
  id: string;
  winner_id?: string;
  player1_id?: string;
  player2_id?: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  status?: string;
  created_at?: string;
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
      const confirmed = matches.filter((m) => m.status === "confirmed").sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());
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
    color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
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
    id: "elo_1300",
    label: "ELO 1300",
    description: "Reach 1300 ELO rating",
    icon: TrendingUp,
    color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    getProgress: ({ elo }) => ({ earned: elo >= 1300, current: Math.min(Math.floor(elo), 1300), max: 1300 }),
  },
  {
    id: "elo_1400",
    label: "Elite",
    description: "Reach 1400 ELO rating",
    icon: Zap,
    color: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
    getProgress: ({ elo }) => ({ earned: elo >= 1400, current: Math.min(Math.floor(elo), 1400), max: 1400 }),
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
  wins: number;
  losses: number;
}

export function AchievementBadges({ matches, playerId, elo, wins, losses }: Props) {
  const badgeData = useMemo(() => {
    return BADGES.map(b => ({
      badge: b,
      progress: b.getProgress({ matches, playerId, elo, wins, losses })
    }));
  }, [matches, playerId, elo, wins, losses]);

  const earned = badgeData.filter(d => d.progress.earned);
  const locked = badgeData.filter(d => !d.progress.earned);

  return (
    <div className="bg-white dark:bg-white/5 shadow-sm dark:shadow-none rounded-3xl border border-slate-200 dark:border-white/8 p-6 overflow-hidden relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-white">Achievements</h3>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
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
                    <span className="text-[9px] opacity-75 font-medium normal-case line-clamp-1">{badge.description}</span>
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
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">In Progress</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/8" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {locked.map(({ badge, progress }) => {
              const Icon = badge.icon;
              const percent = Math.min(100, Math.round((progress.current / progress.max) * 100));
              
              return (
                <div
                  key={badge.id}
                  title={badge.description}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50"
                >
                  <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center opacity-60 ${badge.color} grayscale`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate pr-2">{badge.label}</span>
                      <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">
                        {progress.max > 1 ? `${progress.current} / ${progress.max}` : `${percent}%`}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 truncate mb-1.5" title={badge.description}>{badge.description}</p>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-400 dark:bg-slate-500 rounded-full transition-all duration-500" 
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
