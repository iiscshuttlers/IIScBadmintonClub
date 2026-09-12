export function calculateRanksMap(players: any[]) {
  const ranks: Record<string, { overall: number; singles: number; doubles: number; mixed: number }> = {};
  players.forEach(p => ranks[p.id] = { overall: 0, singles: 0, doubles: 0, mixed: 0 });

  const getWinPct = (record?: string): number => {
    if (!record) return -1;
    const rec = String(record).toUpperCase();
    const m = rec.match(/(\d+)\s*W\s*-?\s*(\d+)\s*L/);
    if (m) {
      const w = +m[1], l = +m[2];
      return w + l === 0 ? -1 : w / (w + l);
    }
    const dashMatch = rec.match(/^(\d+)\s*-\s*(\d+)$/);
    if (dashMatch) {
      const w = +dashMatch[1], l = +dashMatch[2];
      return w + l === 0 ? -1 : w / (w + l);
    }
    return -1;
  };

  const rankFormat = (
    key: 'overall' | 'singles' | 'doubles' | 'mixed', 
    eloKey: 'elo_rating' | 'singles_elo' | 'doubles_elo' | 'mixed_elo',
    recordKey: 'win_loss_record' | 'singles_record' | 'doubles_record' | 'mixed_record'
  ) => {
    // Filter out players with exactly 1200 ELO (default/unranked baseline) or null ELO
    const activePlayers = players.filter(p => p[eloKey] != null && p[eloKey] !== 1200);
    const sorted = [...activePlayers].sort((a, b) => {
      const eloDiff = (b[eloKey] || 0) - (a[eloKey] || 0);
      if (eloDiff !== 0) return eloDiff;
      return getWinPct(b[recordKey]) - getWinPct(a[recordKey]);
    });
    
    let prevElo: number | null = null;
    let prevPct: number | null = null;
    let rank = 1;
    sorted.forEach((p, i) => {
      const elo = p[eloKey] || 0;
      const pct = getWinPct(p[recordKey]);
      if (prevElo !== null && (elo !== prevElo || pct !== prevPct)) rank = i + 1;
      if (ranks[p.id]) ranks[p.id][key] = rank;
      prevElo = elo;
      prevPct = pct;
    });
  };

  rankFormat('overall', 'elo_rating', 'win_loss_record');
  rankFormat('singles', 'singles_elo', 'singles_record');
  rankFormat('doubles', 'doubles_elo', 'doubles_record');
  rankFormat('mixed', 'mixed_elo', 'mixed_record');

  return ranks;
}
