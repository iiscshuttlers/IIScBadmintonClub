import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Clock, 
  ShieldAlert, 
  UserX, 
  Users, 
  Loader2,
  ChevronRight,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  tie: any;
  tournament: any;
  onClose?: () => void;
}

export function TieUmpireConsole({ tie, tournament, onClose }: Props) {
  const queryClient = useQueryClient();

  const [selectedRubberToReveal, setSelectedRubberToReveal] = useState<number | 'ALL'>('ALL');
  const [modifyingRubber, setModifyingRubber] = useState<{
    rubber: any;
    side: 'A' | 'B';
    pos: 1 | 2;
  } | null>(null);
  const [replacementPlayerId, setReplacementPlayerId] = useState<string>('');
  const [modificationReason, setModificationReason] = useState<string>('');
  const [isModifying, setIsModifying] = useState(false);

  // Fetch lineups for both sides
  const { data: lineups = [], isLoading: lineupsLoading } = useQuery({
    queryKey: ['tie_lineups_both', tie.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tie_lineups')
        .select(`
          *,
          player1:players!tie_lineups_player1_id_fkey(id, full_name, display_name),
          player2:players!tie_lineups_player2_id_fkey(id, full_name, display_name),
          revealer:players!tie_lineups_revealed_by_fkey(id, full_name)
        `)
        .eq('tie_id', tie.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tie.id
  });

  // Fetch team rosters for emergency substitutions
  const { data: teamAMembers = [] } = useQuery({
    queryKey: ['team_members_a', tie.team_a_id],
    queryFn: async () => {
      if (!tie.team_a_id) return [];
      const { data, error } = await supabase
        .from('tournament_team_members')
        .select('*, players(*)')
        .eq('team_id', tie.team_a_id)
        .eq('status', 'ACTIVE');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tie.team_a_id
  });

  const { data: teamBMembers = [] } = useQuery({
    queryKey: ['team_members_b', tie.team_b_id],
    queryFn: async () => {
      if (!tie.team_b_id) return [];
      const { data, error } = await supabase
        .from('tournament_team_members')
        .select('*, players(*)')
        .eq('team_id', tie.team_b_id)
        .eq('status', 'ACTIVE');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tie.team_b_id
  });

  // Fetch audit trail
  const { data: audits = [] } = useQuery({
    queryKey: ['tie_lineup_audits', tie.id],
    queryFn: async () => {
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
    enabled: !!tie.id
  });

  // Reveal Mutation
  const revealMutation = useMutation({
    mutationFn: async (rubberOrder: number | null) => {
      const { error } = await supabase.rpc('reveal_tie_lineup', {
        p_tie_id: tie.id,
        p_rubber_order: rubberOrder
      });
      if (error) throw error;
    },
    onSuccess: (_, rubberOrder) => {
      toast.success(rubberOrder ? `Rubber #${rubberOrder} revealed!` : "All rubbers revealed successfully!");
      queryClient.invalidateQueries({ queryKey: ['tie_lineups_both', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineup_audits', tie.id] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Emergency substitution submit
  const handleEmergencyModify = async () => {
    if (!modifyingRubber || !replacementPlayerId) {
      toast.error("Please choose a replacement player.");
      return;
    }
    if (!modificationReason.trim()) {
      toast.error("Please provide a reason for the emergency change.");
      return;
    }

    setIsModifying(true);
    try {
      const { error } = await supabase.rpc('emergency_modify_lineup', {
        p_tie_id: tie.id,
        p_side: modifyingRubber.side,
        p_rubber_order: modifyingRubber.rubber.order,
        p_pos: modifyingRubber.pos,
        p_new_player_id: replacementPlayerId,
        p_reason: modificationReason
      });

      if (error) throw error;

      toast.success("Player replaced and logged in audit trail.");
      setModifyingRubber(null);
      setReplacementPlayerId('');
      setModificationReason('');
      queryClient.invalidateQueries({ queryKey: ['tie_lineups_both', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineup_audits', tie.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsModifying(false);
    }
  };

  const rawConfig = tournament?.tie_format_config;
  let rubbers: any[] = [];
  if (Array.isArray(rawConfig)) rubbers = rawConfig;
  else if (rawConfig?.rubbers && Array.isArray(rawConfig.rubbers)) rubbers = rawConfig.rubbers;

  if (lineupsLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Umpire Roster &amp; Reveal Console — {tie.tie_code}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare proposed playing orders from {tie.team_a?.name} vs {tie.team_b?.name}. Reveal sequentially or all at once.
          </p>
        </div>

        {/* Global Reveal Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => revealMutation.mutate(null)}
            disabled={revealMutation.isPending}
            className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> Reveal All Rubbers
          </Button>
        </div>
      </div>

      {/* Side-by-Side Rubbers Comparison */}
      <div className="space-y-4">
        {rubbers.map((rubber: any) => {
          const lineupA = lineups.find((l: any) => l.side === 'A' && l.rubber_order === rubber.order);
          const lineupB = lineups.find((l: any) => l.side === 'B' && l.rubber_order === rubber.order);
          const isRevealed = lineupA?.is_revealed || lineupB?.is_revealed;
          const isDoubles = rubber.category.includes('D') || rubber.category.includes('Doubles');

          return (
            <div 
              key={rubber.order}
              className={`p-4 rounded-2xl border transition-all ${
                isRevealed 
                  ? 'bg-emerald-50/20 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Rubber Title bar */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-primary">Rubber {rubber.order}: {rubber.label}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {rubber.category}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isRevealed ? (
                    <span className="text-xs font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Revealed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => revealMutation.mutate(rubber.order)}
                      disabled={revealMutation.isPending}
                      className="rounded-lg text-xs font-bold flex items-center gap-1 h-7 px-3"
                    >
                      <Eye className="w-3.5 h-3.5" /> Reveal Rubber #{rubber.order}
                    </Button>
                  )}
                </div>
              </div>

              {/* Grid: Side A vs Side B */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Team A */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">{tie.team_a?.name || "Team A"}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Side A</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>{lineupA?.player1?.full_name || "Unassigned"}</span>
                      {lineupA?.player1 && (
                        <button
                          type="button"
                          onClick={() => setModifyingRubber({ rubber, side: 'A', pos: 1 })}
                          className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" /> Replace
                        </button>
                      )}
                    </div>
                    {isDoubles && (
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>{lineupA?.player2?.full_name || "Unassigned"}</span>
                        {lineupA?.player2 && (
                          <button
                            type="button"
                            onClick={() => setModifyingRubber({ rubber, side: 'A', pos: 2 })}
                            className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" /> Replace
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Team B */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">{tie.team_b?.name || "Team B"}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Side B</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>{lineupB?.player1?.full_name || "Unassigned"}</span>
                      {lineupB?.player1 && (
                        <button
                          type="button"
                          onClick={() => setModifyingRubber({ rubber, side: 'B', pos: 1 })}
                          className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" /> Replace
                        </button>
                      )}
                    </div>
                    {isDoubles && (
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>{lineupB?.player2?.full_name || "Unassigned"}</span>
                        {lineupB?.player2 && (
                          <button
                            type="button"
                            onClick={() => setModifyingRubber({ rubber, side: 'B', pos: 2 })}
                            className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" /> Replace
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Revealer Metadata footer */}
              {isRevealed && (lineupA?.revealer || lineupA?.revealed_at) && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Revealed by Umpire <strong className="text-slate-700 dark:text-slate-300">{lineupA?.revealer?.full_name || "Official"}</strong>
                    {lineupA?.revealed_at && ` at ${format(new Date(lineupA.revealed_at), 'hh:mm a, MMM d')}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Emergency Modification Modal */}
      {modifyingRubber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div>
              <h3 className="font-black text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" /> Emergency Substitution
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Replacing player in Rubber {modifyingRubber.rubber.order} ({modifyingRubber.side === 'A' ? tie.team_a?.name : tie.team_b?.name}). This action will be permanently recorded in the audit log.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Select Substitute Player
                </label>
                <select
                  value={replacementPlayerId}
                  onChange={(e) => setReplacementPlayerId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold"
                >
                  <option value="">Choose an active roster member</option>
                  {(modifyingRubber.side === 'A' ? teamAMembers : teamBMembers).map((m: any) => (
                    <option key={m.player_id} value={m.player_id}>
                      {m.players?.full_name || m.players?.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Reason for Emergency Replacement <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={modificationReason}
                  onChange={(e) => setModificationReason(e.target.value)}
                  placeholder="e.g. Player injured during warm-up; authorized by Tournament Referee"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-medium resize-none h-20 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModifyingRubber(null)}
                disabled={isModifying}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEmergencyModify}
                disabled={isModifying}
                className="rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isModifying ? "Submitting..." : "Confirm & Log Substitution"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Section */}
      {audits.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <History className="w-4 h-4 text-primary" />
            Lineup &amp; Reveal Audit Trail
          </h4>

          <div className="space-y-2">
            {audits.map((a: any) => (
              <div key={a.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${a.action_type === 'PLAYER_SUBSTITUTED' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <div>
                    {a.action_type === 'PLAYER_SUBSTITUTED' ? (
                      <span>
                        <strong className="text-slate-800 dark:text-slate-200">{a.orig_player?.full_name || "Player"}</strong> was replaced by <strong className="text-primary">{a.repl_player?.full_name || "Substitute"}</strong> in Rubber #{a.rubber_order}
                      </span>
                    ) : (
                      <span>Rubber #{a.rubber_order || "All"} revealed</span>
                    )}
                    {a.reason && <div className="text-[10px] text-slate-400 italic mt-0.5">Reason: {a.reason}</div>}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-right shrink-0">
                  <span>By {a.referee?.full_name || "Official"}</span>
                  <div className="font-mono">{format(new Date(a.created_at), 'hh:mm a, MMM d')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
