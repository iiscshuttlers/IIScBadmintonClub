import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTeamStandings } from "@/hooks/useTeamStandings";
import { Loader2, Trophy, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle } from "lucide-react";
import { TeamRosterModal } from "@/components/events/TeamRosterModal";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface Props {
  tournamentId?: string;
  qualifyingCutoff?: number;
  tournament?: any;
}

type SortColumn = 'tie_points' | 'won' | 'rubbers_diff' | 'sets_diff' | 'points_diff' | 'played';

export function TeamStandingsTable({ tournamentId, qualifyingCutoff = 2, tournament }: Props) {
  const { data: rawStandings = [], isLoading } = useTeamStandings(tournamentId);

  // Dynamically fetch tournament configuration for tie points and qualifying cutoff
  const { data: tournamentConfig } = useQuery({
    queryKey: ['tournament_standings_config', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return null;
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, tie_points_win, tie_points_draw, tie_format_config, bracket_format, format_family')
        .eq('id', tournamentId)
        .maybeSingle();
      if (error) {
        console.warn('Failed to load tournament standings config:', error);
        return null;
      }
      return data;
    },
    enabled: !!tournamentId,
  });

  const activeTourney = tournament || tournamentConfig;

  // Distinct pools
  const pools = useMemo(() => {
    const s = new Set<string>();
    rawStandings.forEach((t: any) => {
      if (t.pool) s.add(t.pool);
    });
    return Array.from(s).sort();
  }, [rawStandings]);

  // Dynamically resolve tie points
  const winPoints = activeTourney?.tie_points_win ?? (typeof activeTourney?.tie_format_config === 'object' && !Array.isArray(activeTourney?.tie_format_config) ? activeTourney?.tie_format_config?.tie_points_win : null) ?? 2;
  const drawPoints = activeTourney?.tie_points_draw ?? (typeof activeTourney?.tie_format_config === 'object' && !Array.isArray(activeTourney?.tie_format_config) ? activeTourney?.tie_format_config?.tie_points_draw : null) ?? 1;
  const lossPoints = (typeof activeTourney?.tie_format_config === 'object' && !Array.isArray(activeTourney?.tie_format_config) ? activeTourney?.tie_format_config?.tie_points_loss : null) ?? 0;

  // Dynamically resolve qualification cutoff
  const rawCutoff = (typeof activeTourney?.tie_format_config === 'object' && !Array.isArray(activeTourney?.tie_format_config) ? (activeTourney?.tie_format_config?.advancing_per_pool ?? activeTourney?.tie_format_config?.qualifying_cutoff) : null) ?? qualifyingCutoff ?? 2;
  const dynamicCutoff = Number(rawCutoff);

  // Dynamic qualification text
  const isPureLeague = dynamicCutoff === 0 || activeTourney?.bracket_format === 'PURE_LEAGUE';
  const hasMultiplePools = pools.length > 1;

  const qualifyingText = useMemo(() => {
    if (isPureLeague) {
      return "League champion decided directly by final table standings (no playoffs)";
    }
    if (hasMultiplePools) {
      return `Top ${dynamicCutoff} teams per pool qualify for knockout playoffs`;
    }
    return `Top ${dynamicCutoff} teams qualify for knockout playoffs`;
  }, [isPureLeague, hasMultiplePools, dynamicCutoff]);

  const [selectedPool, setSelectedPool] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortColumn>("tie_points");
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>("desc");
  const [rosterTeam, setRosterTeam] = useState<{
    id: string;
    name: string;
    short_name?: string | null;
    pool?: string | null;
    captain_id?: string | null;
  } | null>(null);

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
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 shrink-0 opacity-30" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 shrink-0 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 shrink-0 text-primary" />
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
      {/* Top Header & Pool Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Tournament Points Table
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-bold transition-colors cursor-help"
                  aria-label="Table info and rules"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent 
                side="right" 
                sideOffset={8}
                className="max-w-xs p-3.5 space-y-2.5 text-xs bg-slate-950/95 backdrop-blur-md text-slate-100 border border-slate-700/80 shadow-2xl rounded-2xl z-50"
              >
                <div className="flex items-center gap-1.5 font-black text-amber-400 text-xs border-b border-slate-750 pb-1.5 border-slate-800">
                  <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Points Table Rules & Columns</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-medium">
                  <span className="font-black text-sky-400">P</span>
                  <span className="text-slate-200">Matches / Ties Played</span>
                  <span className="font-black text-emerald-400">W</span>
                  <span className="text-slate-200">Ties Won <span className="text-emerald-400 font-bold">(+{winPoints} pts)</span></span>
                  <span className="font-black text-slate-400">D</span>
                  <span className="text-slate-200">Ties Drawn <span className="text-slate-400 font-bold">(+{drawPoints} pts)</span></span>
                  <span className="font-black text-rose-400">L</span>
                  <span className="text-slate-200">Ties Lost <span className="text-rose-400 font-bold">(+{lossPoints} pts)</span></span>
                  <span className="font-black text-cyan-300">R (+/-)</span>
                  <span className="text-slate-200">Rubber Net Diff <span className="text-slate-400 text-[10px]">(For - Against)</span></span>
                  <span className="font-black text-indigo-300">S (+/-)</span>
                  <span className="text-slate-200">Sets Net Diff <span className="text-slate-400 text-[10px]">(For - Against)</span></span>
                  <span className="font-black text-violet-300">PTS (+/-)</span>
                  <span className="text-slate-200">Match Points Net Diff</span>
                  <span className="font-black text-lime-400">PTS</span>
                  <span className="text-lime-300 font-bold">Total Standing Points</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-[11px] font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span>{qualifyingText}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Click column headers to sort. Click any team name to view the complete squad roster.
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
              {/* POS */}
              <th className="px-3 sm:px-4 py-3 text-center w-12 whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">POS</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Position</p>
                    <p className="text-[11px] opacity-80">Current rank in standings</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* TEAM */}
              <th className="px-3 sm:px-4 py-3 whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">TEAM</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Team Name</p>
                    <p className="text-[11px] opacity-80">Click team to view full squad roster</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* Pool */}
              {pools.length > 0 && selectedPool === "ALL" && (
                <th className="px-3 py-3 text-center whitespace-nowrap align-middle">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">POOL</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="font-bold">Pool / Group</p>
                      <p className="text-[11px] opacity-80">Group stage pool assignment</p>
                    </TooltipContent>
                  </Tooltip>
                </th>
              )}

              {/* P */}
              <th className="px-2.5 py-3 text-right whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      onClick={() => handleSort('played')} 
                      className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <span>P</span>
                      {renderSortIndicator('played')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Played (P)</p>
                    <p className="text-[11px] opacity-80">Total matches / ties played</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* W */}
              <th className="px-2.5 py-3 text-right whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      onClick={() => handleSort('won')} 
                      className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <span>W</span>
                      {renderSortIndicator('won')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Won (W)</p>
                    <p className="text-[11px] opacity-80">Ties won (+{winPoints} pts each)</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* D */}
              <th className="px-2.5 py-3 text-right whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center justify-end select-none cursor-help">
                      <span>D</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Drawn (D)</p>
                    <p className="text-[11px] opacity-80">Ties ending in a draw (+{drawPoints} pts each)</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* L */}
              <th className="px-2.5 py-3 text-right whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center justify-end select-none cursor-help">
                      <span>L</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Lost (L)</p>
                    <p className="text-[11px] opacity-80">Ties lost (+{lossPoints} pts each)</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* R (+/-) */}
              <th className="px-3 py-3 text-right whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      onClick={() => handleSort('rubbers_diff')} 
                      className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <span>R (+/-)</span>
                      {renderSortIndicator('rubbers_diff')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Rubber Difference</p>
                    <p className="text-[11px] opacity-80">Rubbers won minus rubbers lost (For - Against)</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* S (+/-) */}
              <th className="px-3 py-3 text-right whitespace-nowrap align-middle hidden md:table-cell">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      onClick={() => handleSort('sets_diff')} 
                      className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <span>S (+/-)</span>
                      {renderSortIndicator('sets_diff')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Set Difference</p>
                    <p className="text-[11px] opacity-80">Sets won minus sets lost (For - Against)</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* PTS (+/-) */}
              <th className="px-3 py-3 text-right whitespace-nowrap align-middle hidden lg:table-cell">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      onClick={() => handleSort('points_diff')} 
                      className="inline-flex items-center justify-end gap-1 cursor-pointer hover:text-primary transition-colors select-none"
                    >
                      <span>PTS (+/-)</span>
                      {renderSortIndicator('points_diff')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Points Difference</p>
                    <p className="text-[11px] opacity-80">Match game points won minus game points lost</p>
                  </TooltipContent>
                </Tooltip>
              </th>

              {/* Total Tie Points */}
              <th className="px-4 py-3 text-right whitespace-nowrap align-middle">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      onClick={() => handleSort('tie_points')} 
                      className="inline-flex items-center justify-end gap-1 font-black text-primary cursor-pointer hover:underline select-none"
                    >
                      <span>PTS</span>
                      {renderSortIndicator('tie_points')}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="font-bold">Total League Standing Points</p>
                    <p className="text-[11px] opacity-80">Win = {winPoints}, Draw = {drawPoints}, Loss = {lossPoints}</p>
                  </TooltipContent>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {sorted.map((team: any, index: number) => {
              const rDiff = (team.rubbers_for ?? 0) - (team.rubbers_against ?? 0);
              const sDiff = team.sets_diff ?? ((team.sets_for ?? 0) - (team.sets_against ?? 0));
              const pDiff = team.points_diff ?? ((team.points_for ?? 0) - (team.points_against ?? 0));
              
              // Top qualifying indicator (dynamically based on cutoff)
              const isQualified = !isPureLeague && dynamicCutoff > 0 && index < dynamicCutoff;

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
                        <div 
                          className="w-1.5 h-6 rounded-full bg-emerald-500 shrink-0" 
                          title={hasMultiplePools ? `Top ${dynamicCutoff} in pool qualifies for playoffs` : `Top ${dynamicCutoff} qualifies for playoffs`} 
                        />
                      )}
                      <div>
                        <button
                          type="button"
                          onClick={() => setRosterTeam({
                            id: team.team_id,
                            name: team.team_name,
                            short_name: team.short_name,
                            pool: team.pool,
                          })}
                          className="group flex items-center gap-2 text-left focus:outline-hidden"
                          title="Click to view complete team roster"
                        >
                          <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors underline-offset-4 group-hover:underline cursor-pointer">
                            {team.team_name}
                          </span>
                          {team.short_name && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                              {team.short_name}
                            </span>
                          )}
                        </button>
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

      {/* Footer Info (Dynamically fetched per tournament) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPureLeague ? "bg-amber-500" : "bg-emerald-500"}`} />
          <span>{qualifyingText}</span>
        </div>
        <div>
          <span>Tie Points: Win = {winPoints}, Draw = {drawPoints}, Loss = {lossPoints}</span>
        </div>
      </div>

      {/* Team Roster Popup Modal */}
      <TeamRosterModal
        isOpen={!!rosterTeam}
        onClose={() => setRosterTeam(null)}
        team={rosterTeam}
        tournamentId={tournamentId}
      />
    </div>
  );
}
