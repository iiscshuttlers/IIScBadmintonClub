import { useMemo } from "react";
import { BarChart3, Target, Users, Zap, TrendingUp, Clock } from "lucide-react";

interface Match {
  id: string;
  category?: string;
  score: string;
  created_at: string;
  winner_id: string;
  player1_id: string;
  player2_id: string;
  team1_partner_id?: string;
  team2_partner_id?: string;
  elo_change_p1?: number;
  elo_change_p2?: number;
  elo_change_p3?: number;
  elo_change_p4?: number;
}

interface Props {
  matches: Match[];
  playerId: string;
  playerElo: number;
}

function parseScore(score: string): number[][] {
  const raw = score?.split(" | ")[0] ?? score;
  return raw.split(",").map((set) => {
    const parts = set.trim().split("-").map(Number);
    return parts.length === 2 ? parts : [];
  }).filter((p) => p.length === 2);
}

function isWinner(match: Match, playerId: string): boolean {
  return match.winner_id === match.player1_id
    ? match.player1_id === playerId || match.team1_partner_id === playerId
    : match.player2_id === playerId || match.team2_partner_id === playerId;
}

function uniqueOpponents(matches: Match[], playerId: string): Set<string> {
  const ids = new Set<string>();
  for (const m of matches) {
    const myTeam = m.player1_id === playerId || m.team1_partner_id === playerId ? 1 : 2;
    if (myTeam === 1) {
      if (m.player2_id) ids.add(m.player2_id);
      if (m.team2_partner_id) ids.add(m.team2_partner_id);
    } else {
      if (m.player1_id) ids.add(m.player1_id);
      if (m.team1_partner_id) ids.add(m.team1_partner_id);
    }
  }
  return ids;
}

function winProb(myElo: number, oppElo: number): number {
  return Math.round((1 / (1 + Math.pow(10, (oppElo - myElo) / 400))) * 100);
}

export function PlayerAnalyticsWidget({ matches, playerId, playerElo }: Props) {
  const confirmedMatches = useMemo(
    () => matches.filter((m) => (m as any).status === "confirmed" || !(m as any).status),
    [matches],
  );

  /* ── Category Specialization ─────────────────────────────────── */
  const categoryStats = useMemo(() => {
    const cats: Record<string, { wins: number; total: number }> = {};
    for (const m of confirmedMatches) {
      const cat = m.category || "Unknown";
      if (!cats[cat]) cats[cat] = { wins: 0, total: 0 };
      cats[cat].total++;
      if (isWinner(m, playerId)) cats[cat].wins++;
    }
    return Object.entries(cats)
      .filter(([, v]) => v.total >= 2)
      .map(([cat, v]) => ({ cat, winRate: Math.round((v.wins / v.total) * 100), total: v.total, wins: v.wins }))
      .sort((a, b) => b.winRate - a.winRate);
  }, [confirmedMatches, playerId]);

  const specialization = useMemo(() => {
    if (categoryStats.length === 0) return null;
    const overall = confirmedMatches.length > 0
      ? Math.round((confirmedMatches.filter((m) => isWinner(m, playerId)).length / confirmedMatches.length) * 100)
      : 0;
    const best = categoryStats[0];
    if (best.winRate > overall + 10 && best.total >= 3) return best;
    return null;
  }, [categoryStats, confirmedMatches, playerId]);

  /* ── Opponent Diversity ──────────────────────────────────────── */
  const diversityStats = useMemo(() => {
    const opponents = uniqueOpponents(confirmedMatches, playerId);
    const total = confirmedMatches.length;
    const score = total > 0 ? Math.round((opponents.size / total) * 100) : 0;
    let label = "Versatile";
    let color = "text-emerald-600 dark:text-emerald-400";
    if (score < 40) { label = "Specialist"; color = "text-amber-600 dark:text-amber-400"; }
    else if (score > 70) { label = "Explorer"; color = "text-blue-600 dark:text-blue-400"; }
    return { uniqueOpponents: opponents.size, total, diversityScore: score, label, color };
  }, [confirmedMatches, playerId]);

  /* ── Match Pace Analytics ────────────────────────────────────── */
  const paceStats = useMemo(() => {
    let totalSets = 0;
    let closeSets = 0; // decided by ≤3 pts
    let bagels = 0;    // 21-0 or similar shutout game
    let deciders = 0;  // went to 3 sets
    let totalPoints = 0;
    let matchCount = 0;

    for (const m of confirmedMatches) {
      const sets = parseScore(m.score);
      if (sets.length === 0) continue;
      matchCount++;
      totalSets += sets.length;
      if (sets.length === 3) deciders++;
      for (const [a, b] of sets) {
        const diff = Math.abs(a - b);
        const pts = a + b;
        totalPoints += pts;
        if (diff <= 3) closeSets++;
        if (a === 0 || b === 0) bagels++;
      }
    }

    return {
      avgSetsPerMatch: matchCount > 0 ? (totalSets / matchCount).toFixed(1) : "—",
      closeSetsRatio: totalSets > 0 ? Math.round((closeSets / totalSets) * 100) : 0,
      decisivePct: matchCount > 0 ? Math.round((deciders / matchCount) * 100) : 0,
      bagels,
      avgPointsPerSet: totalSets > 0 ? Math.round(totalPoints / totalSets) : 0,
    };
  }, [confirmedMatches]);

  if (confirmedMatches.length < 3) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-500" /> Advanced Analytics
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Category Specialization */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Target className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Specialization</span>
          </div>
          {specialization ? (
            <>
              <p className="text-lg font-black text-slate-800 dark:text-white">{specialization.cat}</p>
              <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{specialization.winRate}% win rate</p>
              <p className="text-[10px] text-slate-400 mt-1">{specialization.wins}W of {specialization.total} matches — outperforms overall</p>
            </>
          ) : (
            <>
              <p className="text-base font-black text-slate-800 dark:text-white">All-Rounder</p>
              <div className="mt-2 space-y-1.5">
                {categoryStats.slice(0, 3).map(({ cat, winRate, total }) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 w-8 shrink-0">{cat}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${winRate}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400">{winRate}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Opponent Diversity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Diversity</span>
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className="text-3xl font-black text-slate-800 dark:text-white">{diversityStats.uniqueOpponents}</span>
            <span className="text-sm text-slate-400 mb-1">unique opponents</span>
          </div>
          <div className={`text-sm font-black ${diversityStats.color} mb-2`}>{diversityStats.label}</div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, diversityStats.diversityScore)}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Diversity score: {diversityStats.diversityScore}/100</p>
        </div>

        {/* Match Pace */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Match Pace</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Avg sets/match</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">{paceStats.avgSetsPerMatch}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Close sets (≤3pt margin)</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">{paceStats.closeSetsRatio}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Deciders (3-set matches)</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">{paceStats.decisivePct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Shutout sets won/lost</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">{paceStats.bagels}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
