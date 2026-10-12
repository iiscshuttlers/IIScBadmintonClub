import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, Save, Loader2, ArrowUp, ArrowDown, Send, CheckCircle2, ShieldAlert, AlertTriangle, GripVertical } from 'lucide-react';
import { useConfirm } from '@/contexts/ConfirmContext';
import { validateLineupAssignments, getPlayerEligibilityForRubber } from '@/lib/teamLineupRules';


export function TeamLineupBuilder({ 
  tie, 
  team, 
  members, 
  isCaptain, 
  side 
}: { 
  tie: any; 
  team: any; 
  members: any[]; 
  isCaptain: boolean; 
  side: 'A' | 'B'; 
}) {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const rawFormatConfig = team.tournaments?.tie_format_config;
  let defaultRubbers: any[] = [];
  if (Array.isArray(rawFormatConfig)) defaultRubbers = rawFormatConfig;
  else if (rawFormatConfig?.rubbers && Array.isArray(rawFormatConfig.rubbers)) defaultRubbers = rawFormatConfig.rubbers;

  // Local state for assignments and proposed order
  const [orderedRubbers, setOrderedRubbers] = useState<any[]>(defaultRubbers);
  const [assignments, setAssignments] = useState<Record<number, { player1_id: string; player2_id: string }>>({});
  const [submissionCount, setSubmissionCount] = useState<number>(0);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Fetch existing lineups
  const { data: existingLineups = [], isLoading } = useQuery({
    queryKey: ['tie_lineups', tie.id, side],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tie_lineups')
        .select('*')
        .eq('tie_id', tie.id)
        .eq('side', side);
      if (error) throw error;
      
      const newAssignments: any = {};
      data.forEach((d: any) => {
        newAssignments[d.rubber_order] = { 
          player1_id: d.player1_id || '', 
          player2_id: d.player2_id || '',
          is_revealed: d.is_revealed || false
        };
      });
      setAssignments(newAssignments);
      if (data.length > 0) setSubmissionCount(1);
      return data;
    },
    enabled: !!tie.id
  });

  // Fetch matches for this tie to detect conditional decider rubbers
  const { data: tieMatches = [] } = useQuery({
    queryKey: ['lineup_tie_matches', tie.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tie_id', tie.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tie.id
  });

  const deciderMatch = tieMatches.find((m: any) => m.is_decider_tiebreaker);
  const deciderLineup = existingLineups.find((l: any) => l.is_decider || (deciderMatch && l.rubber_order === deciderMatch.rubber_order));
  const isDeciderRevealed = Boolean(deciderMatch?.revealed_at || deciderLineup?.is_revealed);
  const isDeciderDoubles = deciderMatch ? (deciderMatch.category.includes('D') || deciderMatch.category.includes('Doubles')) : false;

  const [deciderPlayer1, setDeciderPlayer1] = useState<string>('');
  const [deciderPlayer2, setDeciderPlayer2] = useState<string>('');

  useEffect(() => {
    if (deciderLineup) {
      setDeciderPlayer1(deciderLineup.player1_id || '');
      setDeciderPlayer2(deciderLineup.player2_id || '');
    }
  }, [deciderLineup]);

  // Re-sync orderedRubbers when format changes, excluding decider matches from regular lineup
  useEffect(() => {
    if (defaultRubbers.length > 0) {
      setOrderedRubbers(defaultRubbers.filter((r: any) => !r.is_decider_tiebreaker && (!deciderMatch || r.order !== deciderMatch.rubber_order)));
    }
  }, [defaultRubbers.length, deciderMatch?.id]);

  const submitDeciderLineup = useMutation({
    mutationFn: async () => {
      if (!deciderPlayer1) {
        throw new Error("Please select Player 1 for the decider match.");
      }
      if (isDeciderDoubles && !deciderPlayer2) {
        throw new Error("Please select Player 2 (partner) for the decider match.");
      }
      const { data, error } = await (supabase.rpc as any)('submit_decider_lineup', {
        p_tie_id: tie.id,
        p_side: side,
        p_player1_id: deciderPlayer1,
        p_player2_id: isDeciderDoubles ? deciderPlayer2 : null
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(data.both_ready ? "Decider lineup locked! Awaiting match official to reveal." : "Decider lineup submitted! Waiting for opponent captain.");
      queryClient.invalidateQueries({ queryKey: ['tie_lineups', tie.id, side] });
      queryClient.invalidateQueries({ queryKey: ['lineup_tie_matches', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const isAnyRevealed = existingLineups.some((l: any) => l.is_revealed);

  const moveRubber = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === orderedRubbers.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const copy = [...orderedRubbers];
    const item = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = item;
    setOrderedRubbers(copy);
  };

  const reorderRubberToIndex = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= orderedRubbers.length || toIndex >= orderedRubbers.length) return;

    const updated = [...orderedRubbers];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    setOrderedRubbers(updated);
  };

  const updateAssignment = (order: number, pos: 1 | 2, playerId: string) => {
    setAssignments(prev => ({
      ...prev,
      [order]: {
        ...prev[order],
        [`player${pos}_id`]: playerId
      }
    }));
  };

  const submitLineup = useMutation({
    mutationFn: async () => {
      // Build payload based on orderedRubbers
      const payload = orderedRubbers.map((rubber, idx) => {
        const assign = assignments[rubber.order] || { player1_id: '', player2_id: '' };
        return {
          rubber_order: rubber.order,
          proposed_playing_order: idx + 1,
          player1_id: assign.player1_id,
          player2_id: assign.player2_id
        };
      }).filter(a => a.player1_id);

      if (payload.length === 0) {
        throw new Error("Please assign players to at least one rubber before submitting.");
      }

      // Save assignments via upsert loop
      const { data: authData } = await supabase.auth.getSession();
      const currentUserId = authData?.session?.user?.id;

      const inserts = payload.map(p => ({
        tie_id: tie.id,
        side,
        rubber_order: p.rubber_order,
        proposed_playing_order: p.proposed_playing_order,
        player1_id: p.player1_id,
        player2_id: p.player2_id || null,
        submitted_by: currentUserId || p.player1_id
      }));

      // Direct upsert with conflict on tie_id, side, rubber_order
      for (const row of inserts) {
        const { error } = await supabase.from('tie_lineups').upsert(row, {
          onConflict: 'tie_id,side,rubber_order'
        });
        if (error) throw error;
      }

      setSubmissionCount(prev => prev + 1);
    },
    onSuccess: () => {
      toast.success('Proposed Lineup submitted! You can revise it or lock when finalized.');
      queryClient.invalidateQueries({ queryKey: ['tie_lineups', tie.id, side] });
      queryClient.invalidateQueries({ queryKey: ['my_ties'] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const lockLineupMutation = useMutation({
    mutationFn: async () => {
      // First ensure lineup is submitted/saved
      if (submissionCount === 0) {
        await submitLineup.mutateAsync();
      }
      const { error } = await supabase.rpc('lock_tie_lineup', {
        p_tie_id: tie.id,
        p_side: side
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lineup locked successfully! Awaiting match official to review and reveal.');
      queryClient.invalidateQueries({ queryKey: ['tie_lineups', tie.id, side] });
      queryClient.invalidateQueries({ queryKey: ['my_ties'] });
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const isMySideLocked = side === 'A' ? tie.lineup_locked_a : tie.lineup_locked_b;
  const isOpponentLocked = side === 'A' ? tie.lineup_locked_b : tie.lineup_locked_a;
  const isBothLocked = tie.lineup_locked_a && tie.lineup_locked_b;

  const activeMembers = members.filter(m => m.status === 'ACTIVE');

  // Real-time lineup validation against rules
  const rulesObj = typeof rawFormatConfig === 'object' && !Array.isArray(rawFormatConfig) ? rawFormatConfig : {};
  const validationResult = React.useMemo(() => {
    return validateLineupAssignments(
      assignments,
      orderedRubbers,
      activeMembers,
      {
        max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2,
        max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2,
        max_rubbers_per_player: team.tournaments?.max_rubbers_per_player ?? 2,
        allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
        allow_repeat_in_decider: rulesObj.allow_repeat_in_decider ?? true,
        allow_same_event_repeat_in_decider: rulesObj.allow_same_event_repeat_in_decider ?? false,
        ignore_gender_rules: team.tournaments?.ignore_gender_rules
      },
      deciderMatch ? { rubber_order: deciderMatch.rubber_order, category: deciderMatch.category } : undefined
    );
  }, [assignments, orderedRubbers, activeMembers, rulesObj, deciderMatch]);

  if (isLoading) return <Loader2 className="animate-spin w-5 h-5 mx-auto" />;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mt-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
            Team {side} Lineup &amp; Proposed Playing Order
          </h3>
          <p className="text-xs text-slate-500">
            Assign players and drag rows or use arrows to propose the order of play. Once locked, the referee/organizer/umpire will review orders and reveal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAnyRevealed ? (
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> REVEALED
            </span>
          ) : isMySideLocked ? (
            <span className="text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" /> LOCKED
            </span>
          ) : submissionCount > 0 ? (
            <span className="text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-full">
              SUBMITTED (v{submissionCount})
            </span>
          ) : (
            <span className="text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-full">
              DRAFT
            </span>
          )}
        </div>
      </div>

      {/* Lock status banner */}
      {isMySideLocked && !isAnyRevealed && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
          isBothLocked
            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
        }`}>
          <Lock className="w-4 h-4 shrink-0 text-primary" />
          <div>
            {isBothLocked ? (
              <span>
                <strong>Both Captains Have Locked Lineups!</strong> The tie is awaiting the Referee / Organizer / Umpire to compare proposed playing orders and trigger the official reveal.
              </span>
            ) : (
              <span>
                <strong>Your Lineup is Locked.</strong> Awaiting the opponent captain ({isOpponentLocked ? "Locked" : "Pending"}) to finalize and lock their lineup.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Rubber List with Order Arrows & Drag Handle */}
      <div className="space-y-2.5">
        {orderedRubbers.map((rubber, index) => {
          const isDoubles = rubber.category.includes('D') || rubber.category.includes('Doubles');
          const assign = assignments[rubber.order] || { player1_id: '', player2_id: '' };
          const isThisRevealed = existingLineups.find((l: any) => l.rubber_order === rubber.order)?.is_revealed;
          const isRowDisabled = !isCaptain || isThisRevealed || isMySideLocked;
          const isBeingDragged = draggedIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div 
              key={rubber.order} 
              draggable={!isRowDisabled}
              onDragStart={(e) => {
                if (isRowDisabled) return;
                setDraggedIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index.toString());
              }}
              onDragOver={(e) => {
                if (isRowDisabled) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverIndex !== index) {
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => {
                if (dragOverIndex === index) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                if (isRowDisabled) return;
                e.preventDefault();
                const sourceIndex = draggedIndex ?? parseInt(e.dataTransfer.getData('text/plain'), 10);
                if (!isNaN(sourceIndex) && sourceIndex !== index) {
                  reorderRubberToIndex(sourceIndex, index);
                }
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDraggedIndex(null);
                setDragOverIndex(null);
              }}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border transition-all ${
                isBeingDragged
                  ? 'opacity-40 border-dashed border-primary ring-2 ring-primary/40 scale-[0.99]'
                  : isOver
                    ? 'border-primary ring-2 ring-primary/60 bg-primary/5 dark:bg-primary/10 shadow-lg'
                    : isThisRevealed 
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20' 
                      : isMySideLocked
                        ? 'border-slate-200 dark:border-slate-800 opacity-90'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Drag Handle, Proposed Order Indicator & Reorder Arrows */}
              <div className="flex items-center gap-2">
                {!isRowDisabled && (
                  <div 
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Drag to reorder match priority"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                )}
                <div className="flex flex-col items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-black">
                  #{index + 1}
                </div>
                {isCaptain && !isThisRevealed && !isMySideLocked && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveRubber(index, 'UP')}
                      disabled={index === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-20"
                      title="Move up in playing order"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRubber(index, 'DOWN')}
                      disabled={index === orderedRubbers.length - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-20"
                      title="Move down in playing order"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Rubber Label & Category */}
              <div className="w-24 shrink-0">
                <span className="font-black text-xs text-primary block">{rubber.label}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">{rubber.category}</span>
              </div>

              {/* Player Selectors */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select 
                  className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  value={assign.player1_id}
                  onChange={e => updateAssignment(rubber.order, 1, e.target.value)}
                  disabled={isRowDisabled}
                >
                  <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select Player 1</option>
                  {activeMembers.map(m => {
                    const stats = validationResult.playerAppearanceCounts[m.player_id];
                    const count = stats?.total || 0;
                    const gender = m.players?.gender || 'M';
                    const cap = gender === 'Female' || gender === 'F' 
                      ? (rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2)
                      : (rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2);
                    const name = m.players?.full_name || m.players?.nickname || m.players?.email || 'Player';
                    const elig = getPlayerEligibilityForRubber(
                      { id: m.player_id, full_name: name, gender },
                      rubber,
                      assignments,
                      {
                        max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2,
                        max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2,
                        allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                        ignore_gender_rules: team.tournaments?.ignore_gender_rules
                      },
                      assign.player1_id,
                      orderedRubbers
                    );

                    return (
                      <option 
                        key={m.player_id} 
                        value={m.player_id} 
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        {name} ({gender === 'Female' || gender === 'F' ? '♀' : '♂'}) {count > 0 ? `[${count}/${cap} rubbers]` : ''} {!elig.eligible ? `⚠️ (${elig.reason})` : ''}
                      </option>
                    );
                  })}
                </select>

                {isDoubles && (
                  <select 
                    className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700/80 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                    value={assign.player2_id}
                    onChange={e => updateAssignment(rubber.order, 2, e.target.value)}
                    disabled={isRowDisabled}
                  >
                    <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Select Player 2 (Partner)</option>
                    {activeMembers.map(m => {
                      const stats = validationResult.playerAppearanceCounts[m.player_id];
                      const count = stats?.total || 0;
                      const gender = m.players?.gender || 'M';
                      const cap = gender === 'Female' || gender === 'F' 
                        ? (rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2)
                        : (rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2);
                      const name = m.players?.full_name || m.players?.nickname || m.players?.email || 'Player';
                      const elig = getPlayerEligibilityForRubber(
                        { id: m.player_id, full_name: name, gender },
                        rubber,
                        assignments,
                        {
                          max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2,
                          max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2,
                          allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                          ignore_gender_rules: team.tournaments?.ignore_gender_rules
                        },
                        assign.player2_id,
                        orderedRubbers
                      );

                      return (
                        <option 
                          key={m.player_id} 
                          value={m.player_id} 
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        >
                          {name} ({gender === 'Female' || gender === 'F' ? '♀' : '♂'}) {count > 0 ? `[${count}/${cap} rubbers]` : ''} {!elig.eligible ? `⚠️ (${elig.reason})` : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>


              {isThisRevealed ? (
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  Revealed
                </span>
              ) : isMySideLocked ? (
                <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  Locked
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Validation Rule Violations Alert */}
      {!validationResult.isValid && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Lineup Rule Violations Detected:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1 font-medium">
            {validationResult.errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons for Captain */}
      {isCaptain && !isAnyRevealed && !isMySideLocked && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-700/80">
          <Button 
            onClick={() => submitLineup.mutate()} 
            disabled={submitLineup.isPending || lockLineupMutation.isPending}
            variant="outline"
            className="rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 h-10 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Send className="w-3.5 h-3.5" /> 
            {submissionCount > 0 ? "Update Draft" : "Save Proposed Lineup"}
          </Button>

          <button 
            type="button"
            onClick={async () => {
              if (!validationResult.isValid) {
                toast.error("Cannot lock lineup: Please resolve rule violations first.");
                return;
              }

              const ok = await confirm({
                title: "Lock Team Lineup?",
                description: "Are you sure you want to lock your lineup? You will not be able to edit player assignments or playing order after locking.",
                confirmLabel: "Lock Lineup",
                confirmVariant: "primary"
              });
              if (ok) {
                lockLineupMutation.mutate();
              }
            }} 
            disabled={submitLineup.isPending || lockLineupMutation.isPending || !validationResult.isValid}
            className="rounded-xl font-black bg-primary hover:brightness-110 active:scale-[0.99] text-slate-950 text-xs flex items-center justify-center gap-2 h-10 px-4 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
          >
            {lockLineupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Lock Lineup</span>
          </button>
        </div>
      )}

      {/* 2. Conditional Sudden Death Decider Rubber (if configured or added) */}
      {deciderMatch && (
        <div className={`p-4 rounded-2xl border-2 space-y-3 transition-all ${
          isDeciderRevealed
            ? 'bg-emerald-50/20 border-emerald-300 dark:border-emerald-800'
            : (tie.has_decider_rubber || tie.decider_status !== 'NOT_APPLICABLE' || (tie.score_team_a === tie.score_team_b && tie.score_team_a > 0))
              ? 'bg-amber-500/10 border-amber-500/40 ring-2 ring-amber-500/20'
              : 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-80'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Tiebreaker Decider Match: {deciderMatch.rubber_label}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {deciderMatch.category} · {deciderMatch.best_of_sets} Set(s) to {deciderMatch.points_to_win} pts
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(tie.has_decider_rubber || tie.decider_status !== 'NOT_APPLICABLE' || (tie.score_team_a === tie.score_team_b && tie.score_team_a > 0))
                    ? "Scores are level! Captains must now submit and lock their player for the deciding match."
                    : "Reserved for tiebreak. Lineup submitted later if scores reach a draw."
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isDeciderRevealed ? (
                <span className="text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> REVEALED
                </span>
              ) : deciderLineup ? (
                <span className="text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> LOCKED
                </span>
              ) : (
                <span className="text-xs font-black bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full">
                  {(tie.has_decider_rubber || tie.decider_status !== 'NOT_APPLICABLE' || (tie.score_team_a === tie.score_team_b && tie.score_team_a > 0)) ? "ACTION REQUIRED" : "STANDBY"}
                </span>
              )}
            </div>
          </div>

          {/* Decider Player Selection (Unlocked if tie is active or lineup submitted) */}
          {(tie.has_decider_rubber || tie.decider_status !== 'NOT_APPLICABLE' || (tie.score_team_a === tie.score_team_b && tie.score_team_a > 0) || deciderLineup) && (
            <div className="pt-2 border-t border-amber-500/20 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Decider Player 1
                  </label>
                  <select
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 disabled:opacity-50"
                    value={deciderPlayer1}
                    onChange={(e) => setDeciderPlayer1(e.target.value)}
                    disabled={!isCaptain || isDeciderRevealed || !!deciderLineup}
                  >
                    <option value="">Select Player 1</option>
                    {activeMembers.map(m => {
                      const gender = m.players?.gender || 'M';
                      const name = m.players?.display_name || m.players?.full_name || 'Player';
                      const elig = deciderMatch ? getPlayerEligibilityForRubber(
                        { id: m.player_id, full_name: name, gender },
                        {
                          order: deciderMatch.rubber_order,
                          label: deciderMatch.rubber_label || 'Decider',
                          category: deciderMatch.category,
                          is_decider_tiebreaker: true
                        },
                        assignments,
                        {
                          max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2,
                          max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2,
                          allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                          allow_repeat_in_decider: rulesObj.allow_repeat_in_decider ?? true,
                          allow_same_event_repeat_in_decider: rulesObj.allow_same_event_repeat_in_decider ?? false,
                          ignore_gender_rules: team.tournaments?.ignore_gender_rules
                        },
                        deciderPlayer1,
                        orderedRubbers
                      ) : { eligible: true };

                      return (
                        <option key={m.player_id} value={m.player_id}>
                          {name} ({gender === 'Female' || gender === 'F' ? '♀' : '♂'}) {!elig.eligible ? `⚠️ (${elig.reason})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {isDeciderDoubles && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Decider Partner (Player 2)
                    </label>
                    <select
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 disabled:opacity-50"
                      value={deciderPlayer2}
                      onChange={(e) => setDeciderPlayer2(e.target.value)}
                      disabled={!isCaptain || isDeciderRevealed || !!deciderLineup}
                    >
                      <option value="">Select Player 2 (Partner)</option>
                      {activeMembers.map(m => {
                        const gender = m.players?.gender || 'M';
                        const name = m.players?.display_name || m.players?.full_name || 'Player';
                        const elig = deciderMatch ? getPlayerEligibilityForRubber(
                          { id: m.player_id, full_name: name, gender },
                          {
                            order: deciderMatch.rubber_order,
                            label: deciderMatch.rubber_label || 'Decider',
                            category: deciderMatch.category,
                            is_decider_tiebreaker: true
                          },
                          assignments,
                          {
                            max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2,
                            max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2,
                            allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                            allow_repeat_in_decider: rulesObj.allow_repeat_in_decider ?? true,
                            allow_same_event_repeat_in_decider: rulesObj.allow_same_event_repeat_in_decider ?? false,
                            ignore_gender_rules: team.tournaments?.ignore_gender_rules
                          },
                          deciderPlayer2,
                          orderedRubbers
                        ) : { eligible: true };

                        return (
                          <option key={m.player_id} value={m.player_id}>
                            {name} ({gender === 'Female' || gender === 'F' ? '♀' : '♂'}) {!elig.eligible ? `⚠️ (${elig.reason})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {isCaptain && !isDeciderRevealed && !deciderLineup && (
                <div className="flex justify-end pt-1">
                  <Button
                    onClick={async () => {
                      if (!deciderPlayer1) {
                        toast.error("Please select Player 1 for the decider match.");
                        return;
                      }
                      if (isDeciderDoubles && !deciderPlayer2) {
                        toast.error("Please select Player 2 (partner) for the decider match.");
                        return;
                      }
                      if (isDeciderDoubles && deciderPlayer1 === deciderPlayer2) {
                        toast.error("Decider partner cannot be the same player.");
                        return;
                      }

                      // Check decider repeat rules
                      if (deciderMatch) {
                        const deciderRubber = {
                          order: deciderMatch.rubber_order,
                          label: deciderMatch.rubber_label || 'Decider',
                          category: deciderMatch.category,
                          is_decider_tiebreaker: true
                        };
                        const rulesConfig = {
                          max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? team.tournaments?.max_rubbers_per_player ?? 2,
                          max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? team.tournaments?.max_rubbers_per_player ?? 2,
                          allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                          allow_repeat_in_decider: rulesObj.allow_repeat_in_decider ?? true,
                          allow_same_event_repeat_in_decider: rulesObj.allow_same_event_repeat_in_decider ?? false,
                          ignore_gender_rules: team.tournaments?.ignore_gender_rules
                        };

                        const p1Member = activeMembers.find(m => m.player_id === deciderPlayer1);
                        const elig1 = getPlayerEligibilityForRubber(
                          { id: deciderPlayer1, full_name: p1Member?.players?.full_name || 'Player 1', gender: p1Member?.players?.gender },
                          deciderRubber,
                          assignments,
                          rulesConfig,
                          deciderPlayer1,
                          orderedRubbers
                        );
                        if (!elig1.eligible) {
                          toast.error(`Player 1 error: ${elig1.reason}`);
                          return;
                        }

                        if (isDeciderDoubles && deciderPlayer2) {
                          const p2Member = activeMembers.find(m => m.player_id === deciderPlayer2);
                          const elig2 = getPlayerEligibilityForRubber(
                            { id: deciderPlayer2, full_name: p2Member?.players?.full_name || 'Player 2', gender: p2Member?.players?.gender },
                            deciderRubber,
                            assignments,
                            rulesConfig,
                            deciderPlayer2,
                            orderedRubbers
                          );
                          if (!elig2.eligible) {
                            toast.error(`Player 2 error: ${elig2.reason}`);
                            return;
                          }
                        }
                      }

                      const ok = await confirm({
                        title: "Submit & Lock Decider Lineup?",
                        description: "Are you sure you want to submit and lock your lineup for the extra decider rubber?",
                        confirmLabel: "Submit & Lock Decider",
                        confirmVariant: "primary"
                      });
                      if (ok) {
                        submitDeciderLineup.mutate();
                      }
                    }}
                    disabled={submitDeciderLineup.isPending}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                  >
                    {submitDeciderLineup.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    Submit &amp; Lock Decider Lineup
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
