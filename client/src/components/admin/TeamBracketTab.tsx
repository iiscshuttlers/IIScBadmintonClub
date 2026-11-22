import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
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
import { teamService } from '@/services/teamService';
import { updateTournament } from '@/services/tournamentService';
import type { GeneratedTie } from '@/lib/teamBracketGenerator';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase-types-auto';
import type { Tournament } from '@/types/tournament';
import type { TieFormatConfig, TieFormatConfigObject, TieFormatRubber, TieWithTeamsAndMatches } from '@/types/teamTie';

type BracketTeam = Awaited<ReturnType<typeof teamService.getTournamentTeams>>[number];

/**
 * A tie as this tab loads it. tournament_ties has no team_a_label /
 * team_b_label columns (the generator's placeholder labels are never stored),
 * so the bracket fallbacks that read them are always undefined and an
 * undecided side shows "TBD".
 */
type BracketTie = TieWithTeamsAndMatches & {
  team_a_label?: undefined;
  team_b_label?: undefined;
};

type StatusFilter = 'ALL' | 'LIVE' | 'SCHEDULED' | 'UNSCHEDULED';

interface StatusPill {
  id: StatusFilter;
  label: string;
  count: number;
  isLivePill?: boolean;
}

export function TeamBracketTab({ tournament, isMasterAdmin }: { tournament: Tournament; isMasterAdmin: boolean }) {
  const { confirm } = useConfirm();
  const { openTeamModal } = useTeamModal();
  const [teams, setTeams] = useState<BracketTeam[]>([]);
  const [ties, setTies] = useState<BracketTie[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSettingsModalOpen, setEditSettingsModalOpen] = useState(false);
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<BracketTie | null>(null);
  const [selectedTieForVisual, setSelectedTieForVisual] = useState<BracketTie | null>(null);
  const [stageFilter, setStageFilter] = useState<'ALL' | 'POOL' | 'KNOCKOUT'>('ALL');
  const [poolFilter, setPoolFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'visual'>('list');

  // Tie Scheduling state
  const [editingScheduleTie, setEditingScheduleTie] = useState<{ tieId: string; court: string; at: string } | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tData, tieData] = await Promise.all([
        teamService.getTournamentTeams(tournament.id),
        teamService.getTournamentTies(tournament.id)
      ]);
      setTeams(tData ?? []);
      // teamService types these rows as TournamentTie, which does not match the
      // columns the query selects (no state, lineup or score columns).
      setTies((tieData ?? []) as unknown as BracketTie[]);
    } catch {
      toast.error("Failed to load bracket data");
    } finally {
      setLoading(false);
    }
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

    try {
      await teamService.updateTieSchedule(
        editingScheduleTie.tieId,
        editingScheduleTie.court !== undefined ? editingScheduleTie.court.trim() || null : null,
        isoAt
      );
      toast.success("Tie schedule saved!");
      setEditingScheduleTie(null);
      await load();
    } catch (tieErr: unknown) {
      toast.error(tieErr instanceof Error ? tieErr.message : String(tieErr));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleGenerate = async ({
    format,
    ties: generatedTies,
    poolAssignments,
    tieDeciderConfig
  }: {
    format: 'DIRECT_KNOCKOUT' | 'POOLS_AND_PLAYOFFS' | 'PURE_LEAGUE';
    ties: GeneratedTie[];
    poolAssignments: Record<string, string>;
    tieDeciderConfig: TieFormatConfigObject;
  }) => {
    if (ties.length > 0) {
      const ok = await confirm({
        title: "Regenerate Bracket?",
        description: "This will delete all existing ties and regenerate the tournament schedule. Continue?",
        confirmLabel: "Regenerate",
        confirmVariant: "danger"
      });
      if (!ok) return;
      await teamService.deleteTournamentTies(tournament.id);
    }

    // 1. Update pool assignments on tournament_teams
    if (Object.keys(poolAssignments).length > 0) {
      for (const [teamId, pool] of Object.entries(poolAssignments)) {
        await teamService.updateTeamPool(teamId, pool);
      }
    }

    // 2. Update tournament tie format config and points
    const currentConfig: TieFormatConfig = tournament.tie_format_config || {};
    const updatedConfig: TieFormatConfigObject = {
      ...(typeof currentConfig === 'object' && !Array.isArray(currentConfig) ? currentConfig : { rubbers: currentConfig }),
      ...tieDeciderConfig
    };

    await updateTournament(tournament.id, {
      tie_format_config: updatedConfig,
      tie_points_win: tieDeciderConfig.tie_points_win ?? 2,
      tie_points_draw: tieDeciderConfig.tie_points_draw ?? 1
    });

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

    let insertedTies: Tables<'tournament_ties'>[] = [];
    try {
      // insert(...).select() returns the full inserted rows.
      insertedTies = (await teamService.insertTournamentTies(
        tieInserts.map(({ _temp_advances_to, _temp_loser_advances_to, ...rest }) => rest)
      )) as Tables<'tournament_ties'>[];
    } catch (error: unknown) {
      toast.error(`Error creating ties: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    // 4. Link advances_to_tie & loser_advances_to_tie
    if (insertedTies && insertedTies.length > 0) {
      const codeToId = new Map(insertedTies.map((t) => [t.tie_code, t.id]));
      
      for (const tie of tieInserts) {
        const currentId = codeToId.get(tie.tie_code);
        if (!currentId) continue;

        const updatePayload: TablesUpdate<'tournament_ties'> = {};
        if (tie._temp_advances_to) {
          const nextId = codeToId.get(tie._temp_advances_to);
          if (nextId) updatePayload.advances_to_tie = nextId;
        }
        if (tie._temp_loser_advances_to) {
          const loserId = codeToId.get(tie._temp_loser_advances_to);
          if (loserId) updatePayload.loser_advances_to_tie = loserId;
        }

        if (Object.keys(updatePayload).length > 0) {
          await teamService.updateTournamentTie(currentId, updatePayload);
        }
      }

      // 5. Generate empty rubbers for each tie
      // tournament_matches.round and round_name are NOT NULL with no default,
      // so every rubber carries its tie's round number.
      const matchInserts: TablesInsert<'tournament_matches'>[] = [];
      const teamMap = new Map(teams.map(t => [t.id, t]));
      
      let rubbers: TieFormatRubber[] = [];
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
            round: tie.round_number ?? 1,
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
          const maxOrder = rubbers.reduce((max: number, r) => Math.max(max, r.order || 0), 0) + 1;
          matchInserts.push({
            tournament_id: tournament.id,
            category: extra.category || 'XD',
            match_code: `${tie.tie_code}-${extra.label || 'DECIDER'}`,
            match_number: maxOrder,
            round: tie.round_number ?? 1,
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
        await teamService.insertTournamentMatches(matchInserts);
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
    await teamService.deleteTournamentTies(tournament.id);
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

  // Helper to check if a tie is truly scheduled:
  // Requires both court assignment AND date/time (scheduled_at)
  const isTieScheduled = (t: BracketTie) => {
    const court = t.matches?.find((m) => m.court_number)?.court_number || null;
    const hasCourt = !!court && court.toString().trim() !== '';
    const hasDateTime = !!t.scheduled_at;
    return hasCourt && hasDateTime;
  };

  // Helper to determine if tie is currently live
  const isTieLive = (t: BracketTie) => {
    const hasLiveMatch = t.matches?.some((m) => m.status === 'in_progress' || m.status === 'live');
    const hasScores = (t.score_team_a > 0 || t.score_team_b > 0);
    return t.state === 'IN_PROGRESS' && (hasLiveMatch || hasScores);
  };

  const filteredTies = useMemo(() => {
    const list = ties.filter(t => {
      if (stageFilter === 'POOL' && t.stage !== 'POOL') return false;
      if (stageFilter === 'KNOCKOUT' && t.stage !== 'KNOCKOUT') return false;
      if (poolFilter !== 'ALL' && t.stage === 'POOL' && !t.tie_code.startsWith(`POOL_${poolFilter}_`)) return false;
      
      const live = isTieLive(t);
      const scheduled = isTieScheduled(t);

      if (statusFilter === 'LIVE' && !live) return false;
      if (statusFilter === 'SCHEDULED' && (!scheduled || live || t.state === 'COMPLETED')) return false;
      if (statusFilter === 'UNSCHEDULED' && (scheduled || live || t.state === 'COMPLETED')) return false;

      return true;
    });

    // Priority sorting:
    // 0: Live matches first
    // 1: Scheduled matches (assigned court + time + date)
    // 2: Not scheduled / pending matches
    // 3: Completed matches
    const getTiePriority = (t: BracketTie) => {
      if (isTieLive(t)) return 0;
      if (t.state === 'COMPLETED') return 3;
      if (isTieScheduled(t)) return 1;
      return 2; // Unscheduled
    };

    return list.sort((a, b) => {
      const pA = getTiePriority(a);
      const pB = getTiePriority(b);
      if (pA !== pB) return pA - pB;

      // If both are scheduled, sort chronologically by scheduled_at
      if (pA === 1 && pB === 1 && a.scheduled_at && b.scheduled_at) {
        const timeDiff = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        if (timeDiff !== 0) return timeDiff;
      }

      return (a.round_number || 1) - (b.round_number || 1) || a.tie_code.localeCompare(b.tie_code);
    });
  }, [ties, stageFilter, poolFilter, statusFilter]);

  const knockoutTies = useMemo(() => {
    return ties.filter(t => t.stage === 'KNOCKOUT');
  }, [ties]);

  const { knockoutMatches, knockoutRounds } = useMemo(() => {
    if (knockoutTies.length === 0) {
      return { knockoutMatches: [] as BracketMatch[], knockoutRounds: [] as number[] };
    }

    const minKnockoutRound = Math.min(...knockoutTies.map(t => t.round_number || 1));

    // Group ties by normalized round to assign sequential match_numbers
    const roundGroups = new Map<number, BracketTie[]>();
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

        const tieCourtNumber = tie.matches?.find((m) => m.court_number)?.court_number || null;
        const hasLiveMatch = tie.matches?.some((m) => m.status === 'in_progress' || m.status === 'live');
        const hasScoresOrLineups = (tie.score_team_a > 0 || tie.score_team_b > 0) || (tie.lineup_locked_a && tie.lineup_locked_b);
        const isTieTrulyLive = tie.state === 'IN_PROGRESS' && (hasLiveMatch || hasScoresOrLineups);

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
          status: tie.state === 'COMPLETED' ? 'completed' : isTieTrulyLive ? 'live' : 'scheduled',
          court_number: tieCourtNumber
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 rounded-2xl border border-border shadow-sm">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Team Bracket & Pool Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure multi-pool leagues, knockouts, decider rules, and scheduled rubbers for {teams.length} teams.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {ties.some(t => t.stage === 'POOL') && ties.some(t => t.stage === 'KNOCKOUT') && (
            <button
              onClick={async () => {
                try {
                  await teamService.populatePlayoffQualifiers(tournament.id);
                  toast.success("Pool qualifiers advanced into playoff bracket successfully!");
                  await load();
                } catch (error: unknown) {
                  toast.error(`Failed to advance qualifiers: ${error instanceof Error ? error.message : String(error)}`);
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border-2 border-success/30 text-success hover:bg-success/10 rounded-xl font-bold transition-colors text-xs"
              title="Populates Semifinals/Quarterfinals from current pool rankings"
            >
              <CheckCircle2 className="w-4 h-4 text-success" /> Advance Qualifiers
            </button>
          )}
          <button
            onClick={() => setEditSettingsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 border border-border-strong hover:bg-muted rounded-xl font-bold transition-colors text-xs text-soft"
            title="Edit advancement cutoffs, playoff format, decider rules, and tie points"
          >
            <Settings2 className="w-4 h-4 text-primary" /> Edit Settings
          </button>
          {ties.length > 0 && (
            <button 
              onClick={clearBracket} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border-2 border-danger/20 text-danger hover:bg-danger/10 rounded-xl font-bold transition-colors text-xs"
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-primary text-primary-foreground hover:opacity-90 rounded-xl font-bold shadow-md transition-opacity text-xs"
          >
            <Swords className="w-4 h-4" /> {ties.length > 0 ? "Regenerate Bracket" : "Generate Bracket"}
          </button>
        </div>
      </div>

      {/* Filter Bar (If ties exist) */}
      {ties.length > 0 && (
        <div className="flex flex-col gap-3 bg-card/60 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-border shadow-sm">
          {/* Top Row: Status / Scheduling Filter + View Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Filter (All, Live, Scheduled, Unscheduled) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5 text-primary" /> Schedule
              </span>
              {(
                [
                  { id: 'ALL', label: 'All', count: ties.length },
                  { id: 'LIVE', label: 'Live', count: ties.filter(isTieLive).length, isLivePill: true },
                  { id: 'SCHEDULED', label: 'Scheduled', count: ties.filter(t => isTieScheduled(t) && !isTieLive(t) && t.state !== 'COMPLETED').length },
                  { id: 'UNSCHEDULED', label: 'Unscheduled', count: ties.filter(t => !isTieScheduled(t) && !isTieLive(t) && t.state !== 'COMPLETED').length },
                ] as const
              ).map(({ id, label, count, isLivePill }: StatusPill) => {
                const isActive = statusFilter === id;
                return (
                  <Button
                    key={id}
                    size="pill"
                    variant="tab"
                    onClick={() => setStatusFilter(id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all duration-150 flex items-center gap-1.5 ${
                      isActive
                        ? isLivePill
                          ? 'bg-danger text-danger-foreground shadow-md shadow-danger/20 scale-[1.02]'
                          : 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                        : 'bg-muted text-soft hover:bg-muted-strong'
                    }`}
                  >
                    {isLivePill && (
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-foreground animate-ping' : 'bg-live'}`} />
                    )}
                    <span>{label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-media/20 text-current' : 'bg-muted-strong text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  </Button>
                );
              })}
            </div>

            {/* View Mode Toggle (Visual Tree vs List) */}
            <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-2xl border border-border-strong/80 shrink-0 self-start sm:self-auto">
              <Button
                type="button"
                size="pill"
                variant="tab"
                onClick={() => {
                  setViewMode('visual');
                  if (stageFilter === 'POOL') setStageFilter('KNOCKOUT');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'visual'
                    ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]'
                    : 'text-muted-foreground hover:text-soft'
                }`}
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Visual Tree</span>
              </Button>
              <Button
                type="button"
                size="pill"
                variant="tab"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]'
                    : 'text-muted-foreground hover:text-soft'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>List View</span>
              </Button>
            </div>
          </div>

          {/* Secondary Row: Stage Filter & Pool Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-border/80">
            {/* Stage Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-primary" /> Stage
              </span>
              {(['ALL', 'POOL', 'KNOCKOUT'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    stageFilter === s
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-muted text-soft hover:bg-muted-strong'
                  }`}
                >
                  {s === 'ALL' ? 'All Stages' : s === 'POOL' ? 'Pool Stage' : 'Playoffs / Knockouts'}
                </button>
              ))}
            </div>

            {/* Pool Filter */}
            {distinctPools.length > 0 && stageFilter !== 'KNOCKOUT' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-info" /> Pool
                </span>
                <button
                  onClick={() => setPoolFilter('ALL')}
                  className={`px-2 py-1 rounded-xl text-xs font-bold transition-all ${
                    poolFilter === 'ALL'
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-muted text-soft hover:bg-muted-strong'
                  }`}
                >
                  All
                </button>
                {distinctPools.map(p => (
                  <button
                    key={p}
                    onClick={() => setPoolFilter(p)}
                    className={`px-2 py-1 rounded-xl text-xs font-bold transition-all ${
                      poolFilter === p
                        ? 'bg-foreground text-background shadow-sm'
                        : 'bg-muted text-soft hover:bg-muted-strong'
                    }`}
                  >
                    Pool {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Bracket View for Knockout / Playoff Ties */}
      {ties.length > 0 && viewMode === 'visual' && (
        knockoutMatches.length > 0 ? (
          <ErrorBoundary>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-primary" /> Playoff Knockout Tree
                </span>
                <span className="text-[11px] font-bold text-muted-foreground">
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
          <div className="text-center py-16 bg-card/50 rounded-3xl border border-border shadow-sm">
            <Swords className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h4 className="text-base font-bold text-soft">No Playoff / Knockout Ties Found</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Knockout ties appear here when your tournament includes playoffs (Semifinals, Finals, etc.). Switch to 'List View' to see pool ties or regenerate with playoffs enabled.
            </p>
          </div>
        )
      )}

      {/* Ties List */}
      {ties.length === 0 ? (
        <div className="text-center py-20 bg-card/50 rounded-3xl border border-border shadow-sm">
          <Trophy className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-xl font-bold text-muted-foreground">No Bracket Generated</h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto text-xs sm:text-sm">
            Click 'Generate Bracket' to configure pools, knockouts, decider rules, and pairings.
          </p>
        </div>
      ) : viewMode === 'list' && (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredTies.map((tie) => {
            // Find assigned court number from tie or its rubbers
            const courtNumber = tie.matches?.find((m) => m.court_number)?.court_number || null;
            
            // A tie is ONLY truly live on court if:
            // 1. Matches have been started (status is in_progress / live), OR
            // 2. Tie state is IN_PROGRESS AND teams are actually active (scores entered, or lineups locked/revealed)
            const hasLiveMatch = tie.matches?.some((m) => m.status === 'in_progress' || m.status === 'live');
            const hasScores = (tie.score_team_a > 0 || tie.score_team_b > 0);
            const isBothLocked = tie.lineup_locked_a && tie.lineup_locked_b;
            const isCompleted = tie.state === 'COMPLETED';

            const isLive = tie.state === 'IN_PROGRESS' && (hasLiveMatch || hasScores);

            return (
              <div 
                key={tie.id} 
                className={`bg-card border rounded-3xl p-4 sm:p-5 transition-all shadow-xs hover:shadow-md ${
                  isLive
                    ? "border-live/40 ring-1 ring-live/20"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {/* Tie Card Top Bar: Badges & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-border/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-muted text-soft border border-border-strong/60 shrink-0">
                      {tie.tie_code}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      tie.stage === 'POOL' 
                        ? 'bg-info/25 text-info border border-info/25' 
                        : 'bg-warning/25 text-warning border border-warning/25'
                    }`}>
                      {tie.stage}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground">
                      {tie.round_name || 'Fixture'}
                    </span>
                    {courtNumber && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                        <MapPin className="w-3 h-3 text-primary" />
                        {courtNumber.toUpperCase().startsWith('COURT') || courtNumber.toUpperCase().startsWith('C') ? courtNumber : `Court ${courtNumber}`}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isCompleted && !isLive && (
                      !tie.lineup_locked_a && !tie.lineup_locked_b ? (
                        <span className="text-[10px] font-bold text-warning bg-warning/15 px-2.5 py-0.5 rounded-full border border-warning/35 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-warning" /> Both teams yet to submit lineup
                        </span>
                      ) : !tie.lineup_locked_a ? (
                        <span className="text-[10px] font-bold text-warning bg-warning/15 px-2.5 py-0.5 rounded-full border border-warning/35 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-warning" /> {tie.team_a?.short_name || tie.team_a?.name || "Team A"} yet to submit lineup
                        </span>
                      ) : !tie.lineup_locked_b ? (
                        <span className="text-[10px] font-bold text-warning bg-warning/15 px-2.5 py-0.5 rounded-full border border-warning/35 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-warning" /> {tie.team_b?.short_name || tie.team_b?.name || "Team B"} yet to submit lineup
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-success bg-success/15 px-2.5 py-0.5 rounded-full border border-success/35 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-success" /> Both lineups locked
                        </span>
                      )
                    )}
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      isLive
                        ? 'bg-live/10 text-live border border-live/20 animate-pulse'
                        : isBothLocked && !isCompleted
                        ? 'bg-warning/10 text-warning border border-warning/20'
                        : isCompleted
                        ? 'bg-success/10 text-success border border-success/20'
                        : isTieScheduled(tie)
                        ? 'bg-info/10 text-info border border-info/20'
                        : 'bg-muted text-muted-foreground border border-border-strong/60'
                    }`}>
                      {isLive 
                        ? '🔴 LIVE ON COURT' 
                        : isBothLocked && !isCompleted 
                        ? 'AWAITING REVEAL' 
                        : isCompleted
                        ? 'COMPLETED'
                        : isTieScheduled(tie)
                        ? 'SCHEDULED'
                        : 'UNSCHEDULED'}
                    </span>
                  </div>
                </div>

                {/* Matchup Layout: Team A vs Team B */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-4 my-2">
                  {/* Team A */}
                  {/* Team A Box Card */}
                  <button 
                    type="button"
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
                    className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border bg-card/60 hover:bg-muted/80 hover:border-primary/40 active:scale-[0.99] cursor-pointer group transition text-left min-w-0"
                    title="Click to view team players and match schedule"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {tie.team_a?.logo_url ? (
                        <img src={tie.team_a.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-border-strong shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-info to-info flex items-center justify-center text-on-accent font-black text-xs shrink-0 shadow-inner px-1 text-center">
                          {tie.team_a?.short_name || 'A'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-sm text-foreground group-hover:text-primary transition-colors truncate block">
                            {tie.team_a?.name || "TBD / BYE"}
                          </span>
                          {tie.team_a?.short_name && (
                            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                              ({tie.team_a.short_name})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5 truncate mt-0.5">
                          <span>View Squad</span>
                          <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform">→</span>
                        </span>
                      </div>
                    </div>
                    {tie.score_team_a > 0 && (
                      <span className="font-mono text-base font-black px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 ml-1">
                        {tie.score_team_a}
                      </span>
                    )}
                  </button>

                  {/* VS Badge Center */}
                  <div className="hidden sm:flex flex-col items-center justify-center px-1 shrink-0">
                    <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border-strong">
                      VS
                    </span>
                  </div>

                  {/* Team B Box Card */}
                  <button 
                    type="button"
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
                    className="w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-border bg-card/60 hover:bg-muted/80 hover:border-primary/40 active:scale-[0.99] cursor-pointer group transition text-left min-w-0"
                    title="Click to view team players and match schedule"
                  >
                    {tie.score_team_b > 0 && (
                      <span className="font-mono text-base font-black px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 mr-1">
                        {tie.score_team_b}
                      </span>
                    )}
                    <div className="flex items-center sm:justify-end gap-2.5 min-w-0 flex-1 sm:text-right">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center sm:justify-end gap-1.5 min-w-0">
                          <span className="font-black text-sm text-foreground group-hover:text-primary transition-colors truncate block">
                            {tie.team_b?.name || "TBD / BYE"}
                          </span>
                          {tie.team_b?.short_name && (
                            <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                              ({tie.team_b.short_name})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center sm:justify-end gap-0.5 truncate mt-0.5">
                          <span>View Squad</span>
                          <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform">→</span>
                        </span>
                      </div>
                      {tie.team_b?.logo_url ? (
                        <img src={tie.team_b.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover border border-border-strong shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-warning to-danger flex items-center justify-center text-on-accent font-black text-xs shrink-0 shadow-inner px-1 text-center">
                          {tie.team_b?.short_name || 'B'}
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {tie.scheduled_at ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-soft bg-muted/90 px-3 py-1 rounded-xl border border-border-strong/60 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {new Date(tie.scheduled_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-muted-foreground font-normal">•</span>
                        <span>
                          {new Date(tie.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-xl border border-warning/20">
                        <Clock className="w-3.5 h-3.5 text-warning" />
                        Time & Date not set
                      </span>
                    )}
                    {courtNumber ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20">
                        <MapPin className="w-3 h-3 text-primary" />
                        {courtNumber.toUpperCase().startsWith('COURT') || courtNumber.toUpperCase().startsWith('C') ? courtNumber : `Court ${courtNumber}`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-xl border border-warning/20">
                        <MapPin className="w-3 h-3 text-warning" />
                        Court not assigned
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
                        setEditingScheduleTie(editingScheduleTie?.tieId === tie.id ? null : { tieId: tie.id, court: courtNumber || "", at: localAt });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border-strong hover:bg-muted text-soft transition-colors"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-primary" /> Schedule
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTieForVisual(tie)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-muted hover:bg-muted-strong text-soft transition-colors"
                    >
                      <Swords className="w-3.5 h-3.5 text-primary" /> Visual Lineup
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTieForConsole(tie)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> Umpire Reveal &amp; Lineup
                    </button>
                  </div>
                </div>

                {/* Inline Schedule Editor */}
                {editingScheduleTie?.tieId === tie.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3 p-3.5 rounded-2xl bg-background/60 border animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-soft flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 text-primary" /> Assign Tie Schedule &amp; Court
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingScheduleTie(null)}
                        className="p-1 rounded-full text-muted-foreground hover:text-soft transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                          <MapPin className="w-3 h-3 inline mr-1 text-primary" /> Court (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. C1, C2, Court 1"
                          value={editingScheduleTie.court}
                          onChange={(e) => setEditingScheduleTie(prev => prev ? { ...prev, court: e.target.value } : null)}
                          className="w-full px-3 py-2 rounded-xl border border-border-strong bg-card text-foreground text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                          <Clock className="w-3 h-3 inline mr-1 text-primary" /> Date &amp; Time
                        </label>
                        <input
                          type="datetime-local"
                          value={editingScheduleTie.at}
                          onChange={(e) => setEditingScheduleTie(prev => prev ? { ...prev, at: e.target.value } : null)}
                          className="w-full px-3 py-2 rounded-xl border border-border-strong bg-card text-foreground text-xs font-bold outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingScheduleTie(null)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-muted transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveTieSchedule}
                        disabled={savingSchedule}
                        className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-black text-xs hover:brightness-110 active:scale-95 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-media/75 backdrop-blur-md animate-in fade-in overflow-hidden">
          <div className="bg-card w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border shadow-2xl p-5 sm:p-6 my-auto overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-border shrink-0">
              <span className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" /> Match Official Desk
              </span>
              <button
                type="button"
                onClick={() => setSelectedTieForConsole(null)}
                className="p-1 rounded-full text-muted-foreground hover:text-soft hover:bg-muted cursor-pointer"
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
