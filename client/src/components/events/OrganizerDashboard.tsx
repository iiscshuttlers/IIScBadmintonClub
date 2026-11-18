import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  fetchAllTournamentMatchRows,
  fetchConfirmedRegistrations,
  fetchTournamentMatchesByNumber,
} from '@/services/tournamentService';
import { teamService } from '@/services/teamService';
import { CheckCircle2, ChevronRight, RefreshCw, X } from 'lucide-react';
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
  const isTeamEvent = tournament?.format_family === 'TEAM';

  if (!isTeamEvent) {
    return <IndividualEventDashboard tournamentId={tournamentId} tournament={tournament} />;
  }

  return <TeamEventDashboard tournamentId={tournamentId} tournament={tournament} />;
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3" → "Court 3"; a named court ("Centre") is shown as is. */
const courtLabel = (court: any) => (/^\d+$/.test(String(court)) ? `Court ${court}` : String(court));

/** Plain label for a match status or tie state: in_progress / IN_PROGRESS → "Live". */
function statusLabel(status?: string | null): string {
  const s = (status || 'scheduled').toLowerCase();
  if (s === 'in_progress') return 'Live';
  if (s === 'completed') return 'Done';
  const text = s.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function StatusText({ status }: { status?: string | null }) {
  const isLive = (status || '').toLowerCase() === 'in_progress';
  return (
    <span className={`text-xs font-semibold whitespace-nowrap ${isLive ? 'text-emerald-400' : 'text-muted-foreground'}`}>
      {statusLabel(status)}
    </span>
  );
}

const sectionClass = 'rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:p-4 space-y-3';
const codeClass = 'shrink-0 max-w-[5.5rem] truncate font-mono text-[11px] font-bold text-primary';

interface HeaderStat {
  value: number;
  label: string;
}

/** Tournament name, one progress bar and up to three inline numbers. */
function DashboardHeader({
  title,
  tournamentId,
  onRefresh,
  done,
  total,
  percent,
  unit,
  stats,
}: {
  title: string;
  tournamentId: string;
  onRefresh: () => void;
  done: number;
  total: number;
  percent: number;
  unit: string;
  stats: HeaderStat[];
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-black text-white">{title}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="h-8 w-8 p-0 rounded-xl border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Link
            href={`/tournament-admin?id=${tournamentId}`}
            className="inline-flex h-8 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition whitespace-nowrap"
          >
            Tournament Manager <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`${percent}% of ${unit} done`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <strong className="font-bold text-white">{done}/{total}</strong> {unit} done · {percent}%
          </span>
          {stats.map((s) => (
            <span key={s.label}>
              <strong className="font-bold text-white">{s.value}</strong> {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type Tone = 'amber' | 'sky' | 'emerald' | 'slate';

const TONE: Record<Tone, { idle: string; active: string; count: string }> = {
  amber: {
    idle: 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/60',
    active: 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50',
    count: 'text-amber-300',
  },
  sky: {
    idle: 'border-sky-500/30 bg-sky-500/5 hover:border-sky-400/60',
    active: 'border-sky-400 bg-sky-500/10 ring-2 ring-sky-400/50',
    count: 'text-sky-300',
  },
  emerald: {
    idle: 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-400/60',
    active: 'border-emerald-400 bg-emerald-500/10 ring-2 ring-emerald-400/50',
    count: 'text-emerald-300',
  },
  slate: {
    idle: 'border-slate-800 bg-slate-900 hover:border-slate-700',
    active: 'border-slate-500 bg-slate-800 ring-2 ring-slate-500/50',
    count: 'text-white',
  },
};

interface AttentionItem<K extends string> {
  key: K;
  count: number;
  label: string;
  hint?: string;
  tone: Tone;
}

/**
 * Only the items with something in them are shown. When nothing is pending,
 * a single "All clear" row replaces the grid of zeros.
 */
function AttentionCards<K extends string>({
  items,
  selected,
  onSelect,
  loading,
}: {
  items: AttentionItem<K>[];
  selected: string;
  onSelect: (key: K) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-muted-foreground">
        Checking what needs attention…
      </div>
    );
  }

  const pending = items.filter((item) => item.count > 0);

  if (pending.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        <span className="font-semibold text-white">All clear</span>
        <span className="text-muted-foreground">— nothing needs you right now</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {pending.map((item) => {
        const tone = TONE[item.tone];
        const isSelected = selected === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-pressed={isSelected}
            className={`group rounded-2xl border p-3 text-left transition ${isSelected ? tone.active : tone.idle}`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-2xl font-black leading-none ${tone.count}`}>{item.count}</span>
              <ChevronRight className="w-4 h-4 text-slate-500 transition-colors group-hover:text-white" />
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-tight text-white">{item.label}</p>
            {item.hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.hint}</p>}
          </button>
        );
      })}
    </div>
  );
}

/** A section title that opens and closes its content: "Team rosters · 6/8 ready ▸". */
function DisclosureRow({
  open,
  onToggle,
  label,
  meta,
  action,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <span className="shrink-0 text-sm font-bold text-white">{label}</span>
        {meta && <span className="truncate text-xs text-muted-foreground">· {meta}</span>}
        <ChevronRight
          className={`ml-auto w-4 h-4 shrink-0 text-muted-foreground transition-transform group-hover:text-white ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {action}
    </div>
  );
}

function ShowAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-xs font-bold text-primary hover:underline">
      Show all
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Individual events                                                   */
/* ------------------------------------------------------------------ */

const MATCH_FILTER_LABEL = {
  ALL: 'All',
  IN_PROGRESS: 'Live',
  UNASSIGNED_COURTS: 'No court',
  SCHEDULED: 'Upcoming',
} as const;

function IndividualEventDashboard({ tournamentId, tournament }: OrganizerDashboardProps) {
  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ['organizer_ind_matches', tournamentId],
    queryFn: async () => {
      const data = await fetchTournamentMatchesByNumber(tournamentId);
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ['organizer_ind_registrations', tournamentId],
    queryFn: async () => {
      const data = await fetchConfirmedRegistrations(tournamentId);
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
    refetchInterval: 30000
  });

  const completedMatches = matches.filter((m: any) => m.status === 'completed');
  const inProgressMatches = matches.filter((m: any) => m.status === 'in_progress');
  const matchesMissingCourt = matches.filter((m: any) => {
    const court = m.court ?? m.court_number;
    return !court && m.status !== 'completed';
  });
  const scheduledMatches = matches.filter((m: any) => m.status === 'scheduled' || !m.status);
  const completionRate = matches.length > 0 ? Math.round((completedMatches.length / matches.length) * 100) : 0;

  const categories = useMemo(() => {
    const cats = new Set<string>();
    matches.forEach((m: any) => { if (m.category) cats.add(m.category); });
    return Array.from(cats).sort();
  }, [matches]);

  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'IN_PROGRESS' | 'UNASSIGNED_COURTS' | 'SCHEDULED'>('ALL');
  // null = follow the default below; true/false = the organizer opened/closed it.
  const [listOpenChoice, setListOpenChoice] = useState<boolean | null>(null);

  const filteredMatches = useMemo(() => {
    if (selectedFilter === 'IN_PROGRESS') return inProgressMatches;
    if (selectedFilter === 'UNASSIGNED_COURTS') return matchesMissingCourt;
    if (selectedFilter === 'SCHEDULED') return scheduledMatches;
    return matches;
  }, [selectedFilter, matches, inProgressMatches, matchesMissingCourt, scheduledMatches]);

  // A long list with nothing wrong in it starts collapsed.
  const listOpen = listOpenChoice ?? (
    matchesMissingCourt.length > 0 || matches.length <= 6 || selectedFilter !== 'ALL'
  );

  const handleCardClick = (filter: typeof selectedFilter) => {
    setSelectedFilter(prev => prev === filter ? 'ALL' : filter);
    setListOpenChoice(true);
  };

  return (
    <div className="space-y-4">
      <DashboardHeader
        title={tournament?.name || 'Organizer view'}
        tournamentId={tournamentId}
        onRefresh={() => refetch()}
        done={completedMatches.length}
        total={matches.length}
        percent={completionRate}
        unit="matches"
        stats={[
          { value: registrations.length, label: registrations.length === 1 ? 'participant' : 'participants' },
          { value: categories.length, label: categories.length === 1 ? 'category' : 'categories' },
        ]}
      />

      <AttentionCards
        loading={isLoading}
        selected={selectedFilter}
        onSelect={handleCardClick}
        items={[
          { key: 'IN_PROGRESS', count: inProgressMatches.length, label: 'Live matches', tone: 'emerald' },
          { key: 'UNASSIGNED_COURTS', count: matchesMissingCourt.length, label: 'Without a court', hint: 'Assign before play', tone: 'sky' },
          { key: 'SCHEDULED', count: scheduledMatches.length, label: 'Still to play', tone: 'slate' },
        ]}
      />

      <section className={sectionClass}>
        <DisclosureRow
          open={listOpen}
          onToggle={() => setListOpenChoice(!listOpen)}
          label={selectedFilter === 'ALL' ? 'Matches' : `Matches · ${MATCH_FILTER_LABEL[selectedFilter]}`}
          meta={selectedFilter === 'ALL' ? `${matches.length}` : `${filteredMatches.length} of ${matches.length}`}
          action={selectedFilter !== 'ALL' && <ShowAllButton onClick={() => setSelectedFilter('ALL')} />}
        />

        {listOpen && (
          <>
            {categories.length > 0 && (
              <p className="text-xs text-muted-foreground">Categories: {categories.join(', ')}</p>
            )}

            {filteredMatches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {selectedFilter === 'ALL' ? 'No matches yet.' : 'No matches in this view.'}
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-800">
                  {filteredMatches.slice(0, 20).map((match: any) => {
                    const court = match.court ?? match.court_number;
                    const detail = [match.category, match.round_name].filter(Boolean).join(' · ');
                    return (
                      <li key={match.id} className="flex items-center gap-3 py-2">
                        <span className={codeClass}>
                          {match.match_code || `M${match.match_number || '?'}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {match.team1_label || 'TBD'} vs {match.team2_label || 'TBD'}
                          </p>
                          {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                          <span className="flex items-center gap-1.5">
                            {match.score && (
                              <span className="font-mono font-bold text-white whitespace-nowrap">{match.score}</span>
                            )}
                            <StatusText status={match.status} />
                          </span>
                          {court ? (
                            <span className="text-muted-foreground whitespace-nowrap">{courtLabel(court)}</span>
                          ) : match.status !== 'completed' ? (
                            <span className="font-semibold text-sky-300 whitespace-nowrap">No court</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {filteredMatches.length > 20 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Showing 20 of {filteredMatches.length} matches
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Team events                                                         */
/* ------------------------------------------------------------------ */

type Bottleneck = 'MISSING_LINEUPS' | 'AWAITING_REVEAL' | 'LIVE_TIES' | 'UNASSIGNED_COURTS';

const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  MISSING_LINEUPS: 'Missing lineups',
  AWAITING_REVEAL: 'Ready to reveal',
  LIVE_TIES: 'Live',
  UNASSIGNED_COURTS: 'No court',
};

function TeamEventDashboard({ tournamentId, tournament }: OrganizerDashboardProps) {
  const { openTeamModal } = useTeamModal();
  const { user, profile } = useAuth();
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<any | null>(null);
  // null = follow the default (open only while some team isn't ready); true/false = organizer's choice.
  const [rosterOpenChoice, setRosterOpenChoice] = useState<boolean | null>(null);

  // Current logged in user ID / player ID
  const currentUserId = user?.id;
  const currentPlayerId = profile?.id;

  // 1. Fetch ties
  const { data: ties = [], isLoading: tiesLoading, refetch: refetchTies } = useQuery({
    queryKey: ['organizer_ties', tournamentId],
    queryFn: async () => {
      const data = await teamService.getOrganizerTies(tournamentId);
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // 2. Fetch matches (for schedule/court inspection)
  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ['organizer_matches', tournamentId],
    queryFn: async () => {
      const data = await fetchAllTournamentMatchRows(tournamentId);
      return (data || []) as any[];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // 3. Fetch teams and member counts
  const { data: rawTeams = [], refetch: refetchTeams } = useQuery({
    queryKey: ['organizer_teams', tournamentId],
    queryFn: async () => {
      // 1. Fetch valid teams
      const { data: teamsData, error: teamsError } = await teamService.getOrganizerTeams(tournamentId);

      if (teamsError) {
        console.error('Error fetching organizer teams:', teamsError);
        throw teamsError;
      }

      const teamList = (teamsData || []) as any[];
      if (teamList.length === 0) return [];

      // 2. Fetch members with joined player info
      const { data: rawMembers, error: membersError } = await teamService.getActiveMembersWithPlayer(tournamentId);

      let memberList: any[] = [];
      if (membersError) {
        // Fallback with explicit FK constraint name
        const fallback = await teamService.getActiveMembersWithPlayerFk(tournamentId);

        if (!fallback.error && fallback.data) {
          memberList = fallback.data.map((m: any) => ({
            ...m,
            player: m.players || m.player
          }));
        } else {
          // If relationship join completely fails, fetch members without join
          const bareMembers = await teamService.getActiveMembersBare(tournamentId);
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
  const [selectedBottleneck, setSelectedBottleneck] = useState<'ALL' | Bottleneck>('ALL');
  const [showBottleneckModal, setShowBottleneckModal] = useState<boolean>(false);
  const [courtSubTab, setCourtSubTab] = useState<'ties' | 'rubbers'>('rubbers');

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

  const handleCardClick = (type: Bottleneck) => {
    setSelectedBottleneck(prev => prev === type ? 'ALL' : type);
    setShowBottleneckModal(true);
    if (type === 'UNASSIGNED_COURTS') {
      setCourtSubTab(matchesMissingCourt.length > 0 ? 'rubbers' : 'ties');
    }
  };

  // Minimum roster is the same for every team: it comes from the tie format and the repeat rules.
  const rosterRequirement = useMemo(() => {
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
    return { dynReq, minRequired };
  }, [rawFormat, tournament]);

  const rosterRows = useMemo(() => {
    const { dynReq, minRequired } = rosterRequirement;
    return teams.map((t: any) => {
      const activeCount = t.members?.filter((m: any) => m.status === 'ACTIVE').length || 0;
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
      const isFullyReady = isReady && maleDeficit === 0 && femaleDeficit === 0;
      const neededCount = Math.max(0, minRequired - activeCount);

      // Check if current logged-in user belongs to this team
      const isMyTeam = !!((t.captain_id && (t.captain_id === currentUserId || t.captain_id === currentPlayerId)) ||
        t.members?.some((m: any) => m.user_id === currentUserId || m.player_id === currentPlayerId));

      const note = femaleDeficit > 0
        ? { text: `Needs ${plural(femaleDeficit, 'woman', 'women')}`, className: 'text-amber-400' }
        : maleDeficit > 0
          ? { text: `Needs ${plural(maleDeficit, 'man', 'men')}`, className: 'text-sky-400' }
          : !isReady
            ? { text: `${neededCount} more needed`, className: 'text-amber-400' }
            : { text: 'Ready', className: 'text-emerald-400' };

      return { team: t, activeCount, minRequired, isReady, isFullyReady, pct, activeMales, activeFemales, isMyTeam, note };
    });
  }, [teams, rosterRequirement, currentUserId, currentPlayerId]);

  const readyTeamCount = rosterRows.filter((r) => r.isFullyReady).length;
  const rosterOpen = rosterOpenChoice ?? readyTeamCount < rosterRows.length;

  const openRoster = (t: any) => openTeamModal({
    id: t.id,
    name: t.name,
    short_name: t.short_name,
    pool: t.pool,
    captain_id: t.captain_id,
    tournament_id: tournamentId,
    logo_url: t.logo_url
  }, 'roster');

  const modalHeading: Record<Bottleneck, { title: string; text: string }> = {
    MISSING_LINEUPS: {
      title: `Missing lineups (${tiesWithMissingLineups.length})`,
      text: `${plural(missingLineupsStats.totalMissingTeams, 'team')} still to lock a lineup.`,
    },
    AWAITING_REVEAL: {
      title: `Ready to reveal (${tiesAwaitingReveal.length})`,
      text: 'Both lineups are locked. Open a tie to reveal them.',
    },
    LIVE_TIES: {
      title: `Live ties (${liveTiesInProgress.length})`,
      text: 'Open a tie to follow its rubbers and enter scores.',
    },
    UNASSIGNED_COURTS: {
      title: `No court yet (${unassignedCourtsStats.primaryCount} ${unassignedCourtsStats.primaryUnit.toLowerCase()})`,
      text: 'Assign a court before play can start.',
    },
  };

  const subTabClass = (active: boolean) =>
    `rounded-lg px-2.5 py-1 font-bold transition ${
      active ? 'bg-primary text-primary-foreground' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    }`;

  return (
    <div className="space-y-4">
      <DashboardHeader
        title={tournament?.name || 'Organizer view'}
        tournamentId={tournamentId}
        onRefresh={handleRefreshAll}
        done={completedMatchesCount}
        total={totalExpectedRubbers}
        percent={matchCompletionRate}
        unit="rubbers"
        stats={[
          { value: ties.length, label: ties.length === 1 ? 'tie' : 'ties' },
          { value: effectiveTotalTeams, label: effectiveTotalTeams === 1 ? 'team' : 'teams' },
        ]}
      />

      <AttentionCards
        loading={tiesLoading || matchesLoading}
        selected={selectedBottleneck}
        onSelect={handleCardClick}
        items={[
          {
            key: 'MISSING_LINEUPS',
            count: tiesWithMissingLineups.length,
            label: 'Ties missing a lineup',
            hint: `${plural(missingLineupsStats.totalMissingTeams, 'team')} yet to lock`,
            tone: 'amber',
          },
          {
            key: 'AWAITING_REVEAL',
            count: tiesAwaitingReveal.length,
            label: 'Ready to reveal',
            hint: 'Both lineups locked',
            tone: 'amber',
          },
          {
            key: 'LIVE_TIES',
            count: liveTiesInProgress.length,
            label: 'Live ties',
            tone: 'emerald',
          },
          {
            key: 'UNASSIGNED_COURTS',
            count: unassignedCourtsStats.primaryCount,
            label: `${unassignedCourtsStats.primaryUnit} without a court`,
            hint: matchesMissingCourt.length > 0 && tiesMissingCourt.length > 0
              ? `${plural(tiesMissingCourt.length, 'tie')} without one too`
              : undefined,
            tone: 'sky',
          },
        ]}
      />

      {/* Ties */}
      <section className={sectionClass}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="min-w-0 truncate text-sm font-bold text-white">
            {selectedBottleneck === 'ALL' ? 'Ties' : `Ties · ${BOTTLENECK_LABEL[selectedBottleneck]}`}
            <span className="ml-1.5 text-xs font-medium text-muted-foreground">
              · {selectedBottleneck === 'ALL' ? ties.length : `${displayedTies.length} of ${ties.length}`}
            </span>
          </h3>
          {selectedBottleneck !== 'ALL' && <ShowAllButton onClick={() => setSelectedBottleneck('ALL')} />}
        </div>

        {displayedTies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {selectedBottleneck === 'ALL' ? 'No ties yet.' : 'No ties in this view.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {displayedTies.map((tie: any) => {
              const pending = [
                !tie.lineup_locked_a && (tie.team_a?.short_name || 'Team A'),
                !tie.lineup_locked_b && (tie.team_b?.short_name || 'Team B'),
              ].filter(Boolean) as string[];
              const lineup = pending.length > 0
                ? {
                    text: `${pending.length > 1 ? 'Lineups' : 'Lineup'} pending: ${pending.join(', ')}${tie.lineup_revealed ? ' · revealed' : ''}`,
                    className: 'text-amber-300',
                  }
                : tie.lineup_revealed
                  ? { text: 'Lineups revealed', className: 'text-muted-foreground' }
                  : tie.state === 'COMPLETED'
                    ? { text: 'Lineups locked · not revealed', className: 'text-muted-foreground' }
                    : { text: 'Locked · ready to reveal', className: 'text-amber-300' };

              return (
                <li key={tie.id} className="flex items-center gap-3 py-2.5">
                  <span className={codeClass} title={tie.tie_code}>{tie.tie_code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {tie.team_a?.name || 'TBD'} vs {tie.team_b?.name || 'TBD'}
                    </p>
                    <p className={`truncate text-xs ${lineup.className}`}>{lineup.text}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTieForConsole(tie)}
                    className="h-8 shrink-0 rounded-xl border-slate-700 bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white"
                  >
                    Manage
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Team rosters (collapsed once every team is ready) */}
      <section className={sectionClass}>
        <DisclosureRow
          open={rosterOpen}
          onToggle={() => setRosterOpenChoice(!rosterOpen)}
          label="Team rosters"
          meta={rosterRows.length > 0 ? `${readyTeamCount}/${rosterRows.length} ready` : 'no teams yet'}
        />

        {rosterOpen && (
          rosterRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rosterRows.map((r) => {
                const t = r.team;
                const tag = [r.isMyTeam && 'Your team', t.pool && `Pool ${t.pool}`].filter(Boolean).join(' · ');
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openRoster(t)}
                    className={`rounded-xl border bg-slate-950/40 p-3 text-left transition hover:bg-slate-800/60 ${
                      r.isMyTeam ? 'border-amber-400/70' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-bold text-white">
                        {t.name}
                        {t.short_name && (
                          <span className="ml-1.5 font-mono text-[11px] font-semibold text-muted-foreground">{t.short_name}</span>
                        )}
                      </p>
                      {tag && (
                        <span className={`shrink-0 text-[11px] ${r.isMyTeam ? 'text-amber-300' : 'text-muted-foreground'}`}>
                          {tag}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-300">
                        <strong className="font-bold text-white">{r.activeCount}</strong>/{r.minRequired} players
                        <span className="ml-1 text-muted-foreground">({r.activeMales}M, {r.activeFemales}F)</span>
                      </span>
                      <span className={`shrink-0 font-semibold ${r.note.className}`}>{r.note.text}</span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          r.isMyTeam ? 'bg-amber-400' : r.isReady ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
      </section>

      {/* Bottleneck drill-down */}
      {showBottleneckModal && selectedBottleneck !== 'ALL' && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setShowBottleneckModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalHeading[selectedBottleneck].title}
            className="max-w-2xl w-full max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-black text-white">{modalHeading[selectedBottleneck].title}</h3>
                <p className="text-xs text-muted-foreground">{modalHeading[selectedBottleneck].text}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBottleneckModal(false)}
                aria-label="Close"
                className="p-2 -m-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedBottleneck === 'MISSING_LINEUPS' && (
              <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground shrink-0">
                <span>Both missing: <strong className="text-rose-300">{missingLineupsStats.bothMissingCount}</strong></span>
                <span>One missing: <strong className="text-amber-300">{missingLineupsStats.oneMissingCount}</strong></span>
              </div>
            )}

            {selectedBottleneck === 'UNASSIGNED_COURTS' && (
              <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs shrink-0">
                <button type="button" onClick={() => setCourtSubTab('ties')} className={subTabClass(courtSubTab === 'ties')}>
                  Ties ({tiesMissingCourt.length})
                </button>
                <button type="button" onClick={() => setCourtSubTab('rubbers')} className={subTabClass(courtSubTab === 'rubbers')}>
                  Rubbers ({matchesMissingCourt.length})
                </button>
              </div>
            )}

            <div className="px-4 py-1 overflow-y-auto flex-1">
              {selectedBottleneck === 'UNASSIGNED_COURTS' && courtSubTab === 'rubbers' ? (
                matchesMissingCourt.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">All rubbers have a court.</p>
                ) : (
                  <ul className="divide-y divide-slate-800">
                    {matchesMissingCourt.map((match: any) => {
                      const parentTie = ties.find((t: any) => t.id === match.tie_id);
                      return (
                        <li key={match.id} className="flex items-center gap-3 py-2.5">
                          <span className={codeClass}>
                            {match.match_code || match.rubber_code || `R${match.rubber_number || match.match_number || '?'}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {match.category || match.discipline || 'Rubber'}
                            </p>
                            {parentTie && (
                              <p className="truncate text-xs text-muted-foreground">
                                {parentTie.team_a?.short_name || parentTie.team_a?.name || 'A'} vs {parentTie.team_b?.short_name || parentTie.team_b?.name || 'B'}
                              </p>
                            )}
                          </div>
                          <StatusText status={match.status} />
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : displayedTies.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nothing here right now.</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {displayedTies.map((tie: any) => {
                    const lockedA = !!tie.lineup_locked_a;
                    const lockedB = !!tie.lineup_locked_b;
                    const courtVal = tie.court || tie.court_number;
                    const showCourt = (selectedBottleneck === 'LIVE_TIES' || selectedBottleneck === 'UNASSIGNED_COURTS') && courtVal;

                    return (
                      <li key={tie.id} className="flex items-center gap-3 py-2.5">
                        <span className={codeClass} title={tie.tie_code || 'TIE'}>{tie.tie_code || 'TIE'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {tie.team_a?.name || 'Team A'} vs {tie.team_b?.name || 'Team B'}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <StatusText status={tie.state || 'SCHEDULED'} />
                            {selectedBottleneck === 'MISSING_LINEUPS' && (
                              <>
                                <span className={lockedA ? 'text-emerald-400' : 'text-amber-300'}>
                                  {tie.team_a?.short_name || tie.team_a?.name || 'Team A'}: {lockedA ? 'locked' : 'missing'}
                                </span>
                                <span className={lockedB ? 'text-emerald-400' : 'text-amber-300'}>
                                  {tie.team_b?.short_name || tie.team_b?.name || 'Team B'}: {lockedB ? 'locked' : 'missing'}
                                </span>
                              </>
                            )}
                            {showCourt && <span className="text-muted-foreground">{courtLabel(courtVal)}</span>}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTieForConsole(tie);
                            setShowBottleneckModal(false);
                          }}
                          className="h-8 shrink-0 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"
                        >
                          Manage
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
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
