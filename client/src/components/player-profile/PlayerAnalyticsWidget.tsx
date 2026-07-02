import { useMemo } from "react";
import { BarChart3, Target, Users, Zap, TrendingUp, Clock, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  allPlayers?: any[];
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

export function PlayerAnalyticsWidget({ matches, playerId, playerElo, allPlayers = [] }: Props) {
  const confirmedMatches = useMemo(
    () => matches.filter((m) => (m as any).status === "confirmed" || !(m as any).status),
    [matches],
  );

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

  /* ── Deep Analytics ──────────────────────────────────────────── */
  const deepStats = useMemo(() => {
    const opponents = new Map<string, { wins: number, losses: number }>();
    const partners = new Map<string, { wins: number, total: number }>();
    let comebacks = 0;
    let crushSets = 0;
    let totalSetsPlayed = 0;

    for (const m of confirmedMatches) {
      const myTeam = m.player1_id === playerId || m.team1_partner_id === playerId ? 1 : 2;
      const won = isWinner(m, playerId);

      let opps: string[] = [];
      let partner: string | null = null;
      if (myTeam === 1) {
        if (m.player2_id) opps.push(m.player2_id);
        if (m.team2_partner_id) opps.push(m.team2_partner_id);
        if (m.team1_partner_id && m.team1_partner_id !== playerId) partner = m.team1_partner_id;
        else if (m.player1_id !== playerId) partner = m.player1_id;
      } else {
        if (m.player1_id) opps.push(m.player1_id);
        if (m.team1_partner_id) opps.push(m.team1_partner_id);
        if (m.team2_partner_id && m.team2_partner_id !== playerId) partner = m.team2_partner_id;
        else if (m.player2_id !== playerId) partner = m.player2_id;
      }

      for (const opp of opps) {
        if (!opponents.has(opp)) opponents.set(opp, { wins: 0, losses: 0 });
        if (won) opponents.get(opp)!.wins++;
        else opponents.get(opp)!.losses++;
      }

      if (partner) {
        if (!partners.has(partner)) partners.set(partner, { wins: 0, total: 0 });
        partners.get(partner)!.total++;
        if (won) partners.get(partner)!.wins++;
      }

      // Sets & Comebacks & Crush Sets
      const sets = parseScore(m.score);
      totalSetsPlayed += sets.length;
      if (sets.length > 0) {
        const firstSet = sets[0];
        const [a, b] = firstSet;
        const lostFirstSet = myTeam === 1 ? a < b : a > b;
        
        if (sets.length === 3) {
          if (won && lostFirstSet) comebacks++;
        }

        // Crush Sets (Win a set keeping opponent under 10)
        for (const [sa, sb] of sets) {
          const myScore = myTeam === 1 ? sa : sb;
          const oppScore = myTeam === 1 ? sb : sa;
          if (myScore >= 21 && oppScore < 10) crushSets++;
        }
      }
    }

    let nemesis = null;
    let bestMatchup = null;
    let maxLosses = 0;
    let maxWins = 0;

    for (const [opp, stats] of opponents.entries()) {
      if (stats.losses > maxLosses || (stats.losses === maxLosses && stats.losses > 0 && stats.wins < (nemesis?.wins || 999))) {
        maxLosses = stats.losses;
        nemesis = { id: opp, ...stats };
      }
      if (stats.wins > maxWins || (stats.wins === maxWins && stats.wins > 0 && stats.losses < (bestMatchup?.losses || 999))) {
        maxWins = stats.wins;
        bestMatchup = { id: opp, ...stats };
      }
    }

    let bestPartner = null;
    let maxPartnerScore = 0;
    for (const [p, stats] of partners.entries()) {
      if (stats.total >= 3) {
        const wr = stats.wins / stats.total;
        if (wr > maxPartnerScore) {
          maxPartnerScore = wr;
          bestPartner = { id: p, winRate: Math.round(wr * 100), total: stats.total };
        }
      }
    }

    const crushRate = totalSetsPlayed > 0 ? Math.round((crushSets / totalSetsPlayed) * 100) : 0;

    const getPlayerName = (id: string) => {
      const p = allPlayers.find(x => x.id === id);
      return p ? p.full_name.split(" ")[0] : "Unknown";
    };

    return {
      nemesis: nemesis && nemesis.losses >= 2 ? { name: getPlayerName(nemesis.id), ...nemesis } : null,
      bestMatchup: bestMatchup && bestMatchup.wins >= 2 ? { name: getPlayerName(bestMatchup.id), ...bestMatchup } : null,
      bestPartner: bestPartner ? { name: getPlayerName(bestPartner.id), ...bestPartner } : null,
      comebacks,
      crushRate
    };
  }, [confirmedMatches, playerId, allPlayers]);

  /* ── Opponent Diversity ──────────────────────────────────────── */
  const diversityStats = useMemo(() => {
    const opponents = uniqueOpponents(confirmedMatches, playerId);
    const total = confirmedMatches.length;
    const score = total > 0 ? Math.round((opponents.size / total) * 100) : 0;
    let label = "Versatile";
    let color = "text-primary dark:text-primary";
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
      <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" /> Advanced Analytics
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        {/* Specialization */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm col-span-2">
          <div className="flex items-center gap-1.5 mb-3">
            <Target className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground flex-1">Specialization</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[200px] text-center">
                <p>Identifies the match category where you have the highest win rate compared to your overall performance.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {specialization ? (
            <>
              <p className="text-lg font-black text-slate-800 dark:text-foreground">{specialization.cat}</p>
              <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{specialization.winRate}% win rate</p>
              <p className="text-[10px] text-muted-foreground mt-1">{specialization.wins}W of {specialization.total} matches — outperforms overall</p>
            </>
          ) : (
            <>
              <p className="text-base font-black text-slate-800 dark:text-foreground">All-Rounder</p>
              <div className="mt-2 space-y-1.5">
                {categoryStats.slice(0, 3).map(({ cat, winRate }) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-8 shrink-0">{cat}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${winRate}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground">{winRate}% Win Rate</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Nemesis */}
        {deepStats.nemesis && (
          <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm ${!deepStats.bestMatchup ? 'col-span-2' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">Nemesis</span>
            </div>
            <p className="text-lg font-black text-slate-800 dark:text-foreground truncate">{deepStats.nemesis.name}</p>
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">{deepStats.nemesis.wins}W - {deepStats.nemesis.losses}L</p>
          </div>
        )}

        {/* Best Matchup */}
        {deepStats.bestMatchup && (
          <div className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm ${!deepStats.nemesis ? 'col-span-2' : ''}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">Easy Target</span>
            </div>
            <p className="text-lg font-black text-slate-800 dark:text-foreground truncate">{deepStats.bestMatchup.name}</p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{deepStats.bestMatchup.wins}W - {deepStats.bestMatchup.losses}L</p>
          </div>
        )}

        {/* Dynamic Duo */}
        {deepStats.bestPartner && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm col-span-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex-1">Dynamic Duo</span>
            </div>
            <p className="text-lg font-black text-slate-800 dark:text-foreground truncate">{deepStats.bestPartner.name}</p>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">{deepStats.bestPartner.winRate}% Win Rate ({deepStats.bestPartner.total} matches)</p>
          </div>
        )}

        {/* Comebacks & Dominance */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm col-span-2 flex justify-around">
          <div className="text-center">
            <div className="flex justify-center items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5 text-orange-500" /> Comebacks
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-foreground">{deepStats.comebacks}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Won after losing 1st set</p>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-800 mx-4" />
          <div className="text-center">
            <div className="flex justify-center items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Crush Rate
            </div>
            <p className="text-2xl font-black text-slate-800 dark:text-foreground">{deepStats.crushRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Sets won by 12+ pts</p>
          </div>
        </div>
        
        {/* Opponent Diversity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 mb-3">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Diversity</span>
          </div>
          <div className="flex items-end gap-1 mb-2">
            <span className="text-3xl font-black text-slate-800 dark:text-foreground">{diversityStats.uniqueOpponents}</span>
            <span className="text-sm text-muted-foreground mb-1">unique opponents</span>
          </div>
          <div className={`text-sm font-black ${diversityStats.color} mb-2`}>{diversityStats.label}</div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, diversityStats.diversityScore)}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Diversity score: {diversityStats.diversityScore}/100</p>
        </div>

        {/* Match Pace */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Match Pace</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Avg sets/match</span>
              <span className="text-sm font-black text-slate-800 dark:text-foreground">{paceStats.avgSetsPerMatch}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Close sets (≤3pt margin)</span>
              <span className="text-sm font-black text-amber-600 dark:text-amber-400">{paceStats.closeSetsRatio}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Deciders (3-set matches)</span>
              <span className="text-sm font-black text-slate-800 dark:text-foreground">{paceStats.decisivePct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Shutout sets won/lost</span>
              <span className="text-sm font-black text-slate-800 dark:text-foreground">{paceStats.bagels}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
