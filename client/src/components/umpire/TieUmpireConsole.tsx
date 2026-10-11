import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  Clock, 
  ShieldAlert, 
  Users, 
  Loader2,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Lock,
  X,
  GripVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ClickableTeamName } from '@/contexts/TeamModalContext';
import { validateLineupAssignments } from '@/lib/teamLineupRules';
import { useConfirm } from '@/contexts/ConfirmContext';


interface Props {
  tie: any;
  tournament: any;
  onClose?: () => void;
}

export function TieUmpireConsole({ tie, tournament, onClose }: Props) {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();

  const [modifyingRubber, setModifyingRubber] = useState<{
    rubber: any;
    side: 'A' | 'B';
    pos: 1 | 2;
  } | null>(null);
  const [replacementPlayerId, setReplacementPlayerId] = useState<string>('');
  const [modificationReason, setModificationReason] = useState<string>('');
  const [bothCaptainsAgreed, setBothCaptainsAgreed] = useState<boolean>(false);
  const [isModifying, setIsModifying] = useState(false);

  // Playing Order editing state
  const [isEditingPlayingOrder, setIsEditingPlayingOrder] = useState<boolean>(false);
  const [customPlayingOrders, setCustomPlayingOrders] = useState<Record<number, number>>({});

  // Drag-to-reorder state
  const [dragOrderList, setDragOrderList] = useState<number[]>([]); // rubber.order values in display sequence
  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Fetch lineups for both sides
  const { data: lineups = [], isLoading: lineupsLoading } = useQuery({
    queryKey: ['tie_lineups_both', tie.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tie_lineups')
        .select(`
          *,
          player1:players!tie_lineups_player1_id_fkey(id, full_name),
          player2:players!tie_lineups_player2_id_fkey(id, full_name),
          revealer:players!tie_lineups_revealed_by_fkey(id, full_name)
        `)
        .eq('tie_id', tie.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tie.id
  });

  // Fetch matches for this tie to see confirmed playing orders and match statuses
  const { data: tieMatches = [] } = useQuery({
    queryKey: ['tie_matches', tie.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          player1:players!tournament_matches_player1_id_fkey(id, full_name),
          player2:players!tournament_matches_player2_id_fkey(id, full_name),
          revealer:players!tournament_matches_revealed_by_fkey(id, full_name)
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

  // Reveal Mutation (supports Reveal All or Individual Rubber)
  const revealMutation = useMutation({
    mutationFn: async (rubberOrder: number | null) => {
      const teamAName = tie.team_a?.name || "Team A";
      const teamBName = tie.team_b?.name || "Team B";

      const hasAnyLineupA = lineups.some((l: any) => l.side === 'A' && l.player1_id);
      const hasAnyLineupB = lineups.some((l: any) => l.side === 'B' && l.player1_id);

      // Check if both or either team has not submitted / locked
      if (!tie.lineup_locked_a && !tie.lineup_locked_b && !hasAnyLineupA && !hasAnyLineupB) {
        throw new Error(`Cannot reveal: Neither ${teamAName} nor ${teamBName} has submitted a lineup yet.`);
      }
      if (!tie.lineup_locked_a && !tie.lineup_locked_b) {
        throw new Error(`Cannot reveal: Neither ${teamAName} nor ${teamBName} has locked their secret lineup yet.`);
      }
      if (!tie.lineup_locked_a && !hasAnyLineupA) {
        throw new Error(`Cannot reveal: ${teamAName} has not submitted a lineup yet.`);
      }
      if (!tie.lineup_locked_b && !hasAnyLineupB) {
        throw new Error(`Cannot reveal: ${teamBName} has not submitted a lineup yet.`);
      }
      if (!tie.lineup_locked_a) {
        throw new Error(`Cannot reveal: ${teamAName} is yet to submit and lock their lineup.`);
      }
      if (!tie.lineup_locked_b) {
        throw new Error(`Cannot reveal: ${teamBName} is yet to submit and lock their lineup.`);
      }

      if (!hasAnyLineupA && !hasAnyLineupB) {
        throw new Error(`Cannot reveal: No player assignments found in either team's lineup.`);
      }
      if (!hasAnyLineupA) {
        throw new Error(`Cannot reveal: No player assignments found for ${teamAName}.`);
      }
      if (!hasAnyLineupB) {
        throw new Error(`Cannot reveal: No player assignments found for ${teamBName}.`);
      }

      // Check individual rubber if specified
      if (rubberOrder !== null) {
        const rubberLineupA = lineups.find((l: any) => l.side === 'A' && l.rubber_order === rubberOrder);
        const rubberLineupB = lineups.find((l: any) => l.side === 'B' && l.rubber_order === rubberOrder);
        const hasPlayerA = Boolean(rubberLineupA?.player1_id);
        const hasPlayerB = Boolean(rubberLineupB?.player1_id);
        if (!hasPlayerA && !hasPlayerB) {
          throw new Error(`Cannot reveal Rubber #${rubberOrder}: Neither team has assigned players for this rubber.`);
        }
        if (!hasPlayerA) {
          throw new Error(`Cannot reveal Rubber #${rubberOrder}: ${teamAName} has not assigned players for this rubber.`);
        }
        if (!hasPlayerB) {
          throw new Error(`Cannot reveal Rubber #${rubberOrder}: ${teamBName} has not assigned players for this rubber.`);
        }
      }

      const { error } = await supabase.rpc('reveal_tie_lineup', {
        p_tie_id: tie.id,
        p_rubber_order: rubberOrder
      });
      if (error) throw error;
    },
    onSuccess: (_, rubberOrder) => {
      toast.success(rubberOrder ? `Rubber #${rubberOrder} revealed successfully!` : "All rubbers revealed successfully!");
      queryClient.invalidateQueries({ queryKey: ['tie_lineups_both', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_matches', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineup_audits', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Client-side validated reveal handler with clear user feedback
  const handleReveal = (rubberOrder: number | null) => {
    const teamAName = tie.team_a?.name || "Team A";
    const teamBName = tie.team_b?.name || "Team B";

    const hasAnyLineupA = lineups.some((l: any) => l.side === 'A' && l.player1_id);
    const hasAnyLineupB = lineups.some((l: any) => l.side === 'B' && l.player1_id);

    if (!tie.lineup_locked_a && !tie.lineup_locked_b && !hasAnyLineupA && !hasAnyLineupB) {
      toast.error(`Cannot reveal: Neither ${teamAName} nor ${teamBName} has submitted a lineup yet.`);
      return;
    }
    if (!tie.lineup_locked_a && !tie.lineup_locked_b) {
      toast.error(`Cannot reveal: Neither ${teamAName} nor ${teamBName} has locked their secret lineup yet.`);
      return;
    }
    if (!tie.lineup_locked_a && !hasAnyLineupA) {
      toast.error(`Cannot reveal: ${teamAName} has not submitted a lineup yet.`);
      return;
    }
    if (!tie.lineup_locked_b && !hasAnyLineupB) {
      toast.error(`Cannot reveal: ${teamBName} has not submitted a lineup yet.`);
      return;
    }
    if (!tie.lineup_locked_a) {
      toast.error(`Cannot reveal: ${teamAName} is yet to submit and lock their lineup.`);
      return;
    }
    if (!tie.lineup_locked_b) {
      toast.error(`Cannot reveal: ${teamBName} is yet to submit and lock their lineup.`);
      return;
    }

    if (!hasAnyLineupA && !hasAnyLineupB) {
      toast.error(`Cannot reveal: No player assignments found in either team's lineup.`);
      return;
    }
    if (!hasAnyLineupA) {
      toast.error(`Cannot reveal: No player assignments found for ${teamAName}.`);
      return;
    }
    if (!hasAnyLineupB) {
      toast.error(`Cannot reveal: No player assignments found for ${teamBName}.`);
      return;
    }

    if (rubberOrder !== null) {
      const rubberLineupA = lineups.find((l: any) => l.side === 'A' && l.rubber_order === rubberOrder);
      const rubberLineupB = lineups.find((l: any) => l.side === 'B' && l.rubber_order === rubberOrder);
      const hasPlayerA = Boolean(rubberLineupA?.player1_id);
      const hasPlayerB = Boolean(rubberLineupB?.player1_id);
      if (!hasPlayerA && !hasPlayerB) {
        toast.error(`Cannot reveal Rubber #${rubberOrder}: Neither team has assigned players for this rubber.`);
        return;
      }
      if (!hasPlayerA) {
        toast.error(`Cannot reveal Rubber #${rubberOrder}: ${teamAName} has not assigned players for this rubber.`);
        return;
      }
      if (!hasPlayerB) {
        toast.error(`Cannot reveal Rubber #${rubberOrder}: ${teamBName} has not assigned players for this rubber.`);
        return;
      }
    }

    if (totalRuleViolations > 0) {
      confirm({
        title: "Rule Violations Detected in Lineups",
        description: `There are ${totalRuleViolations} active rule violation(s) across team lineups (e.g. repetition cap, same-discipline or gender mismatch). Are you sure you want to override and reveal ${rubberOrder !== null ? `Rubber #${rubberOrder}` : 'all rubbers'}?`,
        confirmLabel: "Override & Reveal",
        confirmVariant: "danger"
      }).then((confirmed) => {
        if (confirmed) {
          revealMutation.mutate(rubberOrder);
        }
      });
      return;
    }

    revealMutation.mutate(rubberOrder);
  };

  // Set Playing Order Mutation
  const setPlayingOrderMutation = useMutation({
    mutationFn: async (orders: { rubber_order: number; playing_order: number }[]) => {
      const { error } = await supabase.rpc('set_tie_playing_order', {
        p_tie_id: tie.id,
        p_playing_orders: orders,
        p_reason: 'Playing order arbitrated and confirmed by match official'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Official playing order confirmed and updated!");
      setIsEditingPlayingOrder(false);
      queryClient.invalidateQueries({ queryKey: ['tie_matches', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineup_audits', tie.id] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  // Emergency substitution submit (Enforces dual-captain agreement)
  const handleEmergencyModify = async () => {
    if (!modifyingRubber || !replacementPlayerId) {
      toast.error("Please choose a replacement player from the roster.");
      return;
    }
    if (!modificationReason.trim()) {
      toast.error("A valid reason is required for emergency player replacement.");
      return;
    }
    if (!bothCaptainsAgreed) {
      toast.error("Both team captains must formally agree before an emergency replacement can be authorized.");
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
        p_reason: modificationReason,
        p_both_captains_agreed: true
      });

      if (error) throw error;

      toast.success("Player replaced and logged with dual-captain consent in audit trail.");
      setModifyingRubber(null);
      setReplacementPlayerId('');
      setModificationReason('');
      setBothCaptainsAgreed(false);
      queryClient.invalidateQueries({ queryKey: ['tie_lineups_both', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_matches', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineup_audits', tie.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsModifying(false);
    }
  };

  const rawConfig = tournament?.tie_format_config;
  let baseRubbers: any[] = [];
  if (Array.isArray(rawConfig)) baseRubbers = rawConfig;
  else if (rawConfig?.rubbers && Array.isArray(rawConfig.rubbers)) baseRubbers = rawConfig.rubbers;

  // Combine format rubbers and tieMatches rubbers (including dynamic tiebreaker deciders)
  const rubbers = [...baseRubbers];
  tieMatches.forEach((m: any) => {
    if (!rubbers.some((r: any) => r.order === m.rubber_order)) {
      rubbers.push({
        order: m.rubber_order,
        label: m.rubber_label || `Rubber ${m.rubber_order}`,
        category: m.category,
        best_of_sets: m.best_of_sets,
        points_to_win: m.points_to_win,
        is_decider_tiebreaker: m.is_decider_tiebreaker
      });
    }
  });

  // Decider Modal State
  const [showAddDeciderModal, setShowAddDeciderModal] = useState(false);
  const [newDeciderCategory, setNewDeciderCategory] = useState<string>('XD');
  const [newDeciderLabel, setNewDeciderLabel] = useState<string>('XD 2 (Decider)');
  const [newDeciderSets, setNewDeciderSets] = useState<number>(1);
  const [newDeciderPoints, setNewDeciderPoints] = useState<number>(21);

  const addDeciderMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('add_decider_rubber_to_tie', {
        p_tie_id: tie.id,
        p_category: newDeciderCategory,
        p_label: newDeciderLabel,
        p_best_of_sets: newDeciderSets,
        p_points_to_win: newDeciderPoints
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Added ${data.label} to the tie! Captains can now submit their decider lineup.`);
      setShowAddDeciderModal(false);
      queryClient.invalidateQueries({ queryKey: ['tie_matches', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineups_both', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(`Failed to add decider: ${err.message}`)
  });

  const revealDeciderMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('reveal_decider_rubber', {
        p_tie_id: tie.id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Decider rubber revealed! Match is now active.");
      queryClient.invalidateQueries({ queryKey: ['tie_matches', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tie_lineups_both', tie.id] });
      queryClient.invalidateQueries({ queryKey: ['tournament_ties'] });
    },
    onError: (err: any) => toast.error(`Failed to reveal decider: ${err.message}`)
  });

  // Sync customPlayingOrders and dragOrderList on first load
  useEffect(() => {
    if (rubbers.length > 0) {
      const initial: Record<number, number> = {};
      rubbers.forEach((r: any) => {
        const match = tieMatches.find((m: any) => m.rubber_order === r.order);
        const lineupA = lineups.find((l: any) => l.side === 'A' && l.rubber_order === r.order);
        const lineupB = lineups.find((l: any) => l.side === 'B' && l.rubber_order === r.order);
        initial[r.order] = match?.playing_order || lineupA?.proposed_playing_order || lineupB?.proposed_playing_order || r.order;
      });
      setCustomPlayingOrders(initial);
      // Build initial drag list sorted by current playing order
      const sorted = [...rubbers].sort((a: any, b: any) => (initial[a.order] ?? a.order) - (initial[b.order] ?? b.order));
      setDragOrderList(sorted.map((r: any) => r.order));
    }
  }, [rubbers.length, tieMatches.length, lineups.length]);

  // Drag handlers for playing order editor
  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const src = dragSrcIdx.current;
    if (src === null || src === idx) {
      setDragOverIdx(null);
      return;
    }
    const newList = [...dragOrderList];
    const [moved] = newList.splice(src, 1);
    newList.splice(idx, 0, moved);
    setDragOrderList(newList);
    // Recompute customPlayingOrders based on new positions
    const newOrders: Record<number, number> = {};
    newList.forEach((rubberOrder, position) => {
      newOrders[rubberOrder] = position + 1;
    });
    setCustomPlayingOrders(newOrders);
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  if (lineupsLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  // Playing Order Discrepancy Analysis
  let hasOrderDiscrepancy = false;
  let isBothCaptainsLocked = tie.lineup_locked_a && tie.lineup_locked_b;
  const rubberComparison = rubbers.map((rubber: any) => {
    const lineupA = lineups.find((l: any) => l.side === 'A' && l.rubber_order === rubber.order);
    const lineupB = lineups.find((l: any) => l.side === 'B' && l.rubber_order === rubber.order);
    const match = tieMatches.find((m: any) => m.rubber_order === rubber.order);

    const orderA = lineupA?.proposed_playing_order ?? rubber.order;
    const orderB = lineupB?.proposed_playing_order ?? rubber.order;
    const matchOrder = match?.playing_order ?? customPlayingOrders[rubber.order] ?? orderA;
    const isDiscrepant = orderA !== orderB;
    if (isDiscrepant) hasOrderDiscrepancy = true;

    return {
      rubber,
      lineupA,
      lineupB,
      match,
      orderA,
      orderB,
      matchOrder,
      isDiscrepant,
      isRevealed: lineupA?.is_revealed || lineupB?.is_revealed || !!match?.revealed_at
    };
  });

  // Real-time Lineup Rule Checks for both sides
  const rulesObj = typeof rawConfig === 'object' && !Array.isArray(rawConfig) ? rawConfig : {};
  const rulesConfig = {
    max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? tournament?.max_rubbers_per_player ?? 2,
    max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? tournament?.max_rubbers_per_player ?? 2,
    max_rubbers_per_player: tournament?.max_rubbers_per_player ?? 2,
    allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
    allow_repeat_in_decider: rulesObj.allow_repeat_in_decider ?? true,
    allow_same_event_repeat_in_decider: rulesObj.allow_same_event_repeat_in_decider ?? false,
    ignore_gender_rules: tournament?.ignore_gender_rules
  };

  const assignmentsA: Record<number, { player1_id: string; player2_id?: string }> = {};
  const assignmentsB: Record<number, { player1_id: string; player2_id?: string }> = {};
  lineups.forEach((l: any) => {
    if (l.side === 'A') {
      assignmentsA[l.rubber_order] = { player1_id: l.player1_id, player2_id: l.player2_id };
    } else if (l.side === 'B') {
      assignmentsB[l.rubber_order] = { player1_id: l.player1_id, player2_id: l.player2_id };
    }
  });

  const deciderMatch = tieMatches.find((m: any) => m.is_decider_tiebreaker);
  const deciderMatchParam = deciderMatch ? { rubber_order: deciderMatch.rubber_order, category: deciderMatch.category } : undefined;

  const validationA = validateLineupAssignments(assignmentsA, rubbers, teamAMembers as any, rulesConfig, deciderMatchParam);
  const validationB = validateLineupAssignments(assignmentsB, rubbers, teamBMembers as any, rulesConfig, deciderMatchParam);
  const totalRuleViolations = validationA.errors.length + validationB.errors.length;

  // Sort rubbers for display by their current match playing order
  const sortedRubbers = [...rubberComparison].sort((a, b) => a.matchOrder - b.matchOrder);


  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
              {tie.stage || 'FIXTURE'} · {tie.tie_code}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              tie.state === 'IN_PROGRESS' 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : isBothCaptainsLocked
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {isBothCaptainsLocked && tie.state !== 'IN_PROGRESS' ? 'Awaiting Official Reveal' : tie.state}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1 flex items-center gap-2 flex-wrap">
            <ClickableTeamName 
              team={{ id: tie.team_a_id, name: tie.team_a?.name || "Team A", short_name: tie.team_a?.short_name, tournament_id: tournament?.id }} 
              className="text-xl font-black"
            />
            <span className="text-slate-400 font-normal text-sm">vs</span>
            <ClickableTeamName 
              team={{ id: tie.team_b_id, name: tie.team_b?.name || "Team B", short_name: tie.team_b?.short_name, tournament_id: tournament?.id }} 
              className="text-xl font-black"
            />
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Review secret lineups, compare proposed playing orders, arbitrate differences, and reveal rubbers.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setShowAddDeciderModal(true)}
            variant="outline"
            size="sm"
            className="rounded-xl font-bold text-xs flex items-center gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            + Add Tiebreaker Decider (XD2/MS2)
          </Button>

          <Button
            onClick={() => setIsEditingPlayingOrder(prev => !prev)}
            variant="outline"
            size="sm"
            className="rounded-xl font-bold text-xs flex items-center gap-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {isEditingPlayingOrder ? "Close Order Editor" : "Arbitrate Playing Order"}
          </Button>

          <Button
            onClick={() => handleReveal(null)}
            disabled={revealMutation.isPending}
            className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs flex items-center gap-1.5"
          >
            <Eye className="w-4 h-4" /> Reveal All Rubbers
          </Button>
        </div>
      </div>

      {/* Official Lineup Submission Status Banner */}
      {(!tie.lineup_locked_a || !tie.lineup_locked_b) ? (
        <div className="p-4 rounded-2xl border bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 text-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-sm">
                {!tie.lineup_locked_a && !tie.lineup_locked_b
                  ? "Lineup Submission Pending: Both Teams Are Yet to Submit Their Lineup"
                  : !tie.lineup_locked_a
                    ? `Lineup Submission Pending: ${tie.team_a?.name || "Team A"} Is Yet to Submit Their Lineup`
                    : `Lineup Submission Pending: ${tie.team_b?.name || "Team B"} Is Yet to Submit Their Lineup`
                }
              </h4>
              <p className="text-xs opacity-85 mt-1">
                {!tie.lineup_locked_a && !tie.lineup_locked_b
                  ? `Neither ${tie.team_a?.name || "Team A"} nor ${tie.team_b?.name || "Team B"} has locked their secret lineup yet. Match official can preview draft entries below, but both captains must lock before official court play.`
                  : !tie.lineup_locked_a
                    ? `${tie.team_b?.name || "Team B"} has locked their secret lineup. Waiting for ${tie.team_a?.name || "Team A"} captain to lock.`
                    : `${tie.team_a?.name || "Team A"} has locked their secret lineup. Waiting for ${tie.team_b?.name || "Team B"} captain to lock.`
                }
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-black text-sm">Both Teams Have Locked Their Lineups</h4>
              <p className="text-xs opacity-80 mt-0.5">Secret rosters are locked by both captains. Ready for official arbitration and reveal.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleReveal(null)}
            disabled={revealMutation.isPending}
            className="rounded-xl font-black text-xs bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> Reveal All Rubbers
          </Button>
        </div>
      )}

      {/* Rule Violations Warning Banner for Official */}
      {totalRuleViolations > 0 && (
        <div className="p-4 rounded-2xl border bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60 text-rose-950 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h4 className="font-black text-sm">
                Lineup Rule Violations Detected ({totalRuleViolations})
              </h4>
              <p className="text-xs opacity-90">
                Captain submissions conflict with tournament repetition or category rules. As an official, you may require the captain to revise or use Emergency Replace before revealing.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                {validationA.errors.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-rose-200 dark:border-rose-900/40">
                    <span className="font-black text-rose-700 dark:text-rose-300 block mb-1">
                      {tie.team_a?.name || "Team A"}:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 opacity-90">
                      {validationA.errors.map((e, idx) => (
                        <li key={idx}>{e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {validationB.errors.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-rose-200 dark:border-rose-900/40">
                    <span className="font-black text-rose-700 dark:text-rose-300 block mb-1">
                      {tie.team_b?.name || "Team B"}:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 opacity-90">
                      {validationB.errors.map((e, idx) => (
                        <li key={idx}>{e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playing Order Comparison Banner */}

      <div className={`p-4 rounded-2xl border transition-all ${
        hasOrderDiscrepancy
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            {hasOrderDiscrepancy ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="font-black text-sm">
                {hasOrderDiscrepancy ? "Playing Order Difference Detected Between Teams" : "Playing Order Agreed by Both Teams"}
              </h4>
              <p className="text-xs opacity-80 mt-0.5">
                {hasOrderDiscrepancy
                  ? `${tie.team_a?.name || "Team A"} and ${tie.team_b?.name || "Team B"} proposed differing rubber orders. The referee/umpire has authority to finalize the sequence.`
                  : `Both captains proposed matching sequences for all rubbers. Match official may confirm or adjust.`
                }
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={hasOrderDiscrepancy ? "default" : "outline"}
            onClick={() => setIsEditingPlayingOrder(true)}
            className="rounded-xl font-bold text-xs shrink-0"
          >
            {hasOrderDiscrepancy ? "Resolve & Set Order" : "Modify Order"}
          </Button>
        </div>
      </div>

      {/* Playing Order Arbitration Editor (when toggled) */}
      {isEditingPlayingOrder && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4 text-primary" /> Arbitrate Official Playing Order
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                <GripVertical className="w-3.5 h-3.5 inline-block mr-1 text-slate-400" />
                Drag the rows to reorder the match sequence. The numbers update automatically.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditingPlayingOrder(false)}
                className="rounded-xl font-bold text-xs"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const payload = Object.entries(customPlayingOrders).map(([rOrder, pOrder]) => ({
                    rubber_order: parseInt(rOrder, 10),
                    playing_order: pOrder
                  }));
                  setPlayingOrderMutation.mutate(payload);
                }}
                disabled={setPlayingOrderMutation.isPending}
                className="rounded-xl font-bold text-xs bg-primary text-primary-foreground flex items-center gap-1"
              >
                {setPlayingOrderMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Official Sequence
              </Button>
            </div>
          </div>

          {/* Drag-to-reorder list */}
          <div className="flex flex-col gap-2">
            {dragOrderList.map((rubberOrder, idx) => {
              const rubber = rubbers.find((r: any) => r.order === rubberOrder);
              if (!rubber) return null;
              const item = rubberComparison.find((c: any) => c.rubber.order === rubberOrder);
              const playingPos = idx + 1;
              const isDraggingOver = dragOverIdx === idx;

              return (
                <div
                  key={rubberOrder}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
                    isDraggingOver
                      ? 'border-primary/60 ring-2 ring-primary/20 shadow-md bg-primary/5'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag handle */}
                    <div className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors shrink-0">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Position badge */}
                    <span className="font-black text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full min-w-[2.5rem] text-center">
                      #{playingPos}
                    </span>

                    <span className="font-black text-xs text-slate-800 dark:text-slate-200">{rubber.label}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{rubber.category}</span>

                    {/* Proposed order comparison */}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs ml-1">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono font-bold">
                        {tie.team_a?.short_name || 'A'}: #{item?.orderA}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-mono font-bold">
                        {tie.team_b?.short_name || 'B'}: #{item?.orderB}
                      </span>
                      {item?.isDiscrepant && (
                        <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                          Differs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Official order indicator (read-only, driven by position) */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <span className="text-[10px] font-bold text-slate-400">Official Match:</span>
                    <span className="px-2.5 py-1 text-xs font-mono font-black border border-primary/30 rounded-lg bg-primary/5 text-primary">
                      #{playingPos}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Drag rows up or down to reorder · Click <strong>Save Official Sequence</strong> to confirm
          </p>
        </div>
      )}

      {/* Side-by-Side Rubbers Comparison & Granular Reveal */}
      <div className="space-y-4">
        {sortedRubbers.map((item) => {
          const { rubber, lineupA, lineupB, match, isRevealed, matchOrder } = item;
          const isDoubles = rubber.category.includes('D') || rubber.category.includes('Doubles');
          const revealerName = lineupA?.revealer?.full_name || match?.revealer?.full_name;
          const revealTimestamp = lineupA?.revealed_at || match?.revealed_at;

          return (
            <div 
              key={rubber.order}
              className={`p-4 rounded-2xl border transition-all ${
                isRevealed 
                  ? 'bg-emerald-50/20 border-emerald-300 dark:border-emerald-800/70' 
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Rubber Title bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 font-mono font-black text-xs">
                    Match #{matchOrder}
                  </span>
                  <span className="font-black text-sm text-primary">{rubber.label}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {rubber.category}
                  </span>

                  {(rubber.is_decider_tiebreaker || (match as any)?.is_decider_tiebreaker) && (
                    <span className="text-[10px] uppercase font-black text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                      Golden Decider
                    </span>
                  )}

                  {/* Proposed order summary */}
                  <span className="text-[11px] text-slate-400 font-mono ml-2 hidden sm:inline">
                    (Proposed: {tie.team_a?.short_name || 'A'} #{item.orderA} / {tie.team_b?.short_name || 'B'} #{item.orderB})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isRevealed ? (
                    <span className="text-xs font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Revealed
                    </span>
                  ) : (rubber.is_decider_tiebreaker || (match as any)?.is_decider_tiebreaker) ? (
                    (lineupA && lineupB) ? (
                      <Button
                        size="sm"
                        onClick={() => revealDeciderMutation.mutate()}
                        disabled={revealDeciderMutation.isPending}
                        className="rounded-lg text-xs font-black flex items-center gap-1 h-7 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Reveal Decider Rubber
                      </Button>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                        Awaiting Captains Lineup
                      </span>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReveal(rubber.order)}
                      disabled={revealMutation.isPending}
                      className="rounded-lg text-xs font-bold flex items-center gap-1 h-7 px-3 bg-white dark:bg-slate-900 hover:bg-primary hover:text-white transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Reveal Rubber #{rubber.order}
                    </Button>
                  )}
                </div>
              </div>

              {/* Grid: Side A vs Side B (Officials can see both sides!) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Team A */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">{tie.team_a?.name || "Team A"}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Side A (Proposed #{item.orderA})</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>{lineupA?.player1?.full_name || "Unassigned"}</span>
                      {lineupA?.player1 && (
                        <button
                          type="button"
                          onClick={() => setModifyingRubber({ rubber, side: 'A', pos: 1 })}
                          className="text-[10px] text-rose-500 hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" /> Emergency Replace
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
                            className="text-[10px] text-rose-500 hover:underline font-bold flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" /> Emergency Replace
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
                    <span className="text-[10px] text-slate-400 font-mono">Side B (Proposed #{item.orderB})</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span>{lineupB?.player1?.full_name || "Unassigned"}</span>
                      {lineupB?.player1 && (
                        <button
                          type="button"
                          onClick={() => setModifyingRubber({ rubber, side: 'B', pos: 1 })}
                          className="text-[10px] text-rose-500 hover:underline font-bold flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" /> Emergency Replace
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
                            className="text-[10px] text-rose-500 hover:underline font-bold flex items-center gap-0.5"
                          >
                            <Edit3 className="w-3 h-3" /> Emergency Replace
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Revealer Metadata footer */}
              {isRevealed && (revealerName || revealTimestamp) && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Revealed by Official <strong className="text-slate-700 dark:text-slate-300">{revealerName || "Referee / Umpire"}</strong>
                    {revealTimestamp && ` at ${format(new Date(revealTimestamp), 'hh:mm a, MMM d')}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Emergency Modification Modal with Dual-Captain Agreement */}
      {modifyingRubber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div>
              <h3 className="font-black text-base flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5" /> Emergency Player Substitution
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Replacing player in {modifyingRubber.rubber.label} ({modifyingRubber.side === 'A' ? tie.team_a?.name : tie.team_b?.name}). Permitted only in extreme conditions (acute injury/illness) with mandatory consent from both captains.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Select Substitute Player (Active Roster)
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
                  placeholder="e.g. Player sustained ankle sprain during warm-up; both team captains notified and agreed."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-medium resize-none h-20 outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Dual Captain Agreement Verification Checkbox */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <input
                  type="checkbox"
                  id="bothCaptainsAgreed"
                  checked={bothCaptainsAgreed}
                  onChange={(e) => setBothCaptainsAgreed(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="bothCaptainsAgreed" className="text-xs text-amber-900 dark:text-amber-200 font-bold leading-snug cursor-pointer">
                  Both Captains Agreed: I confirm that both Captain of {tie.team_a?.name || "Team A"} and Captain of {tie.team_b?.name || "Team B"} have formally agreed to this emergency substitution.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setModifyingRubber(null);
                  setBothCaptainsAgreed(false);
                }}
                disabled={isModifying}
                className="rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleEmergencyModify}
                disabled={isModifying || !bothCaptainsAgreed || !replacementPlayerId || !modificationReason.trim()}
                className="rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
              >
                {isModifying ? "Submitting..." : "Authorize & Log Substitution"}
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
            Lineup, Reveal &amp; Substitution Audit Trail
          </h4>

          <div className="space-y-2">
            {audits.map((a: any) => (
              <div key={a.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    a.action_type === 'PLAYER_SUBSTITUTED' 
                      ? 'bg-rose-500' 
                      : a.action_type === 'ORDER_CHANGED'
                        ? 'bg-blue-500'
                        : 'bg-emerald-500'
                  }`} />
                  <div>
                    {a.action_type === 'PLAYER_SUBSTITUTED' ? (
                      <div>
                        <span>
                          <strong className="text-slate-800 dark:text-slate-200">{a.orig_player?.full_name || "Player"}</strong> was replaced by <strong className="text-primary">{a.repl_player?.full_name || "Substitute"}</strong> in Rubber #{a.rubber_order}
                        </span>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                          ✓ Both captains agreed · Authorized by {a.referee?.full_name || "Official"}
                        </div>
                      </div>
                    ) : a.action_type === 'ORDER_CHANGED' ? (
                      <div>
                        <span>Playing order arbitrated and updated</span>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                          Authorized by {a.referee?.full_name || "Official"}
                        </div>
                      </div>
                    ) : (
                      <span>Rubber #{a.rubber_order || "All"} revealed by {a.referee?.full_name || "Official"}</span>
                    )}
                    {a.reason && <div className="text-[10px] text-slate-400 italic mt-0.5">Reason: {a.reason}</div>}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-right shrink-0">
                  <div className="font-mono">{format(new Date(a.created_at), 'hh:mm a, MMM d')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Decider Modal */}
      {showAddDeciderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                Add Tiebreaker Decider Rubber
              </h3>
              <button onClick={() => setShowAddDeciderModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Introduce a sudden death decider rubber (e.g. XD2 or MS2) to break a tie. Both captains will submit their lineups for this rubber.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Category</label>
                <select
                  value={newDeciderCategory}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setNewDeciderCategory(cat);
                    setNewDeciderLabel(`${cat} 2 (Decider)`);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="XD">XD (Mixed Doubles)</option>
                  <option value="MS">MS (Men's Singles)</option>
                  <option value="WS">WS (Women's Singles)</option>
                  <option value="MD">MD (Men's Doubles)</option>
                  <option value="WD">WD (Women's Doubles)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Rubber Label</label>
                <input
                  type="text"
                  value={newDeciderLabel}
                  onChange={(e) => setNewDeciderLabel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  placeholder="e.g. XD 2 (Decider)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Sets</label>
                  <select
                    value={newDeciderSets}
                    onChange={(e) => setNewDeciderSets(parseInt(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value={1}>1 Set (Sudden Death)</option>
                    <option value={3}>Best of 3 Sets</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">Points to Win</label>
                  <select
                    value={newDeciderPoints}
                    onChange={(e) => setNewDeciderPoints(parseInt(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value={11}>11 Points (Sprint)</option>
                    <option value={15}>15 Points</option>
                    <option value={21}>21 Points (Standard)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setShowAddDeciderModal(false)} className="rounded-xl font-bold text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => addDeciderMutation.mutate()}
                disabled={addDeciderMutation.isPending}
                className="rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5"
              >
                {addDeciderMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                Add Decider Rubber
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
