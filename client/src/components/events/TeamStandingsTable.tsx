import React, { useState, useMemo } from "react";
import { useTeamStandings } from "@/hooks/useTeamStandings";
import { Loader2, Trophy, ArrowUpDown, ArrowUp, ArrowDown, Layers, ShieldCheck, Info } from "lucide-react";

interface Props {
  tournamentId?: string;
  qualifyingCutoff?: number;
}

type SortColumn = 'tie_points' | 'won' | 'rubbers_diff' | 'sets_diff' | 'points_diff' | 'played';

export function TeamStandingsTable({ tournamentId, qualifyingCutoff = 2 }: Props) {
  const { data: rawStandings = [], isLoading } = useTeamStandings(tournamentId);

  const [selectedPool, setSelectedPool] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortColumn>("tie_points");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>("desc");

  // Distinct pools
  const pools = useMemo(() => {
    const s = new Set<string>();
    rawStandings.forEach((t: any) => {
      if (t.pool) s.add(t.pool);
    });
    return Array.from(s).sort();
  }, [rawStandings]);

  // Handle header click to toggle sort
  const handleSort = (key: SortColumn) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Filter by pool
  const filtered = useMemo(() => {
    if (selectedPool === "ALL") return rawStandings;
    return rawStandings.filter((t: any) => t.pool === selectedPool);
  }, [rawStandings, selectedPool]);

  // Sort teams
  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let valA = a[sortKey] ?? 0;
      let valB = b[sortKey] ?? 0;

      // Primary tie-breaker fallback if values are equal
      if (valA === valB) {
        // Fall back to tie_points -> rubbers_diff -> sets_diff -> points_diff
        if (b.tie_points !== a.tie_points) return b.tie_points - a.tie_points;
        const rDiffA = (a.rubbers_for ?? 0) - (a.rubbers_against ?? 0);
        const rDiffB = (b.rubbers_for ?? 0) - (b.rubbers_against ?? 0);
        if (rDiffA !== rDiffB) return rDiffB - rDiffA;

        const sDiffA = a.sets_diff ?? ((a.sets_for ?? 0) - (a.sets_against ?? 0));
        const sDiffB = b.sets_diff ?? ((b.sets_for ?? 0) - (b.sets_against ?? 0));
        if (sDiffA !== sDiffB) return sDiffB - sDiffA;

        const pDiffA = a.points_diff ?? ((a.points_for ?? 0) - (a.points_against ?? 0));
        const pDiffB = b.points_diff ?? ((b.points_for ?? 0) - (b.points_against ?? 0));
        return pDiffB - pDiffA;
      }

      return sortDirection === 'desc' ? valB - valA : valA - valB;
    });
  }, [filtered, sortKey, sortDirection]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!rawStandings || rawStandings.length === 0) {
    return (
      <div className="text-center p-12 text-muted-foreground bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <Trophy className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <h4 className="font-bold text-slate-600 dark:text-slate-400">No Standings Available Yet</h4>
        <p className="text-xs text-slate-400 mt-1">Standings update in real-time as pool ties and rubbers are completed.</p>
      </div>
    );
  }

  const renderSortIndicator = (key: SortColumn) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-25 inline-block" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 inline-block text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 inline-block text-primary" />
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
      {/* Top Header & Pool Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Tournament Points Table
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click column headers to sort by Points, Wins, Rubber Diff, Set Diff, or Points Diff.
          </p>
        </div>

        {pools.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setSelectedPool("ALL")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                selectedPool === "ALL"
                  ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              All Pools
            </button>
            {pools.map(p => (
              <button
                key={p}
                onClick={() => setSelectedPool(p)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  selectedPool === p
                    ? "bg-white dark:bg-slate-900 text-slate-950 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                Pool {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Standings Table */}
      <div className="overflow-x-auto -mx-5 sm:mx-0">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/40 border-y border-slate-100 dark:border-slate-800">
              <th className="px-3 sm:px-4 py-3 text-center w-12">Pos</th>
              <th className="px-3 sm:px-4 py-3">Team</th>
              {pools.length > 0 && selectedPool === "ALL" && (
                <th className="px-3 py-3 text-center">Pool</th>
              )}
              <th 
                onClick={() => handleSort('played')} 
                className="px-2.5 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none"
                title="Played"
              >
                P {renderSortIndicator('played')}
              </th>
              <th 
                onClick={() => handleSort('won')} 
                className="px-2.5 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none"
                title="Ties Won"
              >
                W {renderSortIndicator('won')}
              </th>
              <th className="px-2.5 py-3 text-right" title="Ties Drawn">D</th>
              <th className="px-2.5 py-3 text-right" title="Ties Lost">L</th>
              <th 
                onClick={() => handleSort('rubbers_diff')} 
                className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none"
                title="Rubbers Won - Rubbers Lost"
              >
                R (+/-) {renderSortIndicator('rubbers_diff')}
              </th>
              <th 
                onClick={() => handleSort('sets_diff')} 
                className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none hidden md:table-cell"
                title="Sets Won - Sets Lost"
              >
                S (+/-) {renderSortIndicator('sets_diff')}
              </th>
              <th 
                onClick={() => handleSort('points_diff')} 
                className="px-3 py-3 text-right cursor-pointer hover:text-primary transition-colors select-none hidden lg:table-cell"
                title="Points Won - Points Lost"
              >
                Pts (+/-) {renderSortIndicator('points_diff')}
              </th>
              <th 
                onClick={() => handleSort('tie_points')} 
                className="px-4 py-3 text-right font-black text-primary cursor-pointer hover:underline select-none"
                title="Total League Tie Points (Win = 2, Draw = 1)"
              >
                Pts {renderSortIndicator('tie_points')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {sorted.map((team: any, index: number) => {
              const rDiff = (team.rubbers_for ?? 0) - (team.rubbers_against ?? 0);
              const sDiff = team.sets_diff ?? ((team.sets_for ?? 0) - (team.sets_against ?? 0));
              const pDiff = team.points_diff ?? ((team.points_for ?? 0) - (team.points_against ?? 0));
              
              // Top qualifying indicator (e.g. top 2 in pool)
              const isQualified = index < qualifyingCutoff;

              return (
                <tr 
                  key={team.team_id} 
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                    isQualified ? "bg-emerald-500/[0.02]" : ""
                  }`}
                >
                  {/* Position */}
                  <td className="px-3 sm:px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                      index === 0
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-black shadow-sm"
                        : index === 1
                        ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-black"
                        : index === 2
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                        : "text-slate-400"
                    }`}>
                      {index + 1}
                    </span>
                  </td>

                  {/* Team Name */}
                  <td className="px-3 sm:px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {isQualified && (
                        <div className="w-1.5 h-6 rounded-full bg-emerald-500 shrink-0" title="Qualifies for Playoffs" />
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{team.team_name}</span>
                          {team.short_name && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                              {team.short_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Pool */}
                  {pools.length > 0 && selectedPool === "ALL" && (
                    <td className="px-3 py-3.5 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {team.pool || "-"}
                      </span>
                    </td>
                  )}

                  {/* P */}
                  <td className="px-2.5 py-3.5 text-right font-bold text-slate-500">
                    {team.played ?? 0}
                  </td>

                  {/* W */}
                  <td className="px-2.5 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    {team.won ?? 0}
                  </td>

                  {/* D */}
                  <td className="px-2.5 py-3.5 text-right font-medium text-slate-400">
                    {team.drawn ?? 0}
                  </td>

                  {/* L */}
                  <td className="px-2.5 py-3.5 text-right font-medium text-rose-500">
                    {team.lost ?? 0}
                  </td>

                  {/* Rubbers Diff */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs">
                    <span className={rDiff > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : rDiff < 0 ? "text-rose-500 font-bold" : "text-slate-400"}>
                      {rDiff > 0 ? `+${rDiff}` : rDiff}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({team.rubbers_for ?? 0}-{team.rubbers_against ?? 0})
                    </span>
                  </td>

                  {/* Sets Diff (Medium+ screens) */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs hidden md:table-cell">
                    <span className={sDiff > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : sDiff < 0 ? "text-rose-500 font-bold" : "text-slate-400"}>
                      {sDiff > 0 ? `+${sDiff}` : sDiff}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({team.sets_for ?? 0}-{team.sets_against ?? 0})
                    </span>
                  </td>

                  {/* Points Diff (Large screens) */}
                  <td className="px-3 py-3.5 text-right font-mono text-xs hidden lg:table-cell">
                    <span className={pDiff > 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : pDiff < 0 ? "text-rose-500 font-bold" : "text-slate-400"}>
                      {pDiff > 0 ? `+${pDiff}` : pDiff}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      ({team.points_for ?? 0}-{team.points_against ?? 0})
                    </span>
                  </td>

                  {/* Total Tie Points */}
                  <td className="px-4 py-3.5 text-right font-black text-primary text-base">
                    {team.tie_points ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Top {qualifyingCutoff} teams per pool qualify for knockout playoffs</span>
        </div>
        <div>
          <span>Tie Points: Win = 2, Draw = 1, Loss = 0</span>
        </div>
      </div>
    </div>
  );
}
