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
  Crown
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
  const { data: rawTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['organizer_teams', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_teams' as any)
        .select('*, members:tournament_team_members(*, player:players(id, full_name, gender))')
        .eq('tournament_id', tournamentId);
      if (error) throw error;
      return (data || []) as any[];

    },
    enabled: !!tournamentId
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
    toast.success('Organizer dashboard updated');
  };

  // Compute key action-required metrics
  const tiesWithMissingLineups = ties.filter((t: any) => {
    return (!t.lineup_locked_a || !t.lineup_locked_b) && t.state !== 'COMPLETED';
  });

  const tiesAwaitingReveal = ties.filter((t: any) => {
    return t.lineup_locked_a && t.lineup_locked_b && !t.lineup_revealed;
  });

  const liveTiesInProgress = ties.filter((t: any) => {
    return t.state === 'IN_PROGRESS';
  });

  const matchesMissingCourt = matches.filter((m: any) => {
    return !m.court && m.status !== 'completed';
  });

  const completedMatchesCount = matches.filter((m: any) => m.status === 'completed').length;
  const matchCompletionRate = matches.length > 0 
    ? Math.round((completedMatchesCount / matches.length) * 100) 
    : 0;

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
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Action Required &amp; Bottlenecks
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Missing Lineups */}
          <div className={`p-4 rounded-2xl border transition ${
            tiesWithMissingLineups.length > 0 
              ? 'bg-rose-950/20 border-rose-900/40 text-white' 
              : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">Missing Lineups</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                tiesWithMissingLineups.length > 0 ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tiesWithMissingLineups.length}
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {tiesWithMissingLineups.length} Ties
            </p>
            <p className="text-xs text-slate-400 mt-1">
              One or both team captains haven't locked lineups
            </p>
          </div>

          {/* Awaiting Reveal */}
          <div className={`p-4 rounded-2xl border transition ${
            tiesAwaitingReveal.length > 0 
              ? 'bg-amber-950/20 border-amber-900/40 text-white' 
              : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">Awaiting Reveal</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                tiesAwaitingReveal.length > 0 ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {tiesAwaitingReveal.length}
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {tiesAwaitingReveal.length} Ready
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Both lineups locked — awaiting umpire reveal
            </p>
          </div>

          {/* Live In-Progress */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">Live Ties</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-slate-950">
                {liveTiesInProgress.length} Active
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {liveTiesInProgress.length} Playing
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ties currently undergoing live matches
            </p>
          </div>

          {/* Unassigned Courts */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">Unassigned Courts</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-400">
                {matchesMissingCourt.length}
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {matchesMissingCourt.length} Matches
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Active rubbers without court numbers
            </p>
          </div>
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
            <p className="font-bold text-sm text-white">{teams.length}</p>
          </div>
          <div>
            <span className="text-slate-400">Total Ties:</span>
            <p className="font-bold text-sm text-white">{ties.length}</p>
          </div>
          <div>
            <span className="text-slate-400">Total Rubbers:</span>
            <p className="font-bold text-sm text-white">{matches.length}</p>
          </div>
          <div>
            <span className="text-slate-400">Completed Rubbers:</span>
            <p className="font-bold text-sm text-emerald-400">
              {completedMatchesCount} / {matches.length}
            </p>
          </div>
        </div>
      </div>

      {/* TIES DETAILED STATUS TABLE */}
      <div className="bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              Ties &amp; Lineup Health Monitor
            </h3>
            <p className="text-xs text-slate-400">
              Realtime submission status for Team A vs Team B
            </p>
          </div>
        </div>

        {ties.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No fixtures or ties created yet for this tournament.
          </div>
        ) : (
          <div className="space-y-3">
            {ties.map((tie: any) => {
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

      {/* Tie Umpire Console Modal / Sheet */}
      {selectedTieForConsole && (
        <TieUmpireConsole 
          tie={selectedTieForConsole} 
          onClose={() => {
            setSelectedTieForConsole(null);
            handleRefreshAll();
          }} 
        />
      )}
    </div>
  );
}
