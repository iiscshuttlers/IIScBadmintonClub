export type EloTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Grandmaster';

export interface TierInfo {
  name: EloTier;
  color: string;
  shadow: string;
  border: string;
  icon: string;
  minElo: number;
}

export const ELO_TIERS: TierInfo[] = [
  { name: 'Grandmaster', color: 'from-red-500 to-rose-600', shadow: 'shadow-rose-500/50', border: 'border-rose-500', icon: '👑', minElo: 1800 },
  { name: 'Diamond', color: 'from-cyan-400 to-blue-500', shadow: 'shadow-cyan-400/50', border: 'border-cyan-400', icon: '💎', minElo: 1600 },
  { name: 'Platinum', color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-400/50', border: 'border-emerald-400', icon: '✨', minElo: 1400 },
  { name: 'Gold', color: 'from-amber-300 to-yellow-500', shadow: 'shadow-amber-400/50', border: 'border-amber-400', icon: '🥇', minElo: 1200 },
  { name: 'Silver', color: 'from-slate-300 to-gray-400', shadow: 'shadow-slate-400/50', border: 'border-slate-300', icon: '🥈', minElo: 1000 },
  { name: 'Bronze', color: 'from-orange-700 to-amber-800', shadow: 'shadow-orange-700/50', border: 'border-orange-700', icon: '🥉', minElo: 0 },
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
