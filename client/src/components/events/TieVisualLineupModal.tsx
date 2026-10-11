import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  X, 
  Swords, 
  Radio, 
  Clock, 
  CheckCircle2, 
  Lock, 
  Eye, 
  ShieldAlert, 
  Users, 
  ChevronRight, 
  Trophy,
  LayoutGrid,
  ListFilter,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useTeamModal } from '@/contexts/TeamModalContext';
import { usePlayerModal } from '@/contexts/PlayerModalContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tie: any;
  tournament?: any;
}

export function TieVisualLineupModal({ isOpen, onClose, tie, tournament }: Props) {
  const { openTeamModal } = useTeamModal();
  const { openPlayerModal } = usePlayerModal();
  const [viewMode, setViewMode] = useState<'court' | 'list'>('court');

  // 1. Fetch rubber matches for this tie
  const { data: rubbers = [], isLoading: rubbersLoading } = useQuery({
    queryKey: ['visual_tie_rubbers', tie?.id],
    queryFn: async () => {
      if (!tie?.id) return [];
      const { data, error } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url, gender),
          player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url, gender),
          player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url, gender),
          player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url, gender),
          revealer:players!tournament_matches_revealed_by_fkey(id, full_name)
        `)
        .eq('tie_id', tie.id)
        .order('playing_order', { ascending: true, nullsFirst: false });
      if (error) throw error;

      // Sort by playing_order if present, else rubber_order
      return (data || []).sort((a: any, b: any) => {
        const orderA = a.playing_order ?? a.rubber_order ?? 99;
        const orderB = b.playing_order ?? b.rubber_order ?? 99;
        return orderA - orderB;
      });
    },
    enabled: isOpen && !!tie?.id,
    refetchInterval: 4000
  });

  // 2. Fetch substitutions audit
  const { data: audits = [] } = useQuery({
    queryKey: ['visual_tie_audits', tie?.id],
    queryFn: async () => {
      if (!tie?.id) return [];
      const { data, error } = await supabase
        .from('tie_lineup_audits')
        .select(`
          *,
          referee:players!tie_lineup_audits_referee_id_fkey(full_name),
          orig_player:players!tie_lineup_audits_original_player_id_fkey(full_name),
          repl_player:players!tie_lineup_audits_replacement_player_id_fkey(full_name)
        `)
        .eq('tie_id', tie.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!tie?.id
  });

  if (!isOpen || !tie) return null;

  const isRevealed = rubbers.some((r: any) => r.is_revealed || r.player1_id);
  const isBothLocked = tie.lineup_locked_a && tie.lineup_locked_b;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="max-w-4xl w-full max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-primary text-slate-950">
                {tie.tie_code}
              </span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {tie.round_name || tie.stage || 'FIXTURE'}
              </span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                tie.state === 'IN_PROGRESS'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                  : tie.state === 'COMPLETED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {tie.state}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Layout view toggle */}
              <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('court')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                    viewMode === 'court' ? 'bg-primary text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Court Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition ${
                    viewMode === 'list' ? 'bg-primary text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" /> List
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Teams Matchup Header */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            {/* Team A */}
            <div 
              onClick={() => tie.team_a && openTeamModal(tie.team_a)}
              className="flex items-center gap-3 cursor-pointer group p-2 rounded-2xl hover:bg-slate-800/40 transition"
              title="Click to view Team A roster and matches"
            >
              {tie.team_a?.logo_url ? (
                <img src={tie.team_a.logo_url} alt="" className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-lg text-white shrink-0 shadow-inner">
                  {tie.team_a?.short_name || 'A'}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-black text-base sm:text-lg group-hover:text-primary transition-colors truncate">
                  {tie.team_a?.name || "Team A"}
                </h3>
                <span className="text-xs text-slate-400 uppercase font-bold">
                  {tie.team_a?.short_name || "Side A"}
                </span>
              </div>
            </div>

            {/* Score Center */}
            <div className="flex flex-col items-center justify-center px-4">
              <div className="font-mono text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <span className="text-primary">{tie.score_team_a ?? 0}</span>
                <span className="text-slate-500">-</span>
                <span className="text-primary">{tie.score_team_b ?? 0}</span>
              </div>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">TIE SCORE</span>
            </div>

            {/* Team B */}
            <div 
              onClick={() => tie.team_b && openTeamModal(tie.team_b)}
              className="flex items-center justify-end gap-3 cursor-pointer group p-2 rounded-2xl hover:bg-slate-800/40 transition text-right"
              title="Click to view Team B roster and matches"
            >
              <div className="min-w-0">
                <h3 className="font-black text-base sm:text-lg group-hover:text-primary transition-colors truncate">
                  {tie.team_b?.name || "Team B"}
                </h3>
                <span className="text-xs text-slate-400 uppercase font-bold">
                  {tie.team_b?.short_name || "Side B"}
                </span>
              </div>
              {tie.team_b?.logo_url ? (
                <img src={tie.team_b.logo_url} alt="" className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 to-rose-700 flex items-center justify-center font-black text-lg text-white shrink-0 shadow-inner">
                  {tie.team_b?.short_name || 'B'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secret / Lock status notice */}
        {!isRevealed ? (
          <div className={`p-4 border-b flex items-center justify-between gap-3 text-xs ${
            isBothLocked
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <div className="flex items-center gap-2.5">
              {isBothLocked ? (
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-semibold">
                {isBothLocked 
                  ? "Both teams have locked secret lineups. Head-to-head pairings will appear as soon as the match referee reveals them."
                  : (!tie.lineup_locked_a && !tie.lineup_locked_b)
                    ? "Both teams are yet to submit their lineup."
                    : !tie.lineup_locked_a
                      ? `${tie.team_a?.name || "Team A"} is yet to submit their lineup.`
                      : `${tie.team_b?.name || "Team B"} is yet to submit their lineup.`
                }
              </span>
            </div>
            <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
              isBothLocked
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {isBothLocked ? "Lineups Locked" : "Lineup Pending"}
            </span>
          </div>
        ) : (!tie.lineup_locked_a || !tie.lineup_locked_b) ? (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold">
                {!tie.lineup_locked_a && !tie.lineup_locked_b
                  ? "Notice: Both teams are yet to submit their tiebreaker lineup."
                  : !tie.lineup_locked_a
                    ? `Notice: ${tie.team_a?.name || "Team A"} is yet to submit their tiebreaker lineup.`
                    : `Notice: ${tie.team_b?.name || "Team B"} is yet to submit their tiebreaker lineup.`
                }
              </span>
            </div>
          </div>
        ) : null}

        {/* Scrollable Court Rubbers Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {rubbersLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-xs text-slate-400 mt-2 font-bold">Loading visual court lineup...</p>
            </div>
          ) : rubbers.length === 0 ? (
            <div className="py-16 text-center bg-slate-800/40 rounded-2xl border border-dashed border-slate-800">
              <Swords className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-300">No rubbers configured for this tie</p>
            </div>
          ) : (
            <div className={viewMode === 'court' ? "grid grid-cols-1 gap-4" : "space-y-3"}>
              {rubbers.map((rubber: any, idx: number) => {
                const isDoubles = rubber.category.includes('D');
                const isDecider = rubber.is_decider_tiebreaker || rubber.match_code?.includes('DECIDER');
                const rubberRevealed = rubber.is_revealed || !!rubber.player1_id;

                const s1 = rubber.set1_team1 !== null ? `${rubber.set1_team1}-${rubber.set1_team2}` : null;
                const s2 = rubber.set2_team1 !== null ? `${rubber.set2_team1}-${rubber.set2_team2}` : null;
                const s3 = rubber.set3_team1 !== null ? `${rubber.set3_team1}-${rubber.set3_team2}` : null;
                const scoreString = [s1, s2, s3].filter(Boolean).join("  •  ");

                return (
                  <div
                    key={rubber.id || idx}
                    className={`relative rounded-3xl border transition-all overflow-hidden ${
                      rubber.status === 'live' || rubber.status === 'in_progress'
                        ? "bg-slate-900 border-rose-500/50 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/30"
                        : rubber.status === 'completed'
                        ? "bg-slate-900/90 border-slate-700/80"
                        : "bg-slate-900/70 border-slate-800"
                    }`}
                  >
                    {/* Top Court Banner */}
                    <div className="px-4 py-2.5 bg-slate-800/60 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[11px] px-2 py-0.5 rounded-lg bg-primary text-slate-950">
                          {rubber.category}
                        </span>
                        <span className="font-bold text-slate-200">
                          {rubber.rubber_label || `Rubber #${rubber.rubber_order}`}
                        </span>
                        {rubber.playing_order && (
                          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded-full border border-cyan-800/50">
                            Court Match #{rubber.playing_order}
                          </span>
                        )}
                        {isDecider && (
                          <span className="text-[10px] font-black text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/50">
                            Extra Decider Rubber
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {rubber.status === 'live' || rubber.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                            <Radio className="w-3 h-3" /> ON COURT LIVE
                          </span>
                        ) : rubber.status === 'completed' ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            COMPLETED
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">
                            SCHEDULED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Head-to-Head Visual Court Body */}
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950/40 via-slate-900/20 to-slate-950/40">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                        
                        {/* Team A Players */}
                        <div className="flex items-center gap-3 min-w-0">
                          {rubberRevealed ? (
                            <div className="space-y-1.5 min-w-0">
                              {/* Player 1 */}
                              {rubber.player1 ? (
                                <button
                                  type="button"
                                  onClick={() => openPlayerModal(rubber.player1.id)}
                                  className="flex items-center gap-2 group/p text-left cursor-pointer hover:opacity-80 transition"
                                  title="View player profile"
                                >
                                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                    {rubber.player1?.avatar_url ? (
                                      <img src={rubber.player1.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                    ) : (
                                      rubber.player1?.full_name?.charAt(0) || 'A'
                                    )}
                                  </div>
                                  <span className="font-bold text-sm text-slate-100 group-hover/p:text-primary transition-colors truncate">
                                    {rubber.player1?.full_name || 'Pending'}
                                  </span>
                                </button>
                              ) : (
                                <span className="font-bold text-sm text-slate-400">Pending</span>
                              )}
                              {/* Player 2 if doubles */}
                              {isDoubles && (
                                rubber.player2 ? (
                                  <button
                                    type="button"
                                    onClick={() => openPlayerModal(rubber.player2.id)}
                                    className="flex items-center gap-2 group/p text-left cursor-pointer hover:opacity-80 transition"
                                    title="View player profile"
                                  >
                                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                      {rubber.player2?.avatar_url ? (
                                        <img src={rubber.player2.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                      ) : (
                                        rubber.player2?.full_name?.charAt(0) || 'A'
                                      )}
                                    </div>
                                    <span className="font-bold text-sm text-slate-100 group-hover/p:text-primary transition-colors truncate">
                                      {rubber.player2?.full_name || 'Pending'}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="font-bold text-sm text-slate-400">Pending</span>
                                )
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-500 italic text-xs">
                              <Lock className="w-4 h-4 text-slate-600" />
                              <span>Secret Lineup</span>
                            </div>
                          )}
                        </div>

                        {/* Center Court Net & Score */}
                        <div className="flex flex-col items-center justify-center px-3 sm:px-6 border-x border-slate-800/80">
                          {scoreString ? (
                            <div className="font-mono text-sm sm:text-base font-black text-primary tracking-wide whitespace-nowrap text-center">
                              {scoreString}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-700">
                              VS
                            </div>
                          )}
                          <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase">
                            {rubber.best_of_sets ? `Best of ${rubber.best_of_sets}` : 'Best of 3'}
                          </span>
                        </div>

                        {/* Team B Players */}
                        <div className="flex items-center justify-end gap-3 min-w-0 text-right">
                          {rubberRevealed ? (
                            <div className="space-y-1.5 min-w-0">
                              {/* Player 3 */}
                              {rubber.player3 ? (
                                <button
                                  type="button"
                                  onClick={() => openPlayerModal(rubber.player3.id)}
                                  className="flex items-center justify-end gap-2 group/p text-right cursor-pointer hover:opacity-80 transition w-full"
                                  title="View player profile"
                                >
                                  <span className="font-bold text-sm text-slate-100 group-hover/p:text-primary transition-colors truncate">
                                    {rubber.player3?.full_name || 'Pending'}
                                  </span>
                                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                    {rubber.player3?.avatar_url ? (
                                      <img src={rubber.player3.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                    ) : (
                                      rubber.player3?.full_name?.charAt(0) || 'B'
                                    )}
                                  </div>
                                </button>
                              ) : (
                                <span className="font-bold text-sm text-slate-400">Pending</span>
                              )}
                              {/* Player 4 if doubles */}
                              {isDoubles && (
                                rubber.player4 ? (
                                  <button
                                    type="button"
                                    onClick={() => openPlayerModal(rubber.player4.id)}
                                    className="flex items-center justify-end gap-2 group/p text-right cursor-pointer hover:opacity-80 transition w-full"
                                    title="View player profile"
                                  >
                                    <span className="font-bold text-sm text-slate-100 group-hover/p:text-primary transition-colors truncate">
                                      {rubber.player4?.full_name || 'Pending'}
                                    </span>
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                      {rubber.player4?.avatar_url ? (
                                        <img src={rubber.player4.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                      ) : (
                                        rubber.player4?.full_name?.charAt(0) || 'B'
                                      )}
                                    </div>
                                  </button>
                                ) : (
                                  <span className="font-bold text-sm text-slate-400">Pending</span>
                                )
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-500 italic text-xs">
                              <span>Secret Lineup</span>
                              <Lock className="w-4 h-4 text-slate-600" />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* Revealer / Timestamp info footer if revealed */}
                    {rubber.revealed_at && rubber.revealer && (
                      <div className="px-4 py-1.5 bg-slate-950/60 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-primary" />
                          Revealed by: <strong className="text-slate-300">{rubber.revealer.full_name}</strong>
                        </span>
                        <span>{new Date(rubber.revealed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit trail alert if any substitutions occurred */}
          {audits.length > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 space-y-1.5">
              <div className="font-black flex items-center gap-1.5 text-amber-400">
                <ShieldAlert className="w-4 h-4" /> Official Player Substitution Notice
              </div>
              {audits.map((a: any) => (
                <div key={a.id} className="text-[11px] text-slate-300">
                  Rubber #{a.rubber_order} ({a.side}): <strong className="text-amber-300">{a.repl_player?.full_name}</strong> substituted for {a.orig_player?.full_name}. Authorized by referee {a.referee?.full_name} with dual captain consent. Reason: "{a.reason}"
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-400 font-bold">
            Total Rubbers: {rubbers.length}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-full transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
