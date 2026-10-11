export type EloTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Grandmaster";

export interface TierInfo {
  name: EloTier;
  /** Gradient stops (use with `bg-gradient-to-*`). */
  color: string;
  /** Subtle background tint for badges/chips. */
  bg: string;
  /** Solid text color for badges/chips. */
  text: string;
  shadow: string;
  border: string;
  icon: string;
  minElo: number;
}

export const ELO_TIERS: TierInfo[] = [
  {
    name: "Grandmaster",
    color: "from-rose-600 via-red-600 to-amber-600",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    shadow: "shadow-rose-500/50",
    border: "border-rose-500",
    icon: "👑",
    minElo: 1800,
  },
  {
    name: "Diamond",
    color: "from-cyan-500 via-sky-500 to-indigo-600",
    bg: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
    shadow: "shadow-cyan-400/50",
    border: "border-cyan-400",
    icon: "💎",
    minElo: 1600,
  },
  {
    name: "Platinum",
    color: "from-emerald-500 via-teal-500 to-cyan-600",
    bg: "bg-teal-500/10",
    text: "text-teal-600 dark:text-teal-400",
    shadow: "shadow-teal-400/50",
    border: "border-teal-400",
    icon: "✨",
    minElo: 1400,
  },
  {
    name: "Gold",
    color: "from-amber-400 via-amber-500 to-yellow-600",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    shadow: "shadow-amber-400/50",
    border: "border-amber-400",
    icon: "🥇",
    minElo: 1200,
  },
  {
    name: "Silver",
    color: "from-slate-400 via-slate-500 to-zinc-600",
    bg: "bg-slate-400/10",
    text: "text-slate-600 dark:text-slate-300",
    shadow: "shadow-slate-400/50",
    border: "border-slate-400",
    icon: "🥈",
    minElo: 1000,
  },
  {
    name: "Bronze",
    color: "from-amber-700 via-orange-800 to-stone-800",
    bg: "bg-amber-800/10",
    text: "text-amber-800 dark:text-amber-500",
    shadow: "shadow-amber-800/50",
    border: "border-amber-700",
    icon: "🥉",
    minElo: 0,
  },
];

export function getEloTier(elo: number | undefined | null): TierInfo {
  if (elo == null) return ELO_TIERS[ELO_TIERS.length - 1]; // Default to Bronze
  for (const tier of ELO_TIERS) {
    if (elo >= tier.minElo) {
      return tier;
    }
  }
  return ELO_TIERS[ELO_TIERS.length - 1];
}
