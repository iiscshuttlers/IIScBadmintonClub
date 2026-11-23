import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isTieRevealed, tieCourts } from './organizerTieStatus';
import { Link } from 'wouter';
import {
  fetchAllTournamentMatchRows,
  countTournamentEntries,
  fetchTournamentMatchesByNumber,
} from '@/services/tournamentService';
import { teamService } from '@/services/teamService';
import { CheckCircle2, ChevronRight, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TieUmpireConsole } from '@/components/umpire/TieUmpireConsole';
import { useTeamModal } from '@/contexts/TeamModalContext';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentManagePath } from '@/lib/tournamentRoutes';
import { courtKey } from '@/lib/matchView';
import { HostSetupSections, canHostSetup } from './HostSetupSections';
import { isRegistrationFlagOn } from '@/services/tournament/registrationEntries';
import { calculateMinRosterRequirements, normalizeGender } from '@/lib/teamLineupRules';
import { useTournamentReadiness } from '@/hooks/queries/useCheckins';
import { AllMatchesList } from '@/components/tournament/AllMatchesList';
import { CheckinStatCards, CourtsAndQueue, WhosHereRoster } from '@/components/checkin/OrganiserCheckin';
import type { Tables } from '@/lib/supabase-types-auto';
import type { Tournament } from '@/types/tournament';
import type { TieFormatConfig, TieFormatConfigObject, TieFormatRubber, TieWithTeams } from '@/types/teamTie';


interface OrganizerDashboardProps {
  tournamentId: string;
  tournament: Tournament | null | undefined;
}

/**
 * A tie as the organizer view loads it. tournament_ties has no court or
 * reveal columns: courts and reveal state come from the tie's rubbers
 * (see organizerTieStatus).
 */
type OrganizerTie = TieWithTeams;

/** An ACTIVE team member with the player's name and gender (no player when every join failed). */
type OrganizerMember = Pick<Tables<'tournament_team_members'>, 'id' | 'team_id' | 'player_id' | 'role' | 'status'> & {
  player?: Pick<Tables<'players'>, 'id' | 'full_name' | 'gender'> | null;
};

/** Captains are tournament_teams.captain_id or a member with role CAPTAIN. */
const isCaptainMember = (m: OrganizerMember, playerId: string | null | undefined) =>
  !!playerId && m.player_id === playerId && m.role === 'CAPTAIN';

type OrganizerTeam = Tables<'tournament_teams'> & { members: OrganizerMember[] };

/**
 * The organiser's console: one header, then a small switcher between views so
 * the page stays short. It opens on the view that fits the event's stage
 * (set-up before the draw, Now while matches are being played, the match list
 * once it's over); every view stays one tap away.
 */
export function OrganizerDashboard({ tournamentId, tournament }: OrganizerDashboardProps) {
  const isTeamEvent = tournament?.format_family === 'TEAM';

  return isTeamEvent
    ? <TeamEventDashboard tournamentId={tournamentId} tournament={tournament} />
    : <IndividualEventDashboard tournamentId={tournamentId} tournament={tournament} />;
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "3" → "Court 3"; a named court ("Centre") is shown as is. */
const courtLabel = (court: string | number) => (/^\d+$/.test(String(court)) ? `Court ${court}` : String(court));

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
    <span className={`text-xs font-semibold whitespace-nowrap ${isLive ? 'text-success' : 'text-muted-foreground'}`}>
      {statusLabel(status)}
    </span>
  );
}

const sectionClass = 'rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3';
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
  // The Tournament Manager is admin-only; for a host this panel is the console.
  const { isAdmin } = useAuth();
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-black text-foreground">{title}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            aria-label="Refresh"
            title="Refresh"
            className="h-8 w-8 p-0 rounded-xl border-border-strong bg-muted text-soft hover:bg-muted-strong hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {isAdmin && (
            <Link
              href={tournamentManagePath(tournamentId, true)}
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition whitespace-nowrap"
            >
              Tournament Manager <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
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
            <strong className="font-bold text-foreground">{done}/{total}</strong> {unit} done · {percent}%
          </span>
          {stats.map((s) => (
            <span key={s.label}>
              <strong className="font-bold text-foreground">{s.value}</strong> {s.label}
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
    idle: 'border-warning/30 bg-warning/5 hover:border-warning/60',
    active: 'border-warning bg-warning/10 ring-2 ring-warning/50',
    count: 'text-warning',
  },
  sky: {
    idle: 'border-info/30 bg-info/5 hover:border-info/60',
    active: 'border-info bg-info/10 ring-2 ring-info/50',
    count: 'text-info',
  },
  emerald: {
    idle: 'border-success/30 bg-success/5 hover:border-success/60',
    active: 'border-success bg-success/10 ring-2 ring-success/50',
    count: 'text-success',
  },
  slate: {
    idle: 'border-border bg-card hover:border-border-strong',
    active: 'border-border-strong bg-muted ring-2 ring-border-strong/50',
    count: 'text-foreground',
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
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Checking what needs attention…
      </div>
    );
  }

  const pending = items.filter((item) => item.count > 0);

  if (pending.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
        <span className="font-semibold text-foreground">All clear</span>
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
              <ChevronRight className="w-4 h-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-tight text-foreground">{item.label}</p>
            {item.hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.hint}</p>}
          </button>
        );
      })}
    </div>
  );
}

interface ViewTab<K extends string> {
  key: K;
  label: string;
  /** Small number after the label ("Matches 61"). */
  count?: number;
  /** Marks a view that has something waiting (live play, teams not ready). */
  alert?: boolean;
}

/**
 * Segmented switcher between the organiser's views. Hidden when there is only
 * one view, so a finished event a non-host opens is just its match list.
 */
function ViewTabs<K extends string>({
  tabs,
  value,
  onChange,
  idBase,
}: {
  tabs: ViewTab<K>[];
  value: K;
  onChange: (key: K) => void;
  idBase: string;
}) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Organiser views" className="flex gap-1 rounded-2xl border border-border bg-card p-1">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            id={`${idBase}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idBase}-panel`}
            onClick={() => onChange(t.key)}
            className={`relative inline-flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 text-xs font-black transition ${
              active ? 'bg-primary text-primary-foreground' : 'text-soft hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="truncate">{t.label}</span>
            {t.count !== undefined && (
              <span className={`shrink-0 text-[10px] ${active ? 'opacity-80' : 'text-muted-foreground'}`}>{t.count}</span>
            )}
            {t.alert && !active && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />}
          </button>
        );
      })}
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

function IndividualEventDashboard({ tournamentId, tournament }: OrganizerDashboardProps) {
  const { data: matches = [], isLoading, refetch } = useQuery({
    queryKey: ['organizer_ind_matches', tournamentId],
    queryFn: async () => {
      const data = await fetchTournamentMatchesByNumber(tournamentId);
      return data || [];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // Entries, not registrations: players the organiser adds directly never get
  // a registration row. Matches the "N entered" count on the tournaments list.
  const { data: entryCount = 0 } = useQuery({
    queryKey: ['organizer_ind_entry_count', tournamentId],
    queryFn: () => countTournamentEntries(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 30000
  });

  const completedMatches = matches.filter((m) => m.status === 'completed');
  const inProgressMatches = matches.filter((m) => m.status === 'in_progress');
  // "Court" / "TBD" placeholders count as no court (same rule as the match list's filter).
  const matchesMissingCourt = matches.filter((m) => !courtKey(m.court_number) && m.status !== 'completed');
  const scheduledMatches = matches.filter((m) => m.status === 'scheduled' || !m.status);
  const completionRate = matches.length > 0 ? Math.round((completedMatches.length / matches.length) * 100) : 0;
  const unfinished = matches.length - completedMatches.length;

  const categories = useMemo(() => {
    const cats = new Set<string>();
    matches.forEach((m) => { if (m.category) cats.add(m.category); });
    return Array.from(cats).sort();
  }, [matches]);

  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'IN_PROGRESS' | 'UNASSIGNED_COURTS' | 'SCHEDULED'>('ALL');
  // Check-in readiness, courts and names: shared with the Umpire and Referee panels.
  const readiness = useTournamentReadiness(tournamentId);
  const { user } = useAuth();
  // The organiser panel is only shown to organisers; ORGANIZER officials get
  // the Registration view there too (in-app registration on).
  const hasSetup = canHostSetup(tournament, user?.id) || isRegistrationFlagOn(tournament);
  const checkinLive = unfinished > 0 && readiness.checkinsAvailable && readiness.matches.length > 0;

  type View = 'now' | 'matches' | 'checkin' | 'setup';
  const tabs: ViewTab<View>[] = [
    ...(unfinished > 0 ? [{ key: 'now' as const, label: 'Now', alert: inProgressMatches.length > 0 || matchesMissingCourt.length > 0 }] : []),
    { key: 'matches', label: 'Matches', count: matches.length },
    ...(checkinLive ? [{ key: 'checkin' as const, label: 'Check-in' }] : []),
    ...(hasSetup ? [{ key: 'setup' as const, label: 'Set-up' }] : []),
  ];
  // Registration notices link here with ?view=registration.
  const [chosenView, setChosenView] = useState<View | null>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'registration' ? 'setup' : null);
  const defaultView: View = matches.length === 0 && hasSetup ? 'setup' : unfinished > 0 ? 'now' : 'matches';
  const view: View = chosenView && tabs.some((t) => t.key === chosenView) ? chosenView : defaultView;

  // A card on Now opens the match list already filtered to it.
  const handleCardClick = (filter: typeof selectedFilter) => {
    setSelectedFilter(filter);
    setChosenView('matches');
  };

  return (
    <div className="space-y-3">
      <DashboardHeader
        title={tournament?.name || 'Organizer view'}
        tournamentId={tournamentId}
        onRefresh={() => refetch()}
        done={completedMatches.length}
        total={matches.length}
        percent={completionRate}
        unit="matches"
        stats={[
          { value: entryCount, label: entryCount === 1 ? 'entry' : 'entries' },
          { value: categories.length, label: categories.length === 1 ? 'format' : 'formats' },
        ]}
      />

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Loading matches…</div>
      ) : (
        <>
          <ViewTabs<View>
            tabs={tabs}
            value={view}
            onChange={(v) => {
              // Opening a view directly starts it unfiltered.
              setSelectedFilter('ALL');
              setChosenView(v);
            }}
            idBase="org-ind"
          />

          <div id="org-ind-panel" role="tabpanel" aria-labelledby={`org-ind-tab-${view}`} className="space-y-3">
            {view === 'now' && (
              <>
                <AttentionCards
                  loading={false}
                  selected={selectedFilter}
                  onSelect={handleCardClick}
                  items={[
                    { key: 'IN_PROGRESS', count: inProgressMatches.length, label: 'Live matches', tone: 'emerald' },
                    { key: 'UNASSIGNED_COURTS', count: matchesMissingCourt.length, label: 'Without a court', hint: 'Assign before play', tone: 'sky' },
                    { key: 'SCHEDULED', count: scheduledMatches.length, label: 'Still to play', tone: 'slate' },
                  ]}
                />
                {/* Player check-in: who's here at a glance, courts and the ready queue. */}
                {checkinLive && (
                  <>
                    <CheckinStatCards data={readiness} />
                    <CourtsAndQueue data={readiness} tournamentId={tournamentId} />
                  </>
                )}
              </>
            )}

            {/* All matches: a card on Now picks its status or court filter. */}
            {view === 'matches' && (
              <AllMatchesList
                key={selectedFilter}
                tournamentId={tournamentId}
                data={readiness}
                initialStatus={selectedFilter === 'IN_PROGRESS' ? 'live' : selectedFilter === 'SCHEDULED' ? 'upcoming' : 'all'}
                initialCourt={selectedFilter === 'UNASSIGNED_COURTS' ? 'none' : ''}
              />
            )}

            {view === 'checkin' && <WhosHereRoster data={readiness} tournamentId={tournamentId} />}

            {/* The host's set-up tools (registrations, entries, scoring rules). */}
            {view === 'setup' && <HostSetupSections tournament={tournament} heading={false} organiser />}
          </div>
        </>
      )}
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
  const [selectedTieForConsole, setSelectedTieForConsole] = useState<OrganizerTie | null>(null);
  // null = follow the event's stage (see defaultView below); otherwise the organiser's pick.
  const [chosenView, setChosenView] = useState<'ties' | 'teams' | 'setup' | null>(null);

  // Current logged in user ID / player ID
  const currentUserId = user?.id;
  const currentPlayerId = profile?.id;

  // 1. Fetch ties
  const { data: ties = [], isLoading: tiesLoading, refetch: refetchTies } = useQuery<OrganizerTie[]>({
    queryKey: ['organizer_ties', tournamentId],
    queryFn: async () => {
      const data = await teamService.getOrganizerTies(tournamentId);
      return data || [];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // 2. Fetch matches (for schedule/court inspection)
  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ['organizer_matches', tournamentId],
    queryFn: async () => {
      const data = await fetchAllTournamentMatchRows(tournamentId);
      return data || [];
    },
    enabled: !!tournamentId,
    refetchInterval: 15000
  });

  // 3. Fetch teams and member counts
  const { data: rawTeams = [], refetch: refetchTeams } = useQuery<OrganizerTeam[]>({
    queryKey: ['organizer_teams', tournamentId],
    queryFn: async () => {
      // 1. Fetch valid teams
      const { data: teamsData, error: teamsError } = await teamService.getOrganizerTeams(tournamentId);

      if (teamsError) {
        console.error('Error fetching organizer teams:', teamsError);
        throw teamsError;
      }

      const teamList = teamsData || [];
      if (teamList.length === 0) return [];

      // 2. Fetch members with joined player info
      const { data: rawMembers, error: membersError } = await teamService.getActiveMembersWithPlayer(tournamentId);

      let memberList: OrganizerMember[] = [];
      if (membersError) {
        // Fallback with explicit FK constraint name
        const fallback = await teamService.getActiveMembersWithPlayerFk(tournamentId);

        if (!fallback.error && fallback.data) {
          memberList = fallback.data.map((m) => ({
            ...m,
            player: m.players
          }));
        } else {
          // If relationship join completely fails, fetch members without join
          const bareMembers = await teamService.getActiveMembersBare(tournamentId);
          memberList = bareMembers.data || [];
        }
      } else {
        memberList = rawMembers || [];
      }

      // Group members by team_id
      const membersByTeam: Record<string, OrganizerMember[]> = {};
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
    return [...rawTeams].sort((a, b) => {
      const isCaptainA = (a.captain_id && (a.captain_id === currentUserId || a.captain_id === currentPlayerId)) ||
        a.members?.some((m) => isCaptainMember(m, currentPlayerId));
      const isCaptainB = (b.captain_id && (b.captain_id === currentUserId || b.captain_id === currentPlayerId)) ||
        b.members?.some((m) => isCaptainMember(m, currentPlayerId));

      if (isCaptainA && !isCaptainB) return -1;
      if (!isCaptainA && isCaptainB) return 1;

      // Also prioritize any team user is a member of
      const isMemberA = !!currentPlayerId && a.members?.some((m) => m.player_id === currentPlayerId);
      const isMemberB = !!currentPlayerId && b.members?.some((m) => m.player_id === currentPlayerId);
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
    return ties.filter((t) => {
      return (!t.lineup_locked_a || !t.lineup_locked_b) && t.state !== 'COMPLETED';
    });
  }, [ties]);

  const tiesAwaitingReveal = useMemo(() => {
    return ties.filter((t) => {
      return t.lineup_locked_a && t.lineup_locked_b && !isTieRevealed(t.id, matches) && t.state !== 'COMPLETED';
    });
  }, [ties, matches]);

  const liveTiesInProgress = useMemo(() => {
    return ties.filter((t) => {
      return t.state === 'IN_PROGRESS';
    });
  }, [ties]);

  const matchesMissingCourt = useMemo(() => {
    return matches.filter((m) => {
      const courtVal = m.court_number;
      return !courtVal && m.status !== 'completed';
    });
  }, [matches]);

  const tiesMissingCourt = useMemo(() => {
    return ties.filter((t) => {
      return tieCourts(t.id, matches).length === 0 && t.state !== 'COMPLETED';
    });
  }, [ties, matches]);

  const completedMatchesCount = matches.filter((m) => m.status === 'completed').length;

  // Dynamic fallback for total teams in case team records are not yet linked or still loading
  const effectiveTotalTeams = useMemo(() => {
    if (teams.length > 0) return teams.length;
    const distinctTeamIds = new Set<string>();
    ties.forEach((t) => {
      if (t.team_a_id) distinctTeamIds.add(t.team_a_id);
      if (t.team_b_id) distinctTeamIds.add(t.team_b_id);
    });
    return distinctTeamIds.size;
  }, [teams.length, ties]);

  // Rubbers count or expected rubbers from ties
  const rawFormat = tournament?.tie_format_config as TieFormatConfig | null | undefined;
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

    tiesWithMissingLineups.forEach((t) => {
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
    let currentRubbers: TieFormatRubber[] = [];
    if (Array.isArray(rawFormat)) currentRubbers = rawFormat;
    else if (rawFormat?.rubbers && Array.isArray(rawFormat.rubbers)) currentRubbers = rawFormat.rubbers;

    const rulesObj: TieFormatConfigObject = typeof rawFormat === 'object' && !Array.isArray(rawFormat) ? rawFormat : {};
    const dynReq = currentRubbers.length > 0
      ? calculateMinRosterRequirements(currentRubbers, {
          max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? tournament?.max_rubbers_per_player ?? 2,
          max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? tournament?.max_rubbers_per_player ?? 2,
          allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
          ignore_gender_rules: tournament?.ignore_gender_rules,
          team_roster_min: tournament?.team_roster_min
        })
      : null;

    const minRequired = dynReq?.minTotalPlayers || tournament?.team_roster_min || 4;
    return { dynReq, minRequired };
  }, [rawFormat, tournament]);

  const rosterRows = useMemo(() => {
    const { dynReq, minRequired } = rosterRequirement;
    return teams.map((t) => {
      const activeCount = t.members?.filter((m) => m.status === 'ACTIVE').length || 0;
      const isReady = activeCount >= minRequired;
      const pct = Math.min(100, Math.round((activeCount / minRequired) * 100));

      // Check gender balance against dynamic requirements
      let activeMales = 0;
      let activeFemales = 0;
      (t.members || []).forEach((m) => {
        if (m.status !== 'ACTIVE') return;
        const g = normalizeGender(m.player?.gender);
        if (g === 'Female') activeFemales++;
        else activeMales++;
      });

      const maleDeficit = dynReq ? Math.max(0, dynReq.minMalePlayers - activeMales) : 0;
      const femaleDeficit = dynReq ? Math.max(0, dynReq.minFemalePlayers - activeFemales) : 0;
      const isFullyReady = isReady && maleDeficit === 0 && femaleDeficit === 0;
      const neededCount = Math.max(0, minRequired - activeCount);

      // Check if current logged-in user belongs to this team
      const isMyTeam = !!((t.captain_id && (t.captain_id === currentUserId || t.captain_id === currentPlayerId)) ||
        (!!currentPlayerId && t.members?.some((m) => m.player_id === currentPlayerId)));

      const note = femaleDeficit > 0
        ? { text: `Needs ${plural(femaleDeficit, 'woman', 'women')}`, className: 'text-warning' }
        : maleDeficit > 0
          ? { text: `Needs ${plural(maleDeficit, 'man', 'men')}`, className: 'text-info' }
          : !isReady
            ? { text: `${neededCount} more needed`, className: 'text-warning' }
            : { text: 'Ready', className: 'text-success' };

      return { team: t, activeCount, minRequired, isReady, isFullyReady, pct, activeMales, activeFemales, isMyTeam, note };
    });
  }, [teams, rosterRequirement, currentUserId, currentPlayerId]);

  const readyTeamCount = rosterRows.filter((r) => r.isFullyReady).length;

  type View = 'ties' | 'teams' | 'setup';
  const hasSetup = canHostSetup(tournament, currentUserId);
  const teamsNotReady = readyTeamCount < rosterRows.length;
  const tabs: ViewTab<View>[] = [
    { key: 'ties', label: 'Ties', count: ties.length, alert: liveTiesInProgress.length > 0 || tiesAwaitingReveal.length > 0 },
    { key: 'teams', label: 'Teams', count: rosterRows.length, alert: teamsNotReady },
    ...(hasSetup ? [{ key: 'setup' as const, label: 'Set-up' }] : []),
  ];
  // Before any tie exists the host is still setting up; while teams are short
  // of players their rosters come first; otherwise the ties.
  const defaultView: View = ties.length === 0 && hasSetup ? 'setup' : ties.length === 0 && teamsNotReady ? 'teams' : 'ties';
  const view: View = chosenView && tabs.some((t) => t.key === chosenView) ? chosenView : defaultView;

  const openRoster = (t: OrganizerTeam) => openTeamModal({
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
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-soft hover:bg-muted-strong'
    }`;

  return (
    <div className="space-y-3">
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

      <ViewTabs<View> tabs={tabs} value={view} onChange={(v) => setChosenView(v)} idBase="org-team" />

      <div id="org-team-panel" role="tabpanel" aria-labelledby={`org-team-tab-${view}`} className="space-y-3">
      {view === 'ties' && (
      <>
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
          <h3 className="min-w-0 truncate text-sm font-bold text-foreground">
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
          <ul className="divide-y divide-border">
            {displayedTies.map((tie) => {
              const pending = [
                !tie.lineup_locked_a && (tie.team_a?.short_name || 'Team A'),
                !tie.lineup_locked_b && (tie.team_b?.short_name || 'Team B'),
              ].filter(Boolean) as string[];
              const revealed = isTieRevealed(tie.id, matches);
              const lineup = pending.length > 0
                ? {
                    text: `${pending.length > 1 ? 'Lineups' : 'Lineup'} pending: ${pending.join(', ')}${revealed ? ' · revealed' : ''}`,
                    className: 'text-warning',
                  }
                : revealed
                  ? { text: 'Lineups revealed', className: 'text-muted-foreground' }
                  : tie.state === 'COMPLETED'
                    ? { text: 'Lineups locked · not revealed', className: 'text-muted-foreground' }
                    : { text: 'Locked · ready to reveal', className: 'text-warning' };

              return (
                <li key={tie.id} className="flex items-center gap-3 py-2.5">
                  <span className={codeClass} title={tie.tie_code}>{tie.tie_code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {tie.team_a?.name || 'TBD'} vs {tie.team_b?.name || 'TBD'}
                    </p>
                    <p className={`truncate text-xs ${lineup.className}`}>{lineup.text}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTieForConsole(tie)}
                    className="h-8 shrink-0 rounded-xl border-border-strong bg-muted text-xs font-bold text-soft hover:bg-muted-strong hover:text-foreground"
                  >
                    Manage
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      </>
      )}

      {/* Team rosters: who is short of players, your team first. */}
      {view === 'teams' && (
      <section className={sectionClass}>
        <h3 className="text-sm font-bold text-foreground">
          Team rosters
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            · {rosterRows.length > 0 ? `${readyTeamCount}/${rosterRows.length} ready` : 'no teams yet'}
          </span>
        </h3>

        {(
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
                    className={`rounded-xl border bg-background/40 p-3 text-left transition hover:bg-muted/60 ${
                      r.isMyTeam ? 'border-warning/70' : 'border-border hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-bold text-foreground">
                        {t.name}
                        {t.short_name && (
                          <span className="ml-1.5 font-mono text-[11px] font-semibold text-muted-foreground">{t.short_name}</span>
                        )}
                      </p>
                      {tag && (
                        <span className={`shrink-0 text-[11px] ${r.isMyTeam ? 'text-warning' : 'text-muted-foreground'}`}>
                          {tag}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="text-soft">
                        <strong className="font-bold text-foreground">{r.activeCount}</strong>/{r.minRequired} players
                        <span className="ml-1 text-muted-foreground">({r.activeMales}M, {r.activeFemales}F)</span>
                      </span>
                      <span className={`shrink-0 font-semibold ${r.note.className}`}>{r.note.text}</span>
                    </div>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          r.isMyTeam ? 'bg-warning' : r.isReady ? 'bg-success' : 'bg-warning'
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
      )}

      {/* The host's set-up tools (registrations, scoring rules). */}
      {view === 'setup' && <HostSetupSections tournament={tournament} heading={false} organiser />}
      </div>

      {/* Bottleneck drill-down */}
      {showBottleneckModal && selectedBottleneck !== 'ALL' && (
        <div
          className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setShowBottleneckModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={modalHeading[selectedBottleneck].title}
            className="max-w-2xl w-full max-h-[85vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-black text-foreground">{modalHeading[selectedBottleneck].title}</h3>
                <p className="text-xs text-muted-foreground">{modalHeading[selectedBottleneck].text}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBottleneckModal(false)}
                aria-label="Close"
                className="p-2 -m-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedBottleneck === 'MISSING_LINEUPS' && (
              <div className="px-4 py-2 border-b border-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground shrink-0">
                <span>Both missing: <strong className="text-danger">{missingLineupsStats.bothMissingCount}</strong></span>
                <span>One missing: <strong className="text-warning">{missingLineupsStats.oneMissingCount}</strong></span>
              </div>
            )}

            {selectedBottleneck === 'UNASSIGNED_COURTS' && (
              <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-2 text-xs shrink-0">
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
                  <ul className="divide-y divide-border">
                    {matchesMissingCourt.map((match) => {
                      const parentTie = ties.find((t) => t.id === match.tie_id);
                      return (
                        <li key={match.id} className="flex items-center gap-3 py-2.5">
                          <span className={codeClass}>
                            {match.match_code || `R${match.match_number || '?'}`}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {match.category || 'Rubber'}
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
                <ul className="divide-y divide-border">
                  {displayedTies.map((tie) => {
                    const lockedA = !!tie.lineup_locked_a;
                    const lockedB = !!tie.lineup_locked_b;
                    const courtVal = tieCourts(tie.id, matches).join(', ');
                    const showCourt = (selectedBottleneck === 'LIVE_TIES' || selectedBottleneck === 'UNASSIGNED_COURTS') && courtVal;

                    return (
                      <li key={tie.id} className="flex items-center gap-3 py-2.5">
                        <span className={codeClass} title={tie.tie_code || 'TIE'}>{tie.tie_code || 'TIE'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {tie.team_a?.name || 'Team A'} vs {tie.team_b?.name || 'Team B'}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                            <StatusText status={tie.state || 'SCHEDULED'} />
                            {selectedBottleneck === 'MISSING_LINEUPS' && (
                              <>
                                <span className={lockedA ? 'text-success' : 'text-warning'}>
                                  {tie.team_a?.short_name || tie.team_a?.name || 'Team A'}: {lockedA ? 'locked' : 'missing'}
                                </span>
                                <span className={lockedB ? 'text-success' : 'text-warning'}>
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
