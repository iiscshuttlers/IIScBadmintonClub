import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Swords, Trash2, Calendar, Edit3, CheckCircle2, AlertCircle, Loader2, Layers, Filter, Eye, X, Settings2, Radio, Clock, ShieldCheck, GitFork, LayoutList, CalendarClock, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/contexts/ConfirmContext';
import { useTeamModal } from '@/contexts/TeamModalContext';
import { TeamBracketGeneratorModal } from './TeamBracketGeneratorModal';
import { TeamSettingsEditModal } from './TeamSettingsEditModal';
import { TieUmpireConsole } from '@/components/umpire/TieUmpireConsole';
import { TieVisualLineupModal } from '@/components/events/TieVisualLineupModal';
import { BracketVisual, type BracketMatch } from '@/components/tournament/BracketVisual';
import ErrorBoundary from '@/components/ErrorBoundary';

export function TeamBracketTab({ tournament, isMasterAdmin }: { tournament: any; isMasterAdmin: boolean }) {
  const { confirm } = useConfirm();
  const { openTeamModal } = useTeamModal();
  const [teams, setTeams] = useState<any[]>([]);
  const [ties, setTies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSettingsModalOpen, setEditSettingsModalOpen] = useState(false);
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<any | null>(null);
  const [selectedTieForVisual, setSelectedTieForVisual] = useState<any | null>(null);
  const [stageFilter, setStageFilter] = useState<'ALL' | 'POOL' | 'KNOCKOUT'>('ALL');
  const [poolFilter, setPoolFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'visual'>('list');

  // Tie Scheduling state
  const [editingScheduleTie, setEditingScheduleTie] = useState<{ tieId: string; court: string; at: string } | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tData }, { data: tieData }] = await Promise.all([
      supabase.from("tournament_teams").select("*").eq("tournament_id", tournament.id).eq("status", "ACTIVE").order("seed"),
      supabase.from("tournament_ties").select(`
        *,
        team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
        team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url)
      `).eq("tournament_id", tournament.id).order("round_number").order("tie_code")
    ]);
    setTeams(tData ?? []);
    setTies(tieData ?? []);
    setLoading(false);
  }, [tournament.id]);

  useEffect(() => { load(); }, [load]);

  const saveTieSchedule = async () => {
    if (!editingScheduleTie) return;
    setSavingSchedule(true);
    let isoAt: string | null = null;
    if (editingScheduleTie.at) {
      const d = new Date(editingScheduleTie.at);
      if (!isNaN(d.getTime())) isoAt = d.toISOString();
    }

    // 1. Update tie scheduled_at
    const { error: tieErr } = await supabase
      .from('tournament_ties')
      .update({ scheduled_at: isoAt })
      .eq('id', editingScheduleTie.tieId);

    // 2. Also update all rubbers under this tie if court or time was provided
    if (editingScheduleTie.court || isoAt) {
      const rubberUpdates: Record<string, any> = {};
      if (editingScheduleTie.court) rubberUpdates.court_number = editingScheduleTie.court;
      if (isoAt) rubberUpdates.scheduled_at = isoAt;

      await supabase
        .from('tournament_matches')
        .update(rubberUpdates)
        .eq('tie_id', editingScheduleTie.tieId);
    }

    setSavingSchedule(false);
    if (tieErr) {
      toast.error(tieErr.message);
    } else {
      toast.success("Tie schedule saved!");
      setEditingScheduleTie(null);
      await load();
    }
  };

  const handleGenerate = async ({
    format,
    ties: generatedTies,
    poolAssignments,
    tieDeciderConfig
  }: {
    format: 'DIRECT_KNOCKOUT' | 'POOLS_AND_PLAYOFFS' | 'PURE_LEAGUE';
    ties: any[];
    poolAssignments: Record<string, string>;
    tieDeciderConfig: any;
  }) => {
    if (ties.length > 0) {
      const ok = await confirm({
        title: "Regenerate Bracket?",
        description: "This will delete all existing ties and regenerate the tournament schedule. Continue?",
        confirmLabel: "Regenerate",
        confirmVariant: "danger"
      });
      if (!ok) return;
      await supabase.from("tournament_ties").delete().eq("tournament_id", tournament.id);
    }

    // 1. Update pool assignments on tournament_teams
    if (Object.keys(poolAssignments).length > 0) {
      for (const [teamId, pool] of Object.entries(poolAssignments)) {
        await supabase.from("tournament_teams").update({ pool }).eq("id", teamId);
      }
    }

    // 2. Update tournament tie format config and points
    const currentConfig = tournament.tie_format_config || {};
    const updatedConfig = {
      ...(typeof currentConfig === 'object' && !Array.isArray(currentConfig) ? currentConfig : { rubbers: currentConfig }),
      ...tieDeciderConfig
    };

    await supabase.from("tournaments").update({
      tie_format_config: updatedConfig,
      tie_points_win: tieDeciderConfig.tie_points_win ?? 2,
      tie_points_draw: tieDeciderConfig.tie_points_draw ?? 1
    }).eq("id", tournament.id);

    // 3. Insert generated ties
    const tieInserts = generatedTies.map(t => ({
      tournament_id: tournament.id,
      tie_code: t.tie_code,
      stage: t.stage,
      round_name: t.round_name,
      round_number: t.round_number,
      team_a_id: t.team_a_id,
      team_b_id: t.team_b_id,
      state: 'SCHEDULED',
      advances_to_slot: t.advances_to_slot || null,
      loser_advances_to_slot: t.loser_advances_to_slot || null,
      _temp_advances_to: t.advances_to_tie_code || null,
      _temp_loser_advances_to: t.loser_advances_to_tie_code || null
    }));

    const { data: insertedTies, error } = await supabase.from("tournament_ties").insert(
      tieInserts.map(({ _temp_advances_to, _temp_loser_advances_to, ...rest }) => rest)
    ).select();

    if (error) {
      toast.error(`Error creating ties: ${error.message}`);
      return;
    }

    // 4. Link advances_to_tie & loser_advances_to_tie
    if (insertedTies) {
      const codeToId = new Map(insertedTies.map((t: any) => [t.tie_code, t.id]));
      
      for (const tie of tieInserts) {
        const currentId = codeToId.get(tie.tie_code);
        if (!currentId) continue;

        const updatePayload: any = {};
        if (tie._temp_advances_to) {
          const nextId = codeToId.get(tie._temp_advances_to);
          if (nextId) updatePayload.advances_to_tie = nextId;
        }
        if (tie._temp_loser_advances_to) {
          const loserId = codeToId.get(tie._temp_loser_advances_to);
          if (loserId) updatePayload.loser_advances_to_tie = loserId;
        }

        if (Object.keys(updatePayload).length > 0) {
          await supabase.from("tournament_ties").update(updatePayload).eq("id", currentId);
        }
      }

      // 5. Generate empty rubbers for each tie
      const matchInserts: any[] = [];
      const teamMap = new Map(teams.map(t => [t.id, t]));
      
      let rubbers = [];
      if (Array.isArray(updatedConfig.rubbers)) rubbers = updatedConfig.rubbers;
      else if (Array.isArray(updatedConfig)) rubbers = updatedConfig;

      for (const tie of insertedTies) {
        const teamA = teamMap.get(tie.team_a_id);
        const teamB = teamMap.get(tie.team_b_id);

        for (const rubber of rubbers) {
          matchInserts.push({
            tournament_id: tournament.id,
            category: rubber.category,
            match_code: `${tie.tie_code}-${rubber.label}`,
            match_number: rubber.order,
            round_name: tie.round_name || tie.tie_code,
            team1_label: teamA?.short_name || 'TBD',
            team2_label: teamB?.short_name || 'TBD',
            status: 'scheduled',
            tie_id: tie.id,
            rubber_order: rubber.order,
            rubber_label: rubber.label,
            best_of_sets: rubber.best_of_sets ?? 3,
            points_to_win: rubber.points_to_win ?? 21,
            locked: false
          });
        }

        if (tieDeciderConfig?.extra_decider_rubber?.enabled) {
          const extra = tieDeciderConfig.extra_decider_rubber;
          const maxOrder = rubbers.reduce((max: number, r: any) => Math.max(max, r.order || 0), 0) + 1;
          matchInserts.push({
            tournament_id: tournament.id,
            category: extra.category || 'XD',
            match_code: `${tie.tie_code}-${extra.label || 'DECIDER'}`,
            match_number: maxOrder,
            round_name: `${tie.round_name || tie.tie_code} (Decider)`,
            team1_label: teamA?.short_name || 'TBD',
            team2_label: teamB?.short_name || 'TBD',
            status: 'scheduled',
            tie_id: tie.id,
            rubber_order: maxOrder,
            rubber_label: extra.label || `Decider ${extra.category || 'XD'}`,
            best_of_sets: extra.best_of_sets ?? 1,
            points_to_win: extra.points_to_win ?? 21,
            locked: false,
            is_decider_tiebreaker: true
          });
        }
      }

      if (matchInserts.length > 0) {
        await supabase.from("tournament_matches").insert(matchInserts);
      }
    }

    toast.success(`Generated ${insertedTies?.length} ties with rubbers successfully!`);
    await load();
  };

  const clearBracket = async () => {
    const ok = await confirm({
      title: "Delete All Ties?",
      description: "Are you sure you want to delete all ties? All scheduled rubbers, lineups, and tie scores will be removed. This cannot be undone.",
      confirmLabel: "Delete All Ties",
      confirmVariant: "danger"
    });
    if (!ok) return;
    await supabase.from("tournament_ties").delete().eq("tournament_id", tournament.id);
    toast.success("Bracket cleared.");
    await load();
  };

  const distinctPools = useMemo(() => {
    const s = new Set<string>();
    ties.forEach(t => {
      if (t.tie_code.startsWith('POOL_')) {
        const parts = t.tie_code.split('_');
        if (parts[1]) s.add(parts[1]);
      }
    });
    return Array.from(s).sort();
  }, [ties]);

  const filteredTies = useMemo(() => {
    const list = ties.filter(t => {
      if (stageFilter === 'POOL' && t.stage !== 'POOL') return false;
      if (stageFilter === 'KNOCKOUT' && t.stage !== 'KNOCKOUT') return false;
      if (poolFilter !== 'ALL' && t.stage === 'POOL' && !t.tie_code.startsWith(`POOL_${poolFilter}_`)) return false;
      return true;
    });

    const priority = (state: string) => {
      if (state === 'IN_PROGRESS') return 0;
      if (state === 'COMPLETED') return 2;
      return 1;
    };

    return list.sort((a, b) => {
      const pA = priority(a.state);
      const pB = priority(b.state);
      if (pA !== pB) return pA - pB;
      return (a.round_number || 1) - (b.round_number || 1) || a.tie_code.localeCompare(b.tie_code);
    });
  }, [ties, stageFilter, poolFilter]);

  const knockoutTies = useMemo(() => {
    return ties.filter(t => t.stage === 'KNOCKOUT');
  }, [ties]);

  const { knockoutMatches, knockoutRounds } = useMemo(() => {
    if (knockoutTies.length === 0) {
      return { knockoutMatches: [] as BracketMatch[], knockoutRounds: [] as number[] };
    }

    const minKnockoutRound = Math.min(...knockoutTies.map(t => t.round_number || 1));

    // Group ties by normalized round to assign sequential match_numbers
    const roundGroups = new Map<number, any[]>();
    knockoutTies.forEach(t => {
      const normalizedRound = Math.max(1, (t.round_number || 1) - minKnockoutRound + 1);
      if (!roundGroups.has(normalizedRound)) roundGroups.set(normalizedRound, []);
      roundGroups.get(normalizedRound)!.push(t);
    });

    const matches: BracketMatch[] = [];

    roundGroups.forEach((groupTies, roundNum) => {
      // Sort ties in this round: regular ties first (SF1, SF2 / QF1..4 / FINAL), 3rd place playoff last
      groupTies.sort((a, b) => {
        const aPlayoff = a.tie_code.includes('3RD') || (a.round_name || '').toLowerCase().includes('3rd');
        const bPlayoff = b.tie_code.includes('3RD') || (b.round_name || '').toLowerCase().includes('3rd');
        if (aPlayoff && !bPlayoff) return 1;
        if (!aPlayoff && bPlayoff) return -1;
        return a.tie_code.localeCompare(b.tie_code);
      });

      groupTies.forEach((tie, index) => {
        const isPlayoff = tie.tie_code.includes('3RD') || (tie.round_name || '').toLowerCase().includes('3rd');
        const matchNum = isPlayoff ? 99 : index + 1;

        let winnerSide: 1 | 2 | null = null;
        if (tie.winner_team_id) {
          if (tie.team_a_id && tie.winner_team_id === tie.team_a_id) winnerSide = 1;
          else if (tie.team_b_id && tie.winner_team_id === tie.team_b_id) winnerSide = 2;
        }

        const team1Label = tie.team_a?.short_name || tie.team_a?.name || (tie.team_a_label || 'TBD');
        const team2Label = tie.team_b?.short_name || tie.team_b?.name || (tie.team_b_label || 'TBD');

        const scoreString = (tie.score_team_a != null && tie.score_team_b != null)
          ? `${tie.score_team_a} - ${tie.score_team_b}`
          : null;

        matches.push({
          id: tie.id,
          match_code: tie.tie_code,
          round: roundNum,
          round_name: tie.round_name || `Round ${roundNum}`,
          match_number: matchNum,
          team1_label: team1Label,
          team2_label: team2Label,
          winner_side: winnerSide,
          score: scoreString,
          sets_history: null,
          status: tie.state === 'COMPLETED' ? 'completed' : tie.state === 'IN_PROGRESS' ? 'live' : 'scheduled',
          court_number: null
        });
      });
    });

    const rounds = Array.from(roundGroups.keys()).sort((a, b) => a - b);
    return { knockoutMatches: matches, knockoutRounds: rounds };
  }, [knockoutTies]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Team Bracket & Pool Management
          </h2>
          <p className="text-sm text-slate-500">
            Configure multi-pool leagues, knockouts, decider rules, and scheduled rubbers for {teams.length} teams.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {ties.some(t => t.stage === 'POOL') && ties.some(t => t.stage === 'KNOCKOUT') && (
            <button
              onClick={async () => {
                const { data, error } = await supabase.rpc('populate_playoff_qualifiers_from_standings', {
                  p_tournament_id: tournament.id
                });
                if (error) {
                  toast.error(`Failed to advance qualifiers: ${error.message}`);
                } else {
                  toast.success("Pool qualifiers advanced into playoff bracket successfully!");
                  await load();
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl font-bold transition-colors text-xs"
              title="Populates Semifinals/Quarterfinals from current pool rankings"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Advance Qualifiers
            </button>
          )}
          <button
            onClick={() => setEditSettingsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors text-xs text-slate-700 dark:text-slate-300"
            title="Edit advancement cutoffs, playoff format, decider rules, and tie points"
          >
            <Settings2 className="w-4 h-4 text-primary" /> Edit Settings
          </button>
          {ties.length > 0 && (
            <button 
              onClick={clearBracket} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border-2 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl font-bold transition-colors text-xs"
            >
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          )}
          <button 
            onClick={() => {
              if (teams.length < 2) {
                toast.error("Need at least 2 active teams to generate a bracket.");
                return;
              }
              setModalOpen(true);
            }} 
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-primary text-slate-950 hover:opacity-90 rounded-xl font-bold shadow-md transition-opacity text-xs"
          >
            <Swords className="w-4 h-4" /> {ties.length > 0 ? "Regenerate Bracket" : "Generate Bracket"}
          </button>
        </div>
      </div>

      {/* Filter Bar (If ties exist) */}
      {ties.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Stage Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-primary" /> Stage
            </span>
            {(['ALL', 'POOL', 'KNOCKOUT'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStageFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-150 ${
                  stageFilter === s
                    ? 'bg-primary text-slate-950 shadow-md shadow-primary/20 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {s === 'ALL' ? 'All Ties' : s === 'POOL' ? 'Pool Stage' : 'Playoffs / Knockouts'}
              </button>
            ))}
          </div>

          {/* Pool Filter */}
          {distinctPools.length > 0 && stageFilter !== 'KNOCKOUT' && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-sky-400" /> Pool
              </span>
              <button
                onClick={() => setPoolFilter('ALL')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  poolFilter === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All
              </button>
              {distinctPools.map(p => (
                <button
                  key={p}
                  onClick={() => setPoolFilter(p)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    poolFilter === p
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Pool {p}
                </button>
              ))}
            </div>
          )}

          {/* View Mode Toggle (Visual Tree vs List) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80 shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode('visual');
                if (stageFilter === 'POOL') setStageFilter('KNOCKOUT');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                viewMode === 'visual'
                  ? 'bg-slate-900 text-white dark:bg-primary dark:text-slate-950 shadow-sm scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Visual Tree</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white dark:bg-primary dark:text-slate-950 shadow-sm scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>
        </div>
      )}

      {/* Visual Bracket View for Knockout / Playoff Ties */}
      {ties.length > 0 && viewMode === 'visual' && (
        knockoutMatches.length > 0 ? (
          <ErrorBoundary>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-primary" /> Playoff Knockout Tree
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {knockoutMatches.length} Playoff Matches • Zoom, Pan, Search &amp; Highlight
                </span>
              </div>
              <BracketVisual
                matches={knockoutMatches}
                rounds={knockoutRounds}
                tournamentName={tournament?.name || "Tournament"}
                category="Playoffs"
                enablePathHighlight
              />
            </div>
          </ErrorBoundary>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Swords className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700 dark:text-slate-300">No Playoff / Knockout Ties Found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Knockout ties appear here when your tournament includes playoffs (Semifinals, Finals, etc.). Switch to 'List View' to see pool ties or regenerate with playoffs enabled.
            </p>
          </div>
        )
      )}

      {/* Ties List */}
      {ties.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-500">No Bracket Generated</h3>
          <p className="text-slate-400 mt-2 max-w-sm mx-auto text-xs sm:text-sm">
            Click 'Generate Bracket' to configure pools, knockouts, decider rules, and pairings.
          </p>
        </div>
      ) : viewMode === 'list' && (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredTies.map((tie) => {
            const isLive = tie.state === 'IN_PROGRESS';
            const isCompleted = tie.state === 'COMPLETED';
            const isBothLocked = tie.lineup_locked_a && tie.lineup_locked_b;

            return (
              <div 
                key={tie.id} 
                className={`bg-white dark:bg-slate-900 border rounded-3xl p-4 sm:p-5 transition-all shadow-xs hover:shadow-md ${
                  isLive
                    ? "border-rose-500/40 ring-1 ring-rose-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-primary/40"
                }`}
              >
                {/* Tie Card Top Bar: Badges & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shrink-0">
                      {tie.tie_code}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      tie.stage === 'POOL' 
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40' 
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40'
                    }`}>
                      {tie.stage}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {tie.round_name || 'Fixture'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isCompleted && !isLive && (
                      !tie.lineup_locked_a && !tie.lineup_locked_b ? (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> Both teams yet to submit lineup
                        </span>
                      ) : !tie.lineup_locked_a ? (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> {tie.team_a?.short_name || tie.team_a?.name || "Team A"} yet to submit lineup
                        </span>
                      ) : !tie.lineup_locked_b ? (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-amber-500" /> {tie.team_b?.short_name || tie.team_b?.name || "Team B"} yet to submit lineup
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Both lineups locked
                        </span>
                      )
                    )}
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      isLive
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                        : isBothLocked && !isCompleted
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {isLive ? '🔴 LIVE ON COURT' : isBothLocked && !isCompleted ? 'AWAITING REVEAL' : tie.state}
                    </span>
                  </div>
                </div>

                {/* Matchup Layout: Team A vs Team B */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4 my-2">
                  {/* Team A */}
                  <div 
                    onClick={() => {
                      if (tie.team_a?.id || tie.team_a_id) {
                        openTeamModal({
                          id: tie.team_a?.id || tie.team_a_id,
                          name: tie.team_a?.name || 'Team A',
                          short_name: tie.team_a?.short_name,
                          logo_url: tie.team_a?.logo_url,
                          tournament_id: tournament.id,
                        });
                      }
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group transition min-w-0"
                    title="Click to view team players and match schedule"
                  >
                    {tie.team_a?.logo_url ? (
                      <img src={tie.team_a.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-inner px-1 text-center truncate">
                        {tie.team_a?.short_name || 'A'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">
                          {tie.team_a?.name || "TBD / BYE"}
                        </span>
                        {tie.team_a?.short_name && (
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            ({tie.team_a.short_name})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 group-hover:underline block truncate">
                        View Squad & Matches →
                      </span>
                    </div>
                    {tie.score_team_a > 0 && (
                      <span className="font-mono text-base font-black px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {tie.score_team_a}
                      </span>
                    )}
                  </div>

                  {/* VS Badge Center */}
                  <div className="hidden sm:flex flex-col items-center justify-center px-1 shrink-0">
                    <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 dark:border-slate-700">
                      VS
                    </span>
                  </div>

                  {/* Team B */}
                  <div 
                    onClick={() => {
                      if (tie.team_b?.id || tie.team_b_id) {
                        openTeamModal({
                          id: tie.team_b?.id || tie.team_b_id,
                          name: tie.team_b?.name || 'Team B',
                          short_name: tie.team_b?.short_name,
                          logo_url: tie.team_b?.logo_url,
                          tournament_id: tournament.id,
                        });
                      }
                    }}
                    className="flex items-center justify-start sm:justify-end gap-2.5 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group transition min-w-0 sm:text-right"
                    title="Click to view team players and match schedule"
                  >
                    {tie.score_team_b > 0 && (
                      <span className="font-mono text-base font-black px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 order-last sm:order-first">
                        {tie.score_team_b}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center sm:justify-end gap-1.5 min-w-0">
                        <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-primary transition-colors truncate">
                          {tie.team_b?.name || "TBD / BYE"}
                        </span>
                        {tie.team_b?.short_name && (
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            ({tie.team_b.short_name})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 group-hover:underline block truncate">
                        View Squad & Matches →
                      </span>
                    </div>
                    {tie.team_b?.logo_url ? (
                      <img src={tie.team_b.logo_url} alt="" className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-inner px-1 text-center truncate">
                        {tie.team_b?.short_name || 'B'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {tie.scheduled_at && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl">
                        <Clock className="w-3 h-3 text-primary" />
                        {new Date(tie.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(tie.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        let localAt = "";
                        if (tie.scheduled_at) {
                          const d = new Date(tie.scheduled_at);
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          localAt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        }
                        setEditingScheduleTie(editingScheduleTie?.tieId === tie.id ? null : { tieId: tie.id, court: "", at: localAt });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-primary" /> Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTieForVisual(tie)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <Swords className="w-3.5 h-3.5 text-primary" /> Visual Lineup
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTieForConsole(tie)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-slate-950 hover:opacity-90 transition-all shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> Umpire Reveal &amp; Lineup
                    </button>
                  </div>
                </div>

                {/* Inline Schedule Editor */}
                {editingScheduleTie?.tieId === tie.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3 p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-primary" /> Assign Tie Schedule &amp; Court
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingScheduleTie(null)}
                        className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          <MapPin className="w-3 h-3 inline mr-1 text-primary" /> Court (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. C1, C2, Court 1"
                          value={editingScheduleTie.court}
                          onChange={(e) => setEditingScheduleTie(prev => prev ? { ...prev, court: e.target.value } : null)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                          <Clock className="w-3 h-3 inline mr-1 text-primary" /> Date &amp; Time
                        </label>
                        <input
                          type="datetime-local"
                          value={editingScheduleTie.at}
                          onChange={(e) => setEditingScheduleTie(prev => prev ? { ...prev, at: e.target.value } : null)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingScheduleTie(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveTieSchedule}
                        disabled={savingSchedule}
                        className="px-4 py-1.5 rounded-xl bg-primary text-slate-950 font-black text-xs hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Save Schedule
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Generator Modal */}
      <TeamBracketGeneratorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        teams={teams}
        tournament={tournament}
        onGenerate={handleGenerate}
      />

      {/* Edit Settings Modal */}
      <TeamSettingsEditModal
        isOpen={editSettingsModalOpen}
        onClose={() => setEditSettingsModalOpen(false)}
        tournament={tournament}
        onSaved={load}
      />

      {/* Umpire Lineup & Reveal Console Modal */}
      {selectedTieForConsole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-auto overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" /> Match Official Desk
              </span>
              <button
                type="button"
                onClick={() => setSelectedTieForConsole(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 pt-3 pr-1">
              <TieUmpireConsole
                tie={selectedTieForConsole}
                tournament={tournament}
                onClose={() => setSelectedTieForConsole(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Visual Lineup Modal */}
      {selectedTieForVisual && (
        <TieVisualLineupModal
          isOpen={!!selectedTieForVisual}
          onClose={() => setSelectedTieForVisual(null)}
          tie={selectedTieForVisual}
          tournament={tournament}
        />
      )}
    </div>
  );
}
