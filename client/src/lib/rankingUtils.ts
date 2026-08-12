export function calculateRanksMap(players: any[]) {
  const ranks: Record<string, { overall: number; singles: number; doubles: number; mixed: number }> = {};
  players.forEach(p => ranks[p.id] = { overall: 0, singles: 0, doubles: 0, mixed: 0 });

  const rankFormat = (key: 'overall' | 'singles' | 'doubles' | 'mixed', eloKey: 'elo_rating' | 'singles_elo' | 'doubles_elo' | 'mixed_elo') => {
    // Filter out players with exactly 1200 ELO (default/unranked baseline) or null ELO
    const activePlayers = players.filter(p => p[eloKey] != null && p[eloKey] !== 1200);
    const sorted = [...activePlayers].sort((a, b) => (b[eloKey] || 0) - (a[eloKey] || 0));
    let prevElo: number | null = null;
    let rank = 1;
    sorted.forEach((p, i) => {
      const elo = p[eloKey] || 0;
      if (prevElo !== null && elo < prevElo) rank = i + 1;
      if (ranks[p.id]) ranks[p.id][key] = rank;
      prevElo = elo;
    });
  };

  rankFormat('overall', 'elo_rating');
  rankFormat('singles', 'singles_elo');
  rankFormat('doubles', 'doubles_elo');
  rankFormat('mixed', 'mixed_elo');

  return ranks;
}
