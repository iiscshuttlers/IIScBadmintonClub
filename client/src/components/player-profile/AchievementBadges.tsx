import { useMemo } from "react";
import { Trophy, Flame, Zap, Star, Shield, Target, Award, Swords, Crown, TrendingUp } from "lucide-react";

interface Match {
  id: string;
  winner_id?: string;
  player1_id?: string;
  player2_id?: string;
  status?: string;
  created_at?: string;
  match_score?: string;
}

interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
  check: (opts: { matches: Match[]; playerId: string; elo: number; wins: number; losses: number }) => boolean;
}

const BADGES: BadgeDef[] = [
  {
    id: "first_blood",
    label: "First Blood",
    description: "Won your very first match",
    icon: Swords,
    color: "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
    check: ({ wins }) => wins >= 1,
  },
  {
    id: "hot_streak",
    label: "Hot Streak",
    description: "Won 5 matches in a row",
    icon: Flame,
    color: "bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
    check: ({ matches, playerId }) => {
      const confirmed = matches.filter((m) => m.status === "confirmed");
      let streak = 0;
      for (const m of confirmed) {
        if (m.winner_id === playerId) { streak++; if (streak >= 5) return true; }
        else streak = 0;
      }
      return false;
    },
  },
  {
    id: "centurion",
    label: "Centurion",
    description: "Played 100+ matches",
    icon: Shield,
    color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    check: ({ wins, losses }) => wins + losses >= 100,
  },
  {
    id: "half_century",
    label: "Half Century",
    description: "Played 50+ matches",
    icon: Target,
    color: "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
    check: ({ wins, losses }) => wins + losses >= 50,
  },
  {
    id: "20_club",
    label: "20 Club",
    description: "Won 20+ matches",
    icon: Star,
    color: "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
    check: ({ wins }) => wins >= 20,
  },
  {
    id: "champion",
    label: "Champion",
    description: "Won 50+ matches",
    icon: Trophy,
    color: "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400",
    check: ({ wins }) => wins >= 50,
  },
  {
    id: "elo_1300",
    label: "ELO 1300",
    description: "Reached 1300 ELO rating",
    icon: TrendingUp,
    color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
    check: ({ elo }) => elo >= 1300,
  },
  {
    id: "elo_1400",
    label: "Elite",
    description: "Reached 1400 ELO rating",
    icon: Zap,
    color: "bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
    check: ({ elo }) => elo >= 1400,
  },
  {
    id: "elo_1500",
    label: "Grand Master",
    description: "Reached 1500 ELO rating",
    icon: Crown,
    color: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    check: ({ elo }) => elo >= 1500,
  },
  {
    id: "rubber_sets",
    label: "Rubber Setter",
    description: "Played 10+ three-set matches",
    icon: Award,
    color: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
    check: ({ matches }) => {
      const threeSetters = matches.filter((m) => {
        if (!m.match_score) return false;
        // Score format: "21-18, 18-21, 21-15" → 3 sets
        const sets = m.match_score.split(",").filter((s) => /\d+-\d+/.test(s));
        return sets.length >= 3;
      });
      return threeSetters.length >= 10;
    },
  },
];

interface Props {
  matches: Match[];
  playerId: string;
  elo: number;
  wins: number;
  losses: number;
}

export function AchievementBadges({ matches, playerId, elo, wins, losses }: Props) {
  const earned = useMemo(
    () => BADGES.filter((b) => b.check({ matches, playerId, elo, wins, losses })),
    [matches, playerId, elo, wins, losses],
  );

  const locked = BADGES.filter((b) => !earned.includes(b));

  if (earned.length === 0 && wins + losses < 1) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h3 className="text-base font-black text-slate-800 dark:text-white">Achievements</h3>
        <span className="ml-auto text-xs font-bold text-slate-400">{earned.length}/{BADGES.length}</span>
      </div>

      {earned.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {earned.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                title={badge.description}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black cursor-default transition hover:scale-105 ${badge.color}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {badge.label}
              </div>
            );
          })}
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Locked</p>
          <div className="flex flex-wrap gap-2">
            {locked.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.id}
                  title={badge.description}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/50 cursor-default opacity-60"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {badge.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
