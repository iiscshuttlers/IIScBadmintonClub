import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Lock, Save, Loader2, ArrowUp, ArrowDown, Send, CheckCircle2, ShieldAlert } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const rawFormatConfig = team.tournaments?.tie_format_config;
  let defaultRubbers: any[] = [];
  if (Array.isArray(rawFormatConfig)) defaultRubbers = rawFormatConfig;
  else if (rawFormatConfig?.rubbers && Array.isArray(rawFormatConfig.rubbers)) defaultRubbers = rawFormatConfig.rubbers;

  // Local state for assignments and proposed order
  const [orderedRubbers, setOrderedRubbers] = useState<any[]>(defaultRubbers);
  const [assignments, setAssignments] = useState<Record<number, { player1_id: string; player2_id: string }>>({});
  const [submissionCount, setSubmissionCount] = useState<number>(0);

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

  // Re-sync orderedRubbers when format changes
  useEffect(() => {
    if (defaultRubbers.length > 0) {
      setOrderedRubbers(defaultRubbers);
    }
  }, [defaultRubbers.length]);

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

      // Save assignments via upsert loop or RPC
      const inserts = payload.map(p => ({
        tie_id: tie.id,
        side,
        rubber_order: p.rubber_order,
        player1_id: p.player1_id,
        player2_id: p.player2_id || null,
        submitted_by: (supabase as any).auth?.session?.()?.user?.id || p.player1_id
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
      toast.success('Proposed Lineup submitted! You can update it until Umpire reveals.');
      queryClient.invalidateQueries({ queryKey: ['tie_lineups', tie.id, side] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const activeMembers = members.filter(m => m.status === 'ACTIVE');

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
            Assign players and use arrows to propose the order of play. You can revise and submit multiple times before Umpire reveals.
          </p>
        </div>

        <div>
          {isAnyRevealed ? (
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> REVEALED
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

      {/* Rubber List with Order Arrows */}
      <div className="space-y-2.5">
        {orderedRubbers.map((rubber, index) => {
          const isDoubles = rubber.category.includes('D') || rubber.category.includes('Doubles');
          const assign = assignments[rubber.order] || { player1_id: '', player2_id: '' };
          const isThisRevealed = existingLineups.find((l: any) => l.rubber_order === rubber.order)?.is_revealed;

          return (
            <div 
              key={rubber.order} 
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border transition-all ${
                isThisRevealed 
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20' 
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Proposed Order Indicator & Reorder Arrows */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-black">
                  #{index + 1}
                </div>
                {isCaptain && !isThisRevealed && (
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
                  className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent disabled:opacity-50"
                  value={assign.player1_id}
                  onChange={e => updateAssignment(rubber.order, 1, e.target.value)}
                  disabled={!isCaptain || isThisRevealed}
                >
                  <option value="">Select Player 1</option>
                  {activeMembers.map(m => (
                    <option key={m.player_id} value={m.player_id}>
                      {m.players?.display_name || m.players?.full_name}
                    </option>
                  ))}
                </select>

                {isDoubles && (
                  <select 
                    className="px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-transparent disabled:opacity-50"
                    value={assign.player2_id}
                    onChange={e => updateAssignment(rubber.order, 2, e.target.value)}
                    disabled={!isCaptain || isThisRevealed}
                  >
                    <option value="">Select Player 2 (Partner)</option>
                    {activeMembers.map(m => (
                      <option key={m.player_id} value={m.player_id}>
                        {m.players?.display_name || m.players?.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {isThisRevealed && (
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  Locked
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons for Captain */}
      {isCaptain && !isAnyRevealed && (
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button 
            onClick={() => submitLineup.mutate()} 
            disabled={submitLineup.isPending}
            className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" /> 
            {submissionCount > 0 ? "Update & Re-Submit Lineup" : "Submit Proposed Lineup"}
          </Button>
        </div>
      )}
    </div>
  );
}
