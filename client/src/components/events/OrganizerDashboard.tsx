import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Users, 
  RefreshCw, 
  ExternalLink, 
  Eye, 
  ChevronRight, 
  ShieldAlert, 
  ArrowRight, 
  Swords, 
  Crown,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TieUmpireConsole } from '@/components/umpire/TieUmpireConsole';
import { useTeamModal } from '@/contexts/TeamModalContext';
import { useAuth } from '@/contexts/AuthContext';
import { calculateMinRosterRequirements, normalizeGender } from '@/lib/teamLineupRules';


interface OrganizerDashboardProps {
  tournamentId: string;
  tournament: any;
}

export function OrganizerDashboard({ tournamentId, tournament }: OrganizerDashboardProps) {
  const { openTeamModal } = useTeamModal();
  const { user, profile } = useAuth();
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<any | null>(null);

  // Current logged in user ID / player ID
  const currentUserId = user?.id;
  const currentPlayerId = profile?.id;

  // 1. Fetch ties
  const { data: ties = [], isLoading: tiesLoading, refetch: refetchTies } = useQuery({
    queryKey: ['organizer_ties', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_ties' as any)
        .select(`
          *,
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(name, short_name, captain_id),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(name, short_name, captain_id)
        `)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // 2. Fetch matches (for schedule/court inspection)
  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ['organizer_matches', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_matches' as any)
        .select('*')
        .eq('tournament_id', tournamentId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // 3. Fetch teams and member counts
  const { data: rawTeams = [], isLoading: teamsLoading, refetch: refetchTeams } = useQuery({
    queryKey: ['organizer_teams', tournamentId],
    queryFn: async () => {
      // 1. Fetch valid teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('tournament_teams' as any)
        .select('*')
        .eq('tournament_id', tournamentId)
        .neq('status', 'DELETED')
        .order('name', { ascending: true });

      if (teamsError) {
        console.error('Error fetching organizer teams:', teamsError);
        throw teamsError;
      }

      const teamList = (teamsData || []) as any[];
      if (teamList.length === 0) return [];

      // 2. Fetch members with joined player info
      const { data: rawMembers, error: membersError } = await supabase
        .from('tournament_team_members' as any)
        .select('id, team_id, player_id, role, status, player:players!player_id(id, full_name, gender)')
        .eq('tournament_id', tournamentId)
        .eq('status', 'ACTIVE');

      let memberList: any[] = [];
      if (membersError) {
        // Fallback with explicit FK constraint name
        const fallback = await supabase
          .from('tournament_team_members' as any)
          .select('id, team_id, player_id, role, status, players:players!tournament_team_members_player_id_fkey(id, full_name, gender)')
          .eq('tournament_id', tournamentId)
          .eq('status', 'ACTIVE');

        if (!fallback.error && fallback.data) {
          memberList = fallback.data.map((m: any) => ({
            ...m,
            player: m.players || m.player
          }));
        } else {
          // If relationship join completely fails, fetch members without join
          const bareMembers = await supabase
            .from('tournament_team_members' as any)
            .select('id, team_id, player_id, role, status')
            .eq('tournament_id', tournamentId)
            .eq('status', 'ACTIVE');
          memberList = (bareMembers.data || []) as any[];
        }
      } else {
        memberList = (rawMembers || []) as any[];
      }

      // Group members by team_id
      const membersByTeam: Record<string, any[]> = {};
      for (const t of teamList) {
        membersByTeam[t.id] = [];
      }
      for (const m of memberList) {
        if (membersByTeam[m.team_id]) {
          membersByTeam[m.team_id].push(m);
        }
      }

      // Merge members into team objects
      return teamList.map(t => ({
        ...t,
        members: membersByTeam[t.id] || []
      }));
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // Sort teams: Captain's team first, then incomplete rosters, then alphabetical
  const teams = useMemo(() => {
    return [...rawTeams].sort((a: any, b: any) => {
      const isCaptainA = (a.captain_id && (a.captain_id === currentUserId || a.captain_id === currentPlayerId)) ||
        a.members?.some((m: any) => (m.user_id === currentUserId || m.player_id === currentPlayerId) && m.is_captain);
      const isCaptainB = (b.captain_id && (b.captain_id === currentUserId || b.captain_id === currentPlayerId)) ||
        b.members?.some((m: any) => (m.user_id === currentUserId || m.player_id === currentPlayerId) && m.is_captain);

      if (isCaptainA && !isCaptainB) return -1;
      if (!isCaptainA && isCaptainB) return 1;

      // Also prioritize any team user is a member of
      const isMemberA = a.members?.some((m: any) => m.user_id === currentUserId || m.player_id === currentPlayerId);
      const isMemberB = b.members?.some((m: any) => m.user_id === currentUserId || m.player_id === currentPlayerId);
      if (isMemberA && !isMemberB) return -1;
      if (!isMemberA && isMemberB) return 1;

      // Then sort by pool and name
      if (a.pool && b.pool && a.pool !== b.pool) {
        return a.pool.localeCompare(b.pool);
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [rawTeams, currentUserId, currentPlayerId]);

  const handleRefreshAll = () => {
    refetchTies();
    refetchMatches();
    refetchTeams();
    toast.success('Organizer dashboard updated');
  };

  // Compute key action-required metrics
  const [selectedBottleneck, setSelectedBottleneck] = useState<'ALL' | 'MISSING_LINEUPS' | 'AWAITING_REVEAL' | 'LIVE_TIES' | 'UNASSIGNED_COURTS'>('ALL');
  const [showBottleneckModal, setShowBottleneckModal] = useState<boolean>(false);

  const tiesWithMissingLineups = useMemo(() => {
    return ties.filter((t: any) => {
      return (!t.lineup_locked_a || !t.lineup_locked_b) && t.state !== 'COMPLETED';
    });
  }, [ties]);

  const tiesAwaitingReveal = useMemo(() => {
    return ties.filter((t: any) => {
      return t.lineup_locked_a && t.lineup_locked_b && !t.lineup_revealed && t.state !== 'COMPLETED';
    });
  }, [ties]);

  const liveTiesInProgress = useMemo(() => {
    return ties.filter((t: any) => {
      return t.state === 'IN_PROGRESS';
    });
  }, [ties]);

  const matchesMissingCourt = useMemo(() => {
    return matches.filter((m: any) => {
      const courtVal = m.court ?? m.court_number;
      return !courtVal && m.status !== 'completed';
    });
  }, [matches]);

  const tiesMissingCourt = useMemo(() => {
    return ties.filter((t: any) => {
      const courtVal = t.court ?? t.court_number;
      return !courtVal && t.state !== 'COMPLETED';
    });
  }, [ties]);

  const completedMatchesCount = matches.filter((m: any) => m.status === 'completed').length;
  
  // Dynamic fallback for total teams in case team records are not yet linked or still loading
  const effectiveTotalTeams = useMemo(() => {
    if (teams.length > 0) return teams.length;
    const distinctTeamIds = new Set<string>();
    ties.forEach((t: any) => {
      if (t.team_a_id) distinctTeamIds.add(t.team_a_id);
      if (t.team_b_id) distinctTeamIds.add(t.team_b_id);
    });
    return distinctTeamIds.size;
  }, [teams.length, ties]);

  // Rubbers count or expected rubbers from ties
  const rawFormat = tournament?.tie_format_config;
  const rubbersPerTie = useMemo(() => {
    if (Array.isArray(rawFormat)) return rawFormat.length;
    if (rawFormat?.rubbers && Array.isArray(rawFormat.rubbers)) return rawFormat.rubbers.length;
    return 5; // standard default for team events
  }, [rawFormat]);

  const totalExpectedRubbers = matches.length > 0 ? matches.length : ties.length * rubbersPerTie;

  const matchCompletionRate = totalExpectedRubbers > 0 
    ? Math.round((completedMatchesCount / totalExpectedRubbers) * 100) 
    : 0;

  // Detailed calculations for bottlenecks
  const missingLineupsStats = useMemo(() => {
    let teamAMissingCount = 0;
    let teamBMissingCount = 0;
    let bothMissingCount = 0;
    let oneMissingCount = 0;

    tiesWithMissingLineups.forEach((t: any) => {
      const aMissing = !t.lineup_locked_a;
      const bMissing = !t.lineup_locked_b;
      if (aMissing && bMissing) {
        bothMissingCount++;
      } else if (aMissing || bMissing) {
        oneMissingCount++;
      }
      if (aMissing) teamAMissingCount++;
      if (bMissing) teamBMissingCount++;
    });

    const totalMissingTeams = teamAMissingCount + teamBMissingCount;

    return {
      tiesCount: tiesWithMissingLineups.length,
      totalMissingTeams,
      bothMissingCount,
      oneMissingCount,
      teamAMissingCount,
      teamBMissingCount
    };
  }, [tiesWithMissingLineups]);

  // Combined unassigned courts metrics
  const unassignedCourtsStats = useMemo(() => {
    return {
      tiesCount: tiesMissingCourt.length,
      rubbersCount: matchesMissingCourt.length,
      // Total items requiring court assignment:
      // If rubbers exist in DB, rubbersCount is primary; if rubbers are not generated yet, tiesCount is primary
      primaryCount: matchesMissingCourt.length > 0 ? matchesMissingCourt.length : tiesMissingCourt.length,
      primaryUnit: matchesMissingCourt.length > 0 ? 'Rubbers' : 'Ties'
    };
  }, [tiesMissingCourt, matchesMissingCourt]);

  // Filtered ties or matches based on selected bottleneck
  const displayedTies = useMemo(() => {
    if (selectedBottleneck === 'MISSING_LINEUPS') return tiesWithMissingLineups;
    if (selectedBottleneck === 'AWAITING_REVEAL') return tiesAwaitingReveal;
    if (selectedBottleneck === 'LIVE_TIES') return liveTiesInProgress;
    if (selectedBottleneck === 'UNASSIGNED_COURTS') return tiesMissingCourt;
    return ties;
  }, [selectedBottleneck, ties, tiesWithMissingLineups, tiesAwaitingReveal, liveTiesInProgress, tiesMissingCourt]);

  const handleCardClick = (type: 'MISSING_LINEUPS' | 'AWAITING_REVEAL' | 'LIVE_TIES' | 'UNASSIGNED_COURTS') => {
    setSelectedBottleneck(prev => prev === type ? 'ALL' : type);
    setShowBottleneckModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              Organizer Command Center
            </h2>
            <p className="text-xs text-slate-400">
              Live operational alerts, lineup bottlenecks, and tournament control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshAll}
            className="text-xs font-bold rounded-xl border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white flex-1 sm:flex-initial"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh Data
          </Button>
          <a
            href={`/tournament-admin?id=${tournamentId}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-slate-950 font-bold text-xs hover:bg-primary/90 transition flex-1 sm:flex-initial text-center whitespace-nowrap shadow-sm"
          >
            Full Admin Panel <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </a>
        </div>
      </div>

      {/* ACTION REQUIRED GRID */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Action Required &amp; Bottlenecks
            <span className="text-[10px] lowercase font-normal text-slate-500">
              (click any card to view detailed breakdown)
            </span>
          </h3>
          {selectedBottleneck !== 'ALL' && (
            <button
              onClick={() => setSelectedBottleneck('ALL')}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Reset Filter (Show All {ties.length} Ties)
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Missing Lineups */}
          <button
            type="button"
            onClick={() => handleCardClick('MISSING_LINEUPS')}
            className={`p-4 rounded-2xl border transition text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.99] ${
              selectedBottleneck === 'MISSING_LINEUPS'
                ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-950/40 text-white shadow-lg'
                : tiesWithMissingLineups.length > 0 
                ? 'bg-rose-950/20 border-rose-900/40 text-white hover:border-rose-700' 
                : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 group-hover:text-rose-300 transition-colors">Missing Lineups</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                tiesWithMissingLineups.length > 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tiesWithMissingLineups.length}
              </span>
            </div>
            <p className="text-2xl font-black text-white flex items-center justify-between">
              <span>{tiesWithMissingLineups.length} Ties</span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </p>
            <p className="text-xs text-rose-300/80 mt-1 font-medium">
              {missingLineupsStats.totalMissingTeams} {missingLineupsStats.totalMissingTeams === 1 ? 'team lineup' : 'team lineups'} missing across {tiesWithMissingLineups.length} ties
            </p>
          </button>

          {/* Awaiting Reveal */}
          <button
            type="button"
            onClick={() => handleCardClick('AWAITING_REVEAL')}
            className={`p-4 rounded-2xl border transition text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.99] ${
              selectedBottleneck === 'AWAITING_REVEAL'
                ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-950/40 text-white shadow-lg'
                : tiesAwaitingReveal.length > 0 
                ? 'bg-amber-950/20 border-amber-900/40 text-white hover:border-amber-700' 
                : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 group-hover:text-amber-300 transition-colors">Awaiting Reveal</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                tiesAwaitingReveal.length > 0 ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {tiesAwaitingReveal.length}
              </span>
            </div>
            <p className="text-2xl font-black text-white flex items-center justify-between">
              <span>{tiesAwaitingReveal.length} Ready</span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </p>
            <p className="text-xs text-amber-300/80 mt-1 font-medium">
              {tiesAwaitingReveal.length > 0 
                ? 'Both lineups locked — awaiting umpire reveal' 
                : 'No ties waiting for reveal right now'}
            </p>
          </button>

          {/* Live In-Progress */}
          <button
            type="button"
            onClick={() => handleCardClick('LIVE_TIES')}
            className={`p-4 rounded-2xl border transition text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.99] ${
              selectedBottleneck === 'LIVE_TIES'
                ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-950/40 text-white shadow-lg'
                : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-300 transition-colors">Live Ties</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                liveTiesInProgress.length > 0 ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {liveTiesInProgress.length} Active
              </span>
            </div>
            <p className="text-2xl font-black text-white flex items-center justify-between">
              <span>{liveTiesInProgress.length} Playing</span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </p>
            <p className="text-xs text-emerald-300/80 mt-1 font-medium">
              {liveTiesInProgress.length > 0 
                ? `${liveTiesInProgress.length} ${liveTiesInProgress.length === 1 ? 'tie' : 'ties'} currently undergoing live rubbers` 
                : 'No ties currently in progress'}
            </p>
          </button>

          {/* Unassigned Courts */}
          <button
            type="button"
            onClick={() => handleCardClick('UNASSIGNED_COURTS')}
            className={`p-4 rounded-2xl border transition text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.99] ${
              selectedBottleneck === 'UNASSIGNED_COURTS'
                ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-950/40 text-white shadow-lg'
                : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 group-hover:text-sky-300 transition-colors">Unassigned Courts</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                unassignedCourtsStats.primaryCount > 0 ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {unassignedCourtsStats.primaryCount}
              </span>
            </div>
            <p className="text-2xl font-black text-white flex items-center justify-between">
              <span>{unassignedCourtsStats.primaryCount} {unassignedCourtsStats.primaryUnit}</span>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </p>
            <p className="text-xs text-sky-300/80 mt-1 font-medium">
              {matchesMissingCourt.length > 0 
                ? `${matchesMissingCourt.length} rubbers across ${tiesMissingCourt.length} ties need court assignments`
                : `${tiesMissingCourt.length} ties awaiting court assignment`}
            </p>
          </button>
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
        <h3 className="font-bold text-sm text-white">
          Tournament Progress &amp; Completion ({matchCompletionRate}%)
        </h3>
        <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-500 rounded-full"
            style={{ width: `${matchCompletionRate}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div>
            <span className="text-slate-400">Total Teams:</span>
            <p className="font-bold text-sm text-white">{effectiveTotalTeams}</p>
          </div>
          <div>
            <span className="text-slate-400">Total Ties:</span>
            <p className="font-bold text-sm text-white">{ties.length}</p>
          </div>
          <div>
            <span className="text-slate-400">Total Rubbers:</span>
            <p className="font-bold text-sm text-white">{totalExpectedRubbers}</p>
          </div>
          <div>
            <span className="text-slate-400">Completed Rubbers:</span>
            <p className="font-bold text-sm text-emerald-400">
              {completedMatchesCount} / {totalExpectedRubbers}
            </p>
          </div>
        </div>
      </div>

      {/* TIES DETAILED STATUS TABLE */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              Ties &amp; Lineup Health Monitor
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {displayedTies.length} / {ties.length} Ties
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {selectedBottleneck === 'ALL' 
                ? 'Realtime submission status for Team A vs Team B' 
                : `Filtered view showing: ${
                    selectedBottleneck === 'MISSING_LINEUPS' ? 'Ties with missing lineups' :
                    selectedBottleneck === 'AWAITING_REVEAL' ? 'Ties locked and awaiting reveal' :
                    selectedBottleneck === 'LIVE_TIES' ? 'Ties currently live' : 'Ties or rubbers with unassigned courts'
                  }`}
            </p>
          </div>
          {selectedBottleneck !== 'ALL' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedBottleneck('ALL')}
              className="text-xs font-bold rounded-xl border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Clear Filter
            </Button>
          )}
        </div>

        {displayedTies.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {selectedBottleneck === 'ALL' 
              ? 'No fixtures or ties created yet for this tournament.' 
              : 'No ties matching this filter criteria! 🎉'}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedTies.map((tie: any) => {
              const lockedA = tie.lineup_locked_a;
              const lockedB = tie.lineup_locked_b;
              const isRevealed = tie.lineup_revealed;

              return (
                <div 
                  key={tie.id} 
                  className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-primary">
                        {tie.tie_code}
                      </span>
                      <span className="font-black text-sm text-white">
                        {tie.team_a?.name || 'TBD'} vs {tie.team_b?.name || 'TBD'}
                      </span>
                    </div>

                    {/* Team status badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                        lockedA 
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50' 
                          : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                      }`}>
                        {lockedA ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {tie.team_a?.short_name || 'Team A'}: {lockedA ? 'Locked' : 'Pending'}
                      </span>

                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                        lockedB 
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50' 
                          : 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                      }`}>
                        {lockedB ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {tie.team_b?.short_name || 'Team B'}: {lockedB ? 'Locked' : 'Pending'}
                      </span>

                      {isRevealed ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/50 font-bold">
                          Revealed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                          Hidden
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedTieForConsole(tie)}
                      className="text-xs font-bold rounded-xl border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Manage Lineup &amp; Reveal
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ROSTER READINESS GRID - MODERN SPORTS DESIGN */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tight">
              <Users className="w-5 h-5 text-primary" />
              Team Roster Completeness
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Player counts, minimum requirements, and roster verification across all teams
            </p>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Click any team card to inspect roster &amp; lineup order
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t: any) => {
            const activeCount = t.members?.filter((m: any) => m.status === 'ACTIVE').length || 0;
            
            // Dynamic Roster Minimum based on tournament tie format and repetition rules
            const rawFormat = tournament?.tie_format_config;
            let currentRubbers: any[] = [];
            if (Array.isArray(rawFormat)) currentRubbers = rawFormat;
            else if (rawFormat?.rubbers && Array.isArray(rawFormat.rubbers)) currentRubbers = rawFormat.rubbers;

            const rulesObj = typeof rawFormat === 'object' && !Array.isArray(rawFormat) ? rawFormat : {};
            const dynReq = currentRubbers.length > 0
              ? calculateMinRosterRequirements(currentRubbers, {
                  max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? tournament?.max_rubbers_per_player ?? 2,
                  max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? tournament?.max_rubbers_per_player ?? 2,
                  allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                  ignore_gender_rules: tournament?.ignore_gender_rules,
                  team_roster_min: tournament?.team_roster_min
                })
              : null;

            const minRequired = dynReq?.minTotalPlayers || tournament?.team_roster_min || tournament?.min_team_size || 4;
            const isReady = activeCount >= minRequired;
            const pct = Math.min(100, Math.round((activeCount / minRequired) * 100));
            // Check gender balance against dynamic requirements
            let activeMales = 0;
            let activeFemales = 0;
            (t.members || []).forEach((m: any) => {
              if (m.status !== 'ACTIVE') return;
              const g = normalizeGender(m.player?.gender || m.gender);
              if (g === 'Female') activeFemales++;
              else activeMales++;
            });

            const maleDeficit = dynReq ? Math.max(0, dynReq.minMalePlayers - activeMales) : 0;
            const femaleDeficit = dynReq ? Math.max(0, dynReq.minFemalePlayers - activeFemales) : 0;
            const hasGenderDeficit = maleDeficit > 0 || femaleDeficit > 0;
            const isFullyReady = isReady && !hasGenderDeficit;
            const neededCount = Math.max(0, minRequired - activeCount);

            // Check if current logged-in user belongs to this team
            const isMyTeam = (t.captain_id && (t.captain_id === currentUserId || t.captain_id === currentPlayerId)) ||
              t.members?.some((m: any) => m.user_id === currentUserId || m.player_id === currentPlayerId);


            // Determine border & background styling:
            // 1. User's own team: golden color styling
            // 2. Roster Ready: emerald / green styling
            // 3. Incomplete: slate / rose-amber styling
            const cardThemeClass = isMyTeam
              ? 'bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-950 border-amber-400/90 shadow-md shadow-amber-500/10'
              : isFullyReady
                ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400 hover:bg-slate-900'
                : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-900';


            const poolBadgeClass = isMyTeam
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
              : isFullyReady
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700';

            const statusPillClass = isMyTeam
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
              : isFullyReady
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30';

            return (
              <div 
                key={t.id} 
                onClick={() => openTeamModal({
                  id: t.id,
                  name: t.name,
                  short_name: t.short_name,
                  pool: t.pool,
                  captain_id: t.captain_id,
                  tournament_id: tournamentId,
                  logo_url: t.logo_url
                }, 'roster')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    openTeamModal({
                      id: t.id,
                      name: t.name,
                      short_name: t.short_name,
                      pool: t.pool,
                      captain_id: t.captain_id,
                      tournament_id: tournamentId,
                      logo_url: t.logo_url
                    }, 'roster');
                  }
                }}
                className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-left group flex flex-col justify-between h-[156px] relative overflow-hidden select-none ${cardThemeClass}`}
              >
                {/* 1. TOP HEADER: Pool on Left, Status on Right (Strict single row) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {t.pool ? (
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap ${poolBadgeClass}`}>
                        Pool {t.pool}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded border whitespace-nowrap bg-slate-800 text-slate-400 border-slate-700">
                        Open Pool
                      </span>
                    )}
                  </div>

                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${statusPillClass}`}>
                    {isFullyReady ? 'Roster Ready' : 'Incomplete'}
                  </span>
                </div>

                {/* 2. TEAM IDENTITY: Name and Short Name */}
                <div className="min-w-0">
                  <h4 className="font-extrabold text-base text-white group-hover:text-primary transition-colors leading-tight truncate">
                    {t.name}
                  </h4>
                  {t.short_name && (
                    <span className="inline-block mt-1 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700">
                      {t.short_name}
                    </span>
                  )}
                </div>

                {/* 3. ROSTER PROGRESS & ALIGNED ROW (Strict single row, no roster button) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-300 font-semibold">
                      <strong className="text-white font-black text-sm">{activeCount}</strong>/{minRequired} registered
                      <span className="text-[10px] text-slate-400 ml-1 font-mono">({activeMales}♂,{activeFemales}♀)</span>
                    </span>
                    {femaleDeficit > 0 ? (
                      <span className="text-xs font-bold text-rose-400">
                        (Needs {femaleDeficit}♀)
                      </span>
                    ) : maleDeficit > 0 ? (
                      <span className="text-xs font-bold text-sky-400">
                        (Needs {maleDeficit}♂)
                      </span>
                    ) : !isReady ? (
                      <span className="text-xs font-bold text-amber-400">
                        ({neededCount} needed)
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-400">
                        ✓ Complete
                      </span>
                    )}
                  </div>


                  {/* Progress bar track */}
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 rounded-full ${
                        isMyTeam
                          ? 'bg-amber-400'
                          : isReady 
                            ? 'bg-emerald-500' 
                            : 'bg-rose-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottleneck Details Drill-Down Modal */}
      {showBottleneckModal && selectedBottleneck !== 'ALL' && (
        <div 
          className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setShowBottleneckModal(false)}
        >
          <div 
            className="max-w-2xl w-full max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl border ${
                  selectedBottleneck === 'MISSING_LINEUPS' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                  selectedBottleneck === 'AWAITING_REVEAL' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  selectedBottleneck === 'LIVE_TIES' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  'bg-sky-500/10 text-sky-400 border-sky-500/20'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">
                    {selectedBottleneck === 'MISSING_LINEUPS' && `Missing Lineups (${tiesWithMissingLineups.length} Ties • ${missingLineupsStats.totalMissingTeams} Teams Pending)`}
                    {selectedBottleneck === 'AWAITING_REVEAL' && `Awaiting Reveal (${tiesAwaitingReveal.length} Ties Ready)`}
                    {selectedBottleneck === 'LIVE_TIES' && `Live In-Progress (${liveTiesInProgress.length} Ties Active)`}
                    {selectedBottleneck === 'UNASSIGNED_COURTS' && `Unassigned Courts (${unassignedCourtsStats.primaryCount} ${unassignedCourtsStats.primaryUnit})`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedBottleneck === 'MISSING_LINEUPS' && "Detailed breakdown of ties where one or both team captains haven't locked lineups."}
                    {selectedBottleneck === 'AWAITING_REVEAL' && "Both teams locked lineups. Ready for umpire to review differences and reveal."}
                    {selectedBottleneck === 'LIVE_TIES' && "Ties actively playing rubbers right now with live scores."}
                    {selectedBottleneck === 'UNASSIGNED_COURTS' && "Ties and rubbers that need a court assigned before play can begin."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBottleneckModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-header Summary Stats Bar */}
            <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center gap-3 text-xs shrink-0">
              {selectedBottleneck === 'MISSING_LINEUPS' && (
                <>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                    <span>Both Missing: {missingLineupsStats.bothMissingCount} ties</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                    <span>One Missing: {missingLineupsStats.oneMissingCount} ties</span>
                  </div>
                  <div className="text-slate-400 font-medium">
                    Total missing team submissions: <strong className="text-white">{missingLineupsStats.totalMissingTeams}</strong>
                  </div>
                </>
              )}

              {selectedBottleneck === 'AWAITING_REVEAL' && (
                <div className="text-slate-300 font-medium">
                  {tiesAwaitingReveal.length > 0 
                    ? `Click "Manage & Reveal" on any tie below to open the Umpire Console and reveal lineups.` 
                    : `No ties currently waiting for reveal.`}
                </div>
              )}

              {selectedBottleneck === 'LIVE_TIES' && (
                <div className="text-slate-300 font-medium">
                  {liveTiesInProgress.length > 0 
                    ? `Click "Manage & Reveal" to view live rubber status and enter match scores.` 
                    : `No ties are currently playing live matches.`}
                </div>
              )}

              {selectedBottleneck === 'UNASSIGNED_COURTS' && (
                <>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold">
                    <span>Ties Missing Court: {tiesMissingCourt.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">
                    <span>Rubbers Missing Court: {matchesMissingCourt.length}</span>
                  </div>
                </>
              )}
            </div>

            {/* Modal Body: List of ties/rubbers */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {displayedTies.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm space-y-1">
                  <p className="font-bold text-white">All clear!</p>
                  <p className="text-xs">No ties found under this filter right now.</p>
                </div>
              ) : (
                displayedTies.map((tie: any) => {
                  const lockedA = !!tie.lineup_locked_a;
                  const lockedB = !!tie.lineup_locked_b;
                  const courtVal = tie.court || tie.court_number;

                  return (
                    <div 
                      key={tie.id} 
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-primary">
                            {tie.tie_code || 'TIE'}
                          </span>
                          <span className="font-black text-sm text-white">
                            {tie.team_a?.name || 'Team A'} vs {tie.team_b?.name || 'Team B'}
                          </span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            tie.state === 'IN_PROGRESS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            tie.state === 'COMPLETED' ? 'bg-slate-800 text-slate-400' :
                            'bg-slate-800/80 text-slate-300'
                          }`}>
                            {tie.state || 'SCHEDULED'}
                          </span>
                        </div>

                        {/* Missing Lineup Status Badges */}
                        {selectedBottleneck === 'MISSING_LINEUPS' && (
                          <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                            <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
                              lockedA 
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' 
                                : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                            }`}>
                              <span>{lockedA ? '✓' : '⚠️'}</span>
                              <span>{tie.team_a?.short_name || tie.team_a?.name || 'Team A'}: {lockedA ? 'Locked' : 'Lineup Missing'}</span>
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
                              lockedB 
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' 
                                : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                            }`}>
                              <span>{lockedB ? '✓' : '⚠️'}</span>
                              <span>{tie.team_b?.short_name || tie.team_b?.name || 'Team B'}: {lockedB ? 'Locked' : 'Lineup Missing'}</span>
                            </span>
                          </div>
                        )}

                        {/* Awaiting Reveal Information */}
                        {selectedBottleneck === 'AWAITING_REVEAL' && (
                          <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold flex items-center gap-1.5">
                              <span>⚡</span> Both lineups locked by captains — ready for umpire reveal!
                            </span>
                          </div>
                        )}

                        {/* Live Ties Status */}
                        {selectedBottleneck === 'LIVE_TIES' && (
                          <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                              Active Rubber Matches In Progress
                            </span>
                            {courtVal && (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 font-medium">
                                Court: {courtVal}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Unassigned Courts Status */}
                        {selectedBottleneck === 'UNASSIGNED_COURTS' && (
                          <div className="flex flex-wrap items-center gap-2 text-xs pt-0.5">
                            <span className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold">
                              Court: {courtVal ? `Assigned (${courtVal})` : '⚠️ No Court Assigned'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTieForConsole(tie);
                            setShowBottleneckModal(false);
                          }}
                          className="text-xs font-bold rounded-xl bg-primary text-slate-950 hover:bg-primary/90"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Manage & Reveal
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center text-xs text-slate-400 shrink-0">
              <span>Showing {displayedTies.length} items</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBottleneckModal(false)}
                className="text-xs font-bold rounded-xl border-slate-700 bg-slate-800 text-slate-200"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tie Umpire Console Modal / Sheet */}
      {selectedTieForConsole && (
        <TieUmpireConsole
          tie={selectedTieForConsole}
          tournament={tournament}
          onClose={() => {
            setSelectedTieForConsole(null);
            handleRefreshAll();
          }} 
        />
      )}
    </div>
  );
}
