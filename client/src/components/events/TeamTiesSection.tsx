import React, { useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  Clock, 
  Lock, 
  ShieldAlert, 
  CheckCircle2, 
  Eye, 
  ArrowUpDown, 
  AlertTriangle, 
  Tv2, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  X,
  Swords,
  AlertCircle,
  Crown,
  ShieldCheck,
  Shield,
  MapPin,
  CalendarClock,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { TieUmpireConsole } from '@/components/umpire/TieUmpireConsole';
import { TieVisualLineupModal } from '@/components/events/TieVisualLineupModal';
import { TeamLineupBuilder } from '@/components/admin/TeamLineupBuilder';
import { useTeamModal } from '@/contexts/TeamModalContext';
import { PlayerMatchBanner } from '@/components/events/PlayerMatchBanner';
import { TeamLogo } from '@/components/events/TeamLogo';
import { StatusChip } from '@/components/tournament/StatusChip';

interface Props {
  tournamentId: string;
  tournament?: any;
}

export function TeamTiesSection({ tournamentId, tournament }: Props) {
  const { session, isUmpire, isAdmin } = useAuth();
  const { openTeamModal } = useTeamModal();
  const [activeConsoleTie, setActiveConsoleTie] = useState<any | null>(null);
  const [activeVisualTie, setActiveVisualTie] = useState<any | null>(null);
  const [activeCaptainLineupTie, setActiveCaptainLineupTie] = useState<{
    tie: any;
    team: any;
    side: 'A' | 'B';
    members: any[];
    onBehalf?: boolean;
  } | null>(null);
  const [expandedTieId, setExpandedTieId] = useState<string | null>(null);
  const [scoreDetailTie, setScoreDetailTie] = useState<any | null>(null);
  const [overrideLoading, setOverrideLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'SCHEDULED' | 'UNSCHEDULED'>('ALL');

  // Fetch current user's team membership and captain status
  const { data: userTeamData } = useQuery({
    queryKey: ['pulse_user_captain_team', tournamentId, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id || !tournamentId) return null;
      // 1. Check if user is captain of any team in this tournament
      const { data: captainTeams } = await supabase
        .from('tournament_teams')
        .select('*, tournaments(*)')
        .eq('tournament_id', tournamentId)
        .eq('captain_id', session.user.id);

      let team = captainTeams && captainTeams[0];
      let isCaptain = !!team;

      // 2. If not found in captain_id, check tournament_team_members
      if (!team) {
        const { data: memberRows } = await supabase
          .from('tournament_team_members')
          .select('*, tournament_teams(*, tournaments(*))')
          .eq('tournament_id', tournamentId)
          .eq('player_id', session.user.id)
          .eq('status', 'ACTIVE');
        if (memberRows && memberRows[0]) {
          team = memberRows[0].tournament_teams;
          isCaptain = memberRows[0].role === 'CAPTAIN' || team?.captain_id === session.user.id;
        }
      }

      if (!team) return null;

      // Fetch active roster for this team
      const { data: members } = await supabase
        .from('tournament_team_members')
        .select('*, players!tournament_team_members_player_id_fkey(*)')
        .eq('team_id', team.id)
        .eq('status', 'ACTIVE');

      return { team, isCaptain, members: members || [] };
    },
    enabled: !!session?.user?.id && !!tournamentId
  });

  // 1. Fetch ties
  const { data: ties = [], isLoading: tiesLoading } = useQuery({
    queryKey: ['pulse_team_ties', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_ties')
        .select(`
          *,
          team_a:tournament_teams!tournament_ties_team_a_id_fkey(id, name, short_name, logo_url),
          team_b:tournament_teams!tournament_ties_team_b_id_fkey(id, name, short_name, logo_url)
        `)
        .eq('tournament_id', tournamentId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const list = data || [];
      const priority = (state: string) => {
        if (state === 'IN_PROGRESS') return 0;
        if (state === 'COMPLETED') return 2;
        return 1;
      };
      return list.sort((a: any, b: any) => {
        const pA = priority(a.state);
        const pB = priority(b.state);
        if (pA !== pB) return pA - pB;
        return (a.round_number || 1) - (b.round_number || 1) || a.tie_code.localeCompare(b.tie_code);
      });
    },
    enabled: !!tournamentId,
    refetchInterval: 5000 // Live polling for pulse
  });

  // 2. Fetch matches for all ties in this tournament
  const { data: allRubberMatches = [], isLoading: matchesLoading } = useQuery({
    queryKey: ['pulse_rubber_matches', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          player1:players!tournament_matches_player1_id_fkey(id, full_name, avatar_url),
          player2:players!tournament_matches_player2_id_fkey(id, full_name, avatar_url),
          player3:players!tournament_matches_player3_id_fkey(id, full_name, avatar_url),
          player4:players!tournament_matches_player4_id_fkey(id, full_name, avatar_url),
          revealer:players!tournament_matches_revealed_by_fkey(id, full_name)
        `)
        .eq('tournament_id', tournamentId)
        .not('tie_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tournamentId,
    refetchInterval: 5000
  });

  // 3. Fetch audit logs for substitution notices
  const { data: allAudits = [] } = useQuery({
    queryKey: ['pulse_tie_audits', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tie_lineup_audits')
        .select(`
          *,
          referee:players!tie_lineup_audits_referee_id_fkey(full_name),
          orig_player:players!tie_lineup_audits_original_player_id_fkey(full_name),
          repl_player:players!tie_lineup_audits_replacement_player_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tournamentId,
    refetchInterval: 5000
  });

  // Assigned organiser/referee/umpire for this tournament (per-tournament officials).
  // Declared before any early return so hook order stays stable.
  const { data: isAssignedOfficial = false } = useQuery({
    queryKey: ['tts_is_assigned_official', tournamentId, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from('tournament_officials')
        .select('role')
        .eq('tournament_id', tournamentId)
        .eq('user_id', session.user.id)
        .in('role', ['ORGANIZER', 'REFEREE', 'UMPIRE']);
      return !!data && data.length > 0;
    },
    enabled: !!session?.user?.id && !!tournamentId,
  });

  if (tiesLoading || matchesLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-xs text-slate-400 mt-2 font-bold">Loading team ties &amp; lineups...</p>
      </div>
    );
  }

  if (ties.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
        <Users className="w-10 h-10 text-slate-300 dark:text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No Team Ties Scheduled</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Fixtures will appear here once the tournament manager creates the schedule.
        </p>
      </div>
    );
  }

  const isUserOfficial = isAdmin || isUmpire || isAssignedOfficial || (tournament?.created_by === session?.user?.id);

  // Official override: enter & lock a team's lineup on behalf of an absent captain.
  const openOverrideLineup = async (tie: any, side: 'A' | 'B') => {
    const teamId = side === 'A' ? tie.team_a_id : tie.team_b_id;
    const baseTeam = side === 'A' ? tie.team_a : tie.team_b;
    if (!teamId) { toast.error('No team assigned to this side yet.'); return; }
    
    const loadingKey = `${tie.id}-${side}`;
    setOverrideLoading(loadingKey);
    try {
      const { data: members, error } = await supabase
        .from('tournament_team_members')
        .select('*, players!tournament_team_members_player_id_fkey(*)')
        .eq('team_id', teamId)
        .eq('status', 'ACTIVE');
      
      if (error) { toast.error(error.message || 'Could not load the team roster.'); return; }

      // Ensure team object has tournaments relationship populated for tie format
      const fullTeam = {
        ...baseTeam,
        id: teamId,
        tournaments: baseTeam?.tournaments || tournament
      };

      setActiveCaptainLineupTie({ tie, team: fullTeam, side, members: members || [], onBehalf: true });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load team roster');
    } finally {
      setOverrideLoading(null);
    }
  };

  // Helper to check if a tie is truly scheduled:
  // Requires both court assignment AND date/time (scheduled_at)
  const isTieScheduled = (t: any) => {
    const court = allRubberMatches.find((m: any) => m.tie_id === t.id && m.court_number)?.court_number || t.court_number || t.court || null;
    const hasCourt = !!court && court.toString().trim() !== '';
    const hasDateTime = !!t.scheduled_at;
    return hasCourt && hasDateTime;
  };

  // Helper to determine if tie is currently live
  const isTieLive = (t: any) => {
    const tieMatches = allRubberMatches.filter((m: any) => m.tie_id === t.id);
    const hasLiveMatch = tieMatches.some((m: any) => m.status === 'in_progress' || m.status === 'live');
    const hasScores = (t.score_team_a > 0 || t.score_team_b > 0);
    return t.state === 'IN_PROGRESS' && (hasLiveMatch || hasScores);
  };

  const filteredTies = (() => {
    const list = ties.filter((t: any) => {
      const live = isTieLive(t);
      const scheduled = isTieScheduled(t);

      if (statusFilter === 'LIVE' && !live) return false;
      if (statusFilter === 'SCHEDULED' && (!scheduled || live || t.state === 'COMPLETED')) return false;
      if (statusFilter === 'UNSCHEDULED' && (scheduled || live || t.state === 'COMPLETED')) return false;

      return true;
    });

    const getTiePriority = (t: any) => {
      if (isTieLive(t)) return 0;
      if (t.state === 'COMPLETED') return 3;
      if (isTieScheduled(t)) return 1;
      return 2; // Unscheduled
    };

    return list.sort((a: any, b: any) => {
      const pA = getTiePriority(a);
      const pB = getTiePriority(b);
      if (pA !== pB) return pA - pB;

      if (pA === 1 && pB === 1 && a.scheduled_at && b.scheduled_at) {
        const timeDiff = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
        if (timeDiff !== 0) return timeDiff;
      }

      return (a.round_number || 1) - (b.round_number || 1) || (a.tie_code || '').localeCompare(b.tie_code || '');
    });
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            Team Fixtures &amp; Official Playing Orders
          </h2>
          <p className="text-xs text-slate-500">
            Head-to-head ties, official court playing order, lineups, and substitution audit trail.
          </p>
        </div>
      </div>

      {/* Player Assigned Rubbers Banner */}
      <PlayerMatchBanner 
        tournamentId={tournamentId} 
        onNavigateToTie={(tieId) => {
          setExpandedTieId(tieId);
          const el = document.getElementById(`tie-card-${tieId}`);
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Captain Desk Banner if user is captain of a team */}
      {userTeamData?.isCaptain && userTeamData?.team && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-primary/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 shadow-inner">
              <Crown className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase text-amber-500 tracking-wider">Captain Desk</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-bold border border-slate-700">
                  {userTeamData.team.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Select any tie involving your team below to assign players, reorder the playing sequence, and lock secret lineups.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/team-hub/${userTeamData.team.id}`}>
              <Button size="sm" className="rounded-xl font-black text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-1.5 shadow-sm cursor-pointer">
                <Shield className="w-3.5 h-3.5" /> Full Team Hub
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Filter Bar (All, Live, Scheduled, Unscheduled) */}
      {ties.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5 text-primary" /> Schedule
            </span>
            {(
              [
                { id: 'ALL', label: 'All', count: ties.length },
                { id: 'LIVE', label: 'Live', count: ties.filter(isTieLive).length, isLivePill: true },
                { id: 'SCHEDULED', label: 'Scheduled', count: ties.filter((t: any) => isTieScheduled(t) && !isTieLive(t) && t.state !== 'COMPLETED').length },
                { id: 'UNSCHEDULED', label: 'Unscheduled', count: ties.filter((t: any) => !isTieScheduled(t) && !isTieLive(t) && t.state !== 'COMPLETED').length },
              ] as const
            ).map(({ id, label, count, isLivePill }: any) => {
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
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 scale-[1.02]'
                        : 'bg-primary text-slate-950 shadow-md shadow-primary/20 scale-[1.02]'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {isLivePill && (
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-ping' : 'bg-rose-500'}`} />
                  )}
                  <span>{label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-black/20 text-current' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="text-xs text-slate-400 font-bold self-end sm:self-center">
            Showing {filteredTies.length} of {ties.length} Ties
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {filteredTies.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-6">
            <CalendarClock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">No {statusFilter.toLowerCase()} ties found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Try switching your filter to 'All' or adjusting the tournament schedule.
            </p>
          </div>
        ) : (
          filteredTies.map((tie: any) => {
            const tieMatches = allRubberMatches
              .filter((m: any) => m.tie_id === tie.id)
              .sort((a: any, b: any) => {
                const orderA = a.playing_order ?? a.rubber_order ?? 99;
                const orderB = b.playing_order ?? b.rubber_order ?? 99;
                return orderA - orderB;
              });

            const tieAudits = allAudits.filter((a: any) => a.tie_id === tie.id);
            const isExpanded = expandedTieId === tie.id || ties.length === 1 || tie.state === 'IN_PROGRESS';
            const isBothLocked = tie.lineup_locked_a && tie.lineup_locked_b;

            const isMyTeamA = userTeamData?.team?.id === tie.team_a_id;
            const isMyTeamB = userTeamData?.team?.id === tie.team_b_id;
            const isMyTeamInThisTie = isMyTeamA || isMyTeamB;
            const mySide: 'A' | 'B' = isMyTeamA ? 'A' : 'B';
            const isMySideLocked = isMyTeamA ? tie.lineup_locked_a : tie.lineup_locked_b;
            const canSubmitLineup = (userTeamData?.isCaptain || isAdmin) && isMyTeamInThisTie;
            const isScheduled = isTieScheduled(tie);
            const isLive = isTieLive(tie);

            return (
              <div 
                key={tie.id}
                className={`bg-white dark:bg-slate-900 rounded-3xl border shadow-sm overflow-hidden transition-all duration-200 ${
                  isMyTeamInThisTie
                    ? "border-amber-500/40 ring-1 ring-amber-500/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-primary/40"
                }`}
              >
                {/* Tie Header Bar */}
                <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* Tie Code, Stage & Court */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-primary text-primary-foreground">
                        {tie.tie_code}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                        {tie.round_name || tie.stage || 'FIXTURE'}
                      </span>
                      {(() => {
                        const court = tieMatches.find((m: any) => m.court_number)?.court_number || tie.court_number;
                        if (!court) return null;
                        return (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                            <MapPin className="w-3 h-3 text-primary" />
                            {court.toUpperCase().startsWith('COURT') || court.toUpperCase().startsWith('C') ? court : `Court ${court}`}
                          </span>
                        );
                      })()}
                      {isLive ? (
                        <StatusChip state="live" label="LIVE ON COURT" />
                      ) : isBothLocked && tie.state !== 'COMPLETED' ? (
                        <StatusChip state="pending" label="Awaiting Reveal" />
                      ) : tie.state === 'COMPLETED' ? (
                        <StatusChip state="completed" />
                      ) : isScheduled ? (
                        <StatusChip state="scheduled" />
                      ) : (
                        <StatusChip state="archived" label="UNSCHEDULED" />
                      )}
                    </div>

                  {/* Actions for Officials & Viewers */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveVisualTie(tie)}
                      className="rounded-xl font-bold text-xs h-8 flex items-center gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <Swords className="w-3.5 h-3.5 text-primary" /> Visual Lineup
                    </Button>

                    {isUserOfficial && (
                      <Button
                        size="sm"
                        onClick={() => setActiveConsoleTie(tie)}
                        className="rounded-xl font-bold text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white flex items-center gap-1.5 shadow-xs"
                      >
                        <Tv2 className="w-3.5 h-3.5 text-primary" /> Official Console
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedTieId(expandedTieId === tie.id ? null : tie.id)}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Lineup Status Alert & Action Row */}
                {(tie.state !== 'COMPLETED' || canSubmitLineup) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col items-center justify-center gap-2 text-center">
                    {/* Lineup Status Badge */}
                    <div className="flex items-center justify-center gap-2">
                      {tie.state === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Tie Completed
                        </span>
                      ) : tieMatches.length > 0 && tieMatches.some((m: any) => m.revealed_at || (m.player1_id && m.player2_id)) ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Official Lineup Revealed
                        </span>
                      ) : !tie.lineup_locked_a && !tie.lineup_locked_b ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200/80 dark:border-sky-800/60 shadow-2xs">
                          <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" /> Both teams yet to submit lineup
                        </span>
                      ) : !tie.lineup_locked_a ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200/80 dark:border-sky-800/60 shadow-2xs">
                          <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" /> {tie.team_a?.short_name || tie.team_a?.name || "Team A"} yet to submit lineup
                        </span>
                      ) : !tie.lineup_locked_b ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-200/80 dark:border-sky-800/60 shadow-2xs">
                          <Clock className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" /> {tie.team_b?.short_name || tie.team_b?.name || "Team B"} yet to submit lineup
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Both lineups locked
                        </span>
                      )}
                    </div>

                    {/* Combined Action Row: Captain Submit + Official Override on same line */}
                    <div className="w-full flex flex-wrap items-center justify-center gap-2">
                      {/* Captain Submit Lineup Button */}
                      {canSubmitLineup && tie.state !== 'COMPLETED' && (
                        <Button
                          size="sm"
                          onClick={() => setActiveCaptainLineupTie({
                            tie,
                            team: userTeamData?.team,
                            side: mySide,
                            members: userTeamData?.members || []
                          })}
                          className={`rounded-xl font-black text-xs h-7.5 px-3 flex items-center gap-1.5 shadow-xs cursor-pointer ${
                            isMySideLocked
                              ? "bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                              : "bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse"
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {isMySideLocked ? "View My Lineup" : "Submit Lineup & Order"}
                        </Button>
                      )}

                      {/* Official override: enter/lock a lineup for an absent captain */}
                      {isUserOfficial && tie.state !== 'COMPLETED' && !isBothLocked && (
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-0.5">On behalf:</span>
                          {(['A', 'B'] as const).map((s) => {
                            const locked = s === 'A' ? tie.lineup_locked_a : tie.lineup_locked_b;
                            // Skip the side the current user already handles as its captain.
                            if (locked || (canSubmitLineup && s === mySide)) return null;
                            const t = s === 'A' ? tie.team_a : tie.team_b;
                            return (
                              <Button
                                key={s}
                                size="sm"
                                variant="outline"
                                disabled={overrideLoading === `${tie.id}-${s}`}
                                onClick={() => openOverrideLineup(tie, s)}
                                className="rounded-lg font-bold text-[11px] h-7 px-2.5 flex items-center gap-1.5 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              >
                                {overrideLoading === `${tie.id}-${s}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                                Enter {t?.short_name || t?.name || `Side ${s}`}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Teams Scoreboard — Team A name·logo  |  score  |  logo·name Team B */}
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-3">
                  {/* Team A — name then logo (logo sits beside the score) */}
                  <div
                    onClick={() => {
                      const tData = {
                        id: tie.team_a?.id || tie.team_a_id,
                        name: tie.team_a?.name || "Team A",
                        short_name: tie.team_a?.short_name,
                        logo_url: tie.team_a?.logo_url,
                        tournament_id: tournamentId,
                      };
                      if (tData.id) openTeamModal(tData, 'roster');
                    }}
                    className="flex items-center justify-end gap-2 sm:gap-2.5 min-w-0 text-right cursor-pointer group p-1 sm:p-1.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 active:scale-[0.99] transition border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/80"
                    title="Click to view Team A roster and matches"
                    role="button"
                    tabIndex={0}
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="font-black text-xs sm:text-base text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors truncate">
                        {tie.team_a?.name || "Team A"}
                      </h3>
                      <span className="block text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                        {tie.team_a?.short_name || "Side A"}
                      </span>
                    </div>
                    <TeamLogo
                      name={tie.team_a?.name || "Team A"}
                      shortName={tie.team_a?.short_name}
                      logoUrl={tie.team_a?.logo_url}
                      size="md"
                    />
                  </div>

                  {/* Score — tap to open rubber-by-rubber breakdown */}
                  <button
                    type="button"
                    onClick={() => setScoreDetailTie(tie)}
                    title="Tap for rubber-by-rubber scores"
                    className="px-2.5 sm:px-4 py-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center shrink-0 shadow-xs min-w-[56px] sm:min-w-[68px] cursor-pointer hover:border-primary/50 hover:shadow-sm active:scale-[0.97] transition"
                  >
                    <span className="flex items-center justify-center gap-1.5 sm:gap-2.5">
                      <span className="font-mono text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {tie.score_team_a ?? 0}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700 font-bold leading-none">-</span>
                      <span className="font-mono text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
                        {tie.score_team_b ?? 0}
                      </span>
                    </span>
                    <span className="mt-0.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-primary/80 leading-none">
                      Tap for ties
                    </span>
                  </button>

                  {/* Team B — logo then name (logo sits beside the score) */}
                  <div
                    onClick={() => {
                      const tData = {
                        id: tie.team_b?.id || tie.team_b_id,
                        name: tie.team_b?.name || "Team B",
                        short_name: tie.team_b?.short_name,
                        logo_url: tie.team_b?.logo_url,
                        tournament_id: tournamentId,
                      };
                      if (tData.id) openTeamModal(tData, 'roster');
                    }}
                    className="flex items-center gap-2 sm:gap-2.5 min-w-0 cursor-pointer group p-1 sm:p-1.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 active:scale-[0.99] transition border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700/80"
                    title="Click to view Team B roster and matches"
                    role="button"
                    tabIndex={0}
                  >
                    <TeamLogo
                      name={tie.team_b?.name || "Team B"}
                      shortName={tie.team_b?.short_name}
                      logoUrl={tie.team_b?.logo_url}
                      size="md"
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <h3 className="font-black text-xs sm:text-base text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors truncate">
                        {tie.team_b?.name || "Team B"}
                      </h3>
                      <span className="block text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                        {tie.team_b?.short_name || "Side B"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scheduled Date, Day, Time & Court bar (Same row) */}
                <div className="px-3.5 sm:px-5 py-2 bg-slate-100/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {tie.scheduled_at ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>
                          {new Date(tie.scheduled_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-slate-400 font-normal">•</span>
                        <span>
                          {new Date(tie.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Date & Time not set
                      </span>
                    )}

                    {(() => {
                      const court = tieMatches.find((m: any) => m.court_number)?.court_number || tie.court_number;
                      if (court) {
                        return (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            {court.toUpperCase().startsWith('COURT') || court.toUpperCase().startsWith('C') ? court : `Court ${court}`}
                          </span>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                          <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                          Court not assigned
                        </span>
                      );
                    })()}
                  </div>

                  <div className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                    {tieMatches.length} rubbers scheduled
                  </div>
                </div>
              </div>

              {/* Rubbers List in Official Playing Order */}
              {isExpanded && (
                <div className="p-4 sm:p-5 space-y-3 bg-white dark:bg-slate-900">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Rubbers (Ordered by Official Match Playing Sequence)</span>
                    <span>{tieMatches.length} Matches</span>
                  </div>

                  <div className="space-y-3">
                    {tieMatches.map((rubber: any, index: number) => {
                      const isRevealed = !!rubber.revealed_at || (!!rubber.player1_id && !!rubber.player2_id);
                      const isDoubles = rubber.category?.includes('D') || rubber.category?.includes('Doubles');
                      const playingSeq = rubber.playing_order || index + 1;

                      // Check for emergency substitution audits for this rubber
                      const rubberSubAudits = tieAudits.filter((a: any) => 
                        a.action_type === 'PLAYER_SUBSTITUTED' && a.rubber_order === rubber.rubber_order
                      );

                      return (
                        <div 
                          key={rubber.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isRevealed 
                              ? 'bg-slate-50/50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-800'
                              : 'bg-slate-50/30 dark:bg-slate-800/10 border-dashed border-slate-200 dark:border-slate-800 opacity-90'
                          }`}
                        >
                          {/* Rubber Header */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-mono font-black text-xs flex items-center justify-center">
                                #{playingSeq}
                              </span>
                              <span className="font-black text-xs text-slate-800 dark:text-slate-200">
                                {rubber.rubber_label || rubber.match_code}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                {rubber.category}
                              </span>
                              {rubber.is_decider_tiebreaker && (
                                <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                  Golden Decider
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {rubber.status === 'in_progress' ? (
                                <StatusChip state="live" compact />
                              ) : rubber.status === 'completed' ? (
                                <StatusChip state="completed" compact />
                              ) : (
                                <StatusChip state="scheduled" compact />
                              )}
                            </div>
                          </div>

                          {/* Head-to-Head Lineup Display */}
                          {isRevealed ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
                              {/* Side A Lineup */}
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                <div>
                                  <div>{rubber.player1?.full_name || rubber.player1?.display_name || "TBD"}</div>
                                  {isDoubles && rubber.player3 && (
                                    <div className="text-slate-500">{rubber.player3?.full_name || rubber.player3?.display_name}</div>
                                  )}
                                </div>
                              </div>

                              {/* Side B Lineup */}
                              <div className="flex items-center justify-end sm:justify-start gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                <div>
                                  <div>{rubber.player2?.full_name || rubber.player2?.display_name || "TBD"}</div>
                                  {isDoubles && rubber.player4 && (
                                    <div className="text-slate-500">{rubber.player4?.full_name || rubber.player4?.display_name}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-2.5 px-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 text-xs text-slate-400 font-medium flex items-center justify-center gap-2">
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Secret Lineup · Awaiting official reveal by referee/organizer</span>
                            </div>
                          )}

                          {/* Score if available */}
                          {rubber.score && (
                            <div className="mt-1.5 text-center text-xs font-mono font-black text-primary">
                              {rubber.score}
                            </div>
                          )}

                          {/* Reveal Metadata */}
                          {isRevealed && (rubber.revealer?.full_name || rubber.revealed_at) && (
                            <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>
                                Revealed by Official <strong className="text-slate-600 dark:text-slate-300">{rubber.revealer?.full_name || "Match Official"}</strong>
                                {rubber.revealed_at && ` at ${format(new Date(rubber.revealed_at), 'hh:mm a, MMM d')}`}
                              </span>
                            </div>
                          )}

                          {/* Emergency Substitution Notices */}
                          {rubberSubAudits.map((sub: any) => (
                            <div 
                              key={sub.id} 
                              className="mt-2 p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div className="leading-tight">
                                <strong>Emergency Substitution:</strong> {sub.orig_player?.full_name || "Original Player"} was replaced by <strong className="text-amber-700 dark:text-amber-300">{sub.repl_player?.full_name || "Substitute"}</strong>.
                                <div className="text-[10px] opacity-80 mt-0.5">
                                  ✓ Both captains agreed · Authorized by {sub.referee?.full_name || "Match Official"}{sub.reason ? ` (${sub.reason})` : ""}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
      </div>

      {/* Rubber-by-rubber Score Breakdown Popup */}
      {scoreDetailTie && (() => {
        const tie = scoreDetailTie;
        const rubbers = allRubberMatches
          .filter((m: any) => m.tie_id === tie.id)
          .sort((a: any, b: any) => {
            const orderA = a.playing_order ?? a.rubber_order ?? 99;
            const orderB = b.playing_order ?? b.rubber_order ?? 99;
            return orderA - orderB;
          });
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in overflow-hidden">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[88vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
              {/* Header with team names / logos / aggregate score */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded-lg bg-primary text-primary-foreground">
                    {tie.tie_code}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScoreDetailTie(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="flex items-center justify-end gap-2 min-w-0 text-right">
                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">{tie.team_a?.name || "Team A"}</span>
                    <TeamLogo name={tie.team_a?.name || "Team A"} shortName={tie.team_a?.short_name} logoUrl={tie.team_a?.logo_url} size="sm" />
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-lg font-black text-slate-900 dark:text-white leading-none">{tie.score_team_a ?? 0}</span>
                    <span className="text-slate-400 font-bold leading-none">-</span>
                    <span className="font-mono text-lg font-black text-slate-900 dark:text-white leading-none">{tie.score_team_b ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogo name={tie.team_b?.name || "Team B"} shortName={tie.team_b?.short_name} logoUrl={tie.team_b?.logo_url} size="sm" />
                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">{tie.team_b?.name || "Team B"}</span>
                  </div>
                </div>
              </div>

              {/* Rubbers list */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Individual Rubbers ({rubbers.length})
                </div>
                {rubbers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">No rubbers scheduled yet.</div>
                ) : (
                  rubbers.map((rubber: any, index: number) => {
                    const isRevealed = !!rubber.revealed_at || (!!rubber.player1_id && !!rubber.player2_id);
                    const isDoubles = rubber.category?.includes('D') || rubber.category?.includes('Doubles');
                    const playingSeq = rubber.playing_order || index + 1;
                    const sideAName = isRevealed
                      ? [rubber.player1?.full_name, isDoubles ? rubber.player3?.full_name : null].filter(Boolean).join(' / ') || "TBD"
                      : "Hidden";
                    const sideBName = isRevealed
                      ? [rubber.player2?.full_name, isDoubles ? rubber.player4?.full_name : null].filter(Boolean).join(' / ') || "TBD"
                      : "Hidden";
                    return (
                      <div key={rubber.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-primary/10 text-primary font-mono font-black text-[10px] flex items-center justify-center shrink-0">#{playingSeq}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">{rubber.category}</span>
                          </div>
                          {rubber.status === 'in_progress' ? (
                            <StatusChip state="live" compact />
                          ) : rubber.status === 'completed' ? (
                            <StatusChip state="completed" compact />
                          ) : (
                            <StatusChip state="scheduled" compact />
                          )}
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                          <span className={`text-right font-bold truncate ${isRevealed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'}`}>{sideAName}</span>
                          <span className="font-mono font-black text-primary whitespace-nowrap px-1.5">{rubber.score || 'vs'}</span>
                          <span className={`text-left font-bold truncate ${isRevealed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'}`}>{sideBName}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer: open full details */}
              <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <Button
                  onClick={() => { setActiveVisualTie(tie); setScoreDetailTie(null); }}
                  className="w-full rounded-xl font-black text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" /> Open Full Tie Details
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Official Console Modal */}
      {activeConsoleTie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-6 my-auto overflow-hidden">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <span className="text-xs font-black uppercase text-slate-400">Match Official Desk</span>
              <button
                type="button"
                onClick={() => setActiveConsoleTie(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 min-h-0 pt-3 pr-1">
              <TieUmpireConsole
                tie={activeConsoleTie}
                tournament={tournament}
                onClose={() => setActiveConsoleTie(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Visual Lineup Modal */}
      {activeVisualTie && (() => {
        const isMyTeamA = userTeamData?.team?.id === activeVisualTie.team_a_id;
        const isMyTeamB = userTeamData?.team?.id === activeVisualTie.team_b_id;
        const captainSide = (userTeamData?.isCaptain && (isMyTeamA || isMyTeamB))
          ? (isMyTeamA ? ('A' as const) : ('B' as const))
          : null;

        return (
          <TieVisualLineupModal
            isOpen={!!activeVisualTie}
            onClose={() => setActiveVisualTie(null)}
            tie={activeVisualTie}
            tournament={tournament}
            viewerIsCaptainOf={captainSide}
            viewerIsOfficial={isUserOfficial}
            onSubmitLineup={(side) => {
              setActiveVisualTie(null);
              setActiveCaptainLineupTie({
                tie: activeVisualTie,
                team: userTeamData?.team,
                side,
                members: userTeamData?.members || [],
              });
            }}
            onEnterOnBehalf={(side) => {
              setActiveVisualTie(null);
              openOverrideLineup(activeVisualTie, side);
            }}
          />
        );
      })()}

      {/* Captain Lineup Builder Modal */}
      {activeCaptainLineupTie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                {activeCaptainLineupTie.onBehalf ? <ShieldCheck className="w-5 h-5 text-amber-500" /> : <Crown className="w-5 h-5 text-amber-500" />}
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    Submit Team Lineup &amp; Playing Order · {activeCaptainLineupTie.tie.tie_code}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold">
                    {activeCaptainLineupTie.team?.name} (Side {activeCaptainLineupTie.side})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCaptainLineupTie(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {activeCaptainLineupTie.onBehalf && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                  <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                    Official override — you're entering and locking this lineup on behalf of {activeCaptainLineupTie.team?.name || "the team"}. This action is recorded.
                  </p>
                </div>
              )}
              <TeamLineupBuilder
                tie={activeCaptainLineupTie.tie}
                team={activeCaptainLineupTie.team}
                members={activeCaptainLineupTie.members}
                isCaptain={true}
                side={activeCaptainLineupTie.side}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
