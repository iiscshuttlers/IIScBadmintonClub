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
    color: "from-danger via-danger to-warning",
    bg: "bg-danger/10",
    text: "text-danger",
    shadow: "shadow-danger/50",
    border: "border-danger",
    icon: "👑",
    minElo: 1800,
  },
  {
    name: "Diamond",
    color: "from-accent via-info to-info",
    bg: "bg-accent/10",
    text: "text-accent",
    shadow: "shadow-accent/50",
    border: "border-accent",
    icon: "💎",
    minElo: 1600,
  },
  {
    name: "Platinum",
    color: "from-success via-team to-accent",
    bg: "bg-team/10",
    text: "text-team",
    shadow: "shadow-team/50",
    border: "border-team",
    icon: "✨",
    minElo: 1400,
  },
  {
    name: "Gold",
    color: "from-warning via-warning to-warning",
    bg: "bg-warning/10",
    text: "text-warning",
    shadow: "shadow-warning/50",
    border: "border-warning",
    icon: "🥇",
    minElo: 1200,
  },
  {
    name: "Silver",
    color: "from-muted-foreground via-muted-foreground to-faint",
    bg: "bg-muted-foreground/10",
    text: "text-soft",
    shadow: "shadow-media/50",
    border: "border-border-strong",
    icon: "🥈",
    minElo: 1000,
  },
  {
    name: "Bronze",
    color: "from-warning via-secondary/20 to-muted",
    bg: "bg-warning/5",
    text: "text-warning",
    shadow: "shadow-warning/50",
    border: "border-warning",
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
