import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Shield, 
  Users, 
  Calendar, 
  AlertCircle, 
  Plus, 
  Check, 
  X, 
  Loader2, 
  ArrowLeft, 
  Link as LinkIcon, 
  Copy, 
  RefreshCw, 
  UserMinus, 
  Trophy, 
  CheckCircle2, 
  Clock, 
  Search, 
  Sparkles,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { teamService, playerService } from '@/services';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { TeamLineupBuilder } from '@/components/admin/TeamLineupBuilder';
import { TeamStandingsTable } from '@/components/events/TeamStandingsTable';
import { ClickableTeamName } from '@/contexts/TeamModalContext';
import { useConfirm } from '@/contexts/ConfirmContext';
import { PlayerMatchBanner } from '@/components/events/PlayerMatchBanner';
import { getBaseShareUrl } from '@/lib/utils';
import { usePlayerModal } from '@/contexts/PlayerModalContext';
import { TeamLogo } from '@/components/events/TeamLogo';

export default function TournamentTeamHub({ params }: { params?: { id: string } }) {
  const { openPlayerModal } = usePlayerModal();
  const routeParams = useParams<{ id: string }>();
  const teamId = params?.id || routeParams?.id;
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();

  // Search & Invite states
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [selectedPlayerForInvite, setSelectedPlayerForInvite] = useState<any>(null);
  const [activeTieTab, setActiveTieTab] = useState<string | null>(null);

  usePageMeta({ title: "Team Command Hub", description: "Manage your team, lineup, and roster" });

  // 1. Fetch team details
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      const data = await teamService.getTeamById(teamId!);
      return data as any;
    },
    enabled: !!teamId,
    staleTime: 30000,
    retry: 1
  });

  // 2. Fetch team ties
  const { data: ties = [], isLoading: tiesLoading } = useQuery({
    queryKey: ['my_ties', teamId],
    queryFn: async () => {
      const list = await teamService.getTeamTiesForTeam(teamId!);
      const priority = (state: string) => {
        if (state === 'IN_PROGRESS') return 0;
        if (state === 'COMPLETED') return 2;
        return 1;
      };
      return (list as any[]).sort((a: any, b: any) => {
        const pA = priority(a.state);
        const pB = priority(b.state);
        if (pA !== pB) return pA - pB;
        return (a.round_number || 1) - (b.round_number || 1) || a.tie_code.localeCompare(b.tie_code);
      });
    },
    enabled: !!teamId,
    staleTime: 10000
  });

  // 3. Fetch team members with player profiles (and ensure captain is included)
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team_members', teamId, team?.captain_id],
    queryFn: async () => {
      return teamService.getTeamRosterWithCaptain(teamId!, team?.captain_id);
    },
    enabled: !!teamId,
    staleTime: 10000,
    retry: 1
  });

  // 4. Fetch search suggestions for invite (search across all registered profiles in app/website)
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['player_search', playerSearchQuery],
    queryFn: async () => {
      return playerService.searchPlayersByQuery(playerSearchQuery);
    },
    enabled: playerSearchQuery.trim().length >= 2
  });

  const isCaptain = session?.user?.id === team?.captain_id;

  // The invite token is no longer on the team row; staff fetch it privately.
  const { data: inviteToken = null } = useQuery({
    queryKey: ['team-invite-token', teamId],
    queryFn: () => teamService.getTeamInviteToken(teamId!),
    enabled: !!teamId && !!session?.user?.id,
    staleTime: 30000,
  });
  const isMember = members.some((m: any) => m.player_id === session?.user?.id && m.status === 'ACTIVE');
  const myInvite = members.find((m: any) => m.player_id === session?.user?.id && m.status === 'INVITED');

  const activeMembers = members.filter((m: any) => m.status === 'ACTIVE');
  const invitedMembers = members.filter((m: any) => m.status === 'INVITED');
  const maxRoster = team?.tournaments?.team_roster_max || 15;

  // Next upcoming tie requiring lineup submission
  const upcomingTieWithPendingLineup = ties.find((tie: any) => {
    const isTeamA = tie.team_a_id === teamId;
    const isLocked = isTeamA ? tie.lineup_locked_a : tie.lineup_locked_b;
    return !isLocked && tie.state !== 'COMPLETED';
  });

  // Set default active tie tab once ties load
  React.useEffect(() => {
    if (ties.length > 0 && !activeTieTab) {
      if (upcomingTieWithPendingLineup) {
        setActiveTieTab(upcomingTieWithPendingLineup.id);
      } else {
        setActiveTieTab(ties[0].id);
      }
    }
  }, [ties, upcomingTieWithPendingLineup, activeTieTab]);

  // Mutations
  const respondInvite = useMutation({
    mutationFn: async ({ accept }: { accept: boolean }) => {
      if (!myInvite) return;
      await teamService.respondTeamInvite(myInvite.id, accept);
    },
    onSuccess: () => {
      toast.success('Responded to team invitation');
      queryClient.invalidateQueries({ queryKey: ['team_members', teamId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to respond')
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const ok = await confirm({
        title: "Remove Team Member",
        message: "Are you sure you want to remove this player from the team?",
        confirmText: "Remove Player",
        confirmVariant: "danger"
      });
      if (!ok) return;

      await teamService.removeTeamMemberRpc(memberId);
    },
    onSuccess: () => {
      toast.success('Team member removed');
      queryClient.invalidateQueries({ queryKey: ['team_members', teamId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to remove member')
  });

  const invitePlayerMutation = useMutation({
    mutationFn: async (playerId: string) => {
      await teamService.inviteTeamMemberRpc(teamId!, playerId);
    },
    onSuccess: () => {
      toast.success('Invitation sent successfully!');
      setSelectedPlayerForInvite(null);
      setPlayerSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['team_members', teamId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to invite player')
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      const ok = await confirm({
        title: "Regenerate Shareable Link",
        message: "Existing links will stop working. Create a new invite link?",
        confirmText: "Regenerate Link"
      });
      if (!ok) return;

      return await teamService.generateNewTeamInviteToken(teamId!);
    },
    onSuccess: () => {
      toast.success('Generated a new invite link');
      queryClient.invalidateQueries({ queryKey: ['team', teamId] });
      queryClient.invalidateQueries({ queryKey: ['team-invite-token', teamId] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to regenerate link')
  });

  const getPublicShareUrl = () => {
    if (!inviteToken) return '';
    const base = getBaseShareUrl();
    return `${base}/join-team/${inviteToken}`;
  };

  const copyInviteLink = () => {
    const url = getPublicShareUrl();
    if (!url) {
      toast.error('No invite link generated yet.');
      return;
    }
    navigator.clipboard.writeText(url);
    toast.success('Official join link copied to clipboard!');
  };

  if (teamLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <Loader2 className="animate-spin w-10 h-10 text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading Team Command Center...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-12 h-12 text-danger mb-3" />
        <h2 className="text-2xl font-black text-foreground mb-2">Team Not Found</h2>
        <p className="text-muted-foreground mb-6">This team does not exist or may have been deleted.</p>
        <Button onClick={() => navigate('/tournaments')}>Back to Tournaments</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Header Banner */}
      <PageHeader
        backTo="/tournaments"
        badge={isCaptain ? "Captain Hub" : "Team Hub"}
        badgeIcon={<Shield className="w-3.5 h-3.5 text-primary" />}
        title={team.name}
        subtitle={`${team.tournaments?.name || 'Tournament Team'} · ${activeMembers.length} active player${activeMembers.length === 1 ? '' : 's'}`}
        action={
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-muted border border-border-strong w-fit">
            <Users className="w-4 h-4 text-primary" />
            <span>Roster: {activeMembers.length}/{maxRoster}</span>
            <span className={`w-2 h-2 rounded-full ${activeMembers.length >= 4 ? 'bg-success' : 'bg-warning animate-pulse'}`} />
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        
        {/* Personal upcoming rubber matches banner */}
        <PlayerMatchBanner 
          tournamentId={team.tournament_id}
          onNavigateToTie={(tieId) => {
            setActiveTieTab(tieId);
            const el = document.getElementById(`tie-${tieId}`);
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        />

        {/* ACTION REQUIRED BANNER (if lineup pending) */}
        {upcomingTieWithPendingLineup && isCaptain && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-warning/10 via-warning/5 to-transparent border-2 border-warning/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-warning text-warning-foreground shadow-md shadow-warning/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-warning">
                  Lineup Submission Pending!
                </h3>
                <p className="text-xs sm:text-sm text-warning/90 mt-0.5">
                  Tie <span className="font-mono font-bold">{upcomingTieWithPendingLineup.tie_code}</span> requires your official playing lineup submission.
                </p>
              </div>
            </div>
            <Button 
              onClick={() => {
                setActiveTieTab(upcomingTieWithPendingLineup.id);
                const el = document.getElementById(`tie-${upcomingTieWithPendingLineup.id}`);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-warning hover:bg-warning/90 text-warning-foreground font-black px-5 py-2.5 rounded-xl shadow-lg shadow-warning/25 border border-warning active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer text-xs sm:text-sm"
            >
              Submit Lineup Now
              <ChevronRight className="w-4 h-4 ml-1 stroke-[3]" />
            </Button>
          </div>
        )}

        {/* INVITE BANNER (For user invited to this team) */}
        {myInvite && (
          <div className="p-5 rounded-2xl bg-primary/10 border-2 border-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-bold text-base">You've been invited to join {team.name}!</h3>
                <p className="text-xs text-muted-foreground">Accept the invitation to represent this team in the tournament.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => respondInvite.mutate({ accept: true })} 
                disabled={respondInvite.isPending}
                className="bg-success hover:bg-success/90 text-success-foreground font-bold"
              >
                <Check className="w-4 h-4 mr-1.5" /> Accept Invite
              </Button>
              <Button 
                variant="outline" 
                onClick={() => respondInvite.mutate({ accept: false })} 
                disabled={respondInvite.isPending}
                className="text-danger hover:bg-danger/10"
              >
                <X className="w-4 h-4 mr-1.5" /> Decline
              </Button>
            </div>
          </div>
        )}

        {/* SECTION 1: CAPTAIN ROSTER & SHAREABLE INVITE LINK */}
        <section className="bg-card rounded-3xl p-5 sm:p-7 border border-border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Team Roster & Members</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  {activeMembers.length} active players · {invitedMembers.length} pending invites
                </p>
              </div>
            </div>
            {isCaptain && (
              <span className="text-xs font-bold text-success bg-success/25 border border-success/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Captain Controls Enabled
              </span>
            )}
          </div>

          {/* Captain Shareable Link Card */}
          {isCaptain && (
            <div className="p-4 sm:p-5 rounded-2xl bg-info/10 border border-info/40 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-info" />
                  <h3 className="font-bold text-sm text-info">
                    Shareable Team Join Link
                  </h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => regenerateTokenMutation.mutate()}
                  disabled={regenerateTokenMutation.isPending}
                  className="h-8 text-xs font-bold text-info hover:text-foreground hover:bg-info/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${regenerateTokenMutation.isPending ? 'animate-spin' : ''}`} />
                  Reset Link
                </Button>
              </div>
              <p className="text-xs text-info/80">
                Share this link with your teammates. Anyone with this link can immediately join your team roster without waiting for manual approval.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  readOnly 
                  value={inviteToken ? getPublicShareUrl() : 'Generating link...'} 
                  className="flex-1 px-3.5 py-2 rounded-xl border border-info/50 bg-card text-xs font-mono text-soft select-all focus:outline-none"
                />
                <Button 
                  onClick={copyInviteLink} 
                  className="bg-info hover:bg-info/90 text-info-foreground font-black text-xs h-9 px-4 rounded-xl shadow-md shadow-info/25 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Link
                </Button>
              </div>
            </div>
          )}

          {/* Captain Add Player Search */}
          {isCaptain && (
            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add / Invite Player by Name
              </label>
              <div className="relative">
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5" />
                  <input 
                    type="text" 
                    placeholder="Search IISc badminton players by name or email..." 
                    value={playerSearchQuery} 
                    onChange={e => setPlayerSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {isSearching && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground absolute right-3.5" />
                  )}
                </div>

                {/* Dropdown Results */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-border max-h-64 overflow-y-auto">
                    {searchResults.map((player: any) => {
                      const alreadyInTeam = members.some((m: any) => m.player_id === player.id);
                      return (
                        <div 
                          key={player.id} 
                          className="p-3 hover:bg-muted/60 flex items-center justify-between gap-3 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-xs overflow-hidden">
                              {player.avatar_url ? (
                                <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                player.full_name?.charAt(0) || 'P'
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold leading-tight">{player.full_name || player.nickname || 'Unknown Player'}</p>
                              <p className="text-xs text-muted-foreground font-mono">{player.email || 'No email'}</p>
                            </div>
                          </div>
                          {alreadyInTeam ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                              Already added
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => invitePlayerMutation.mutate(player.id)}
                              disabled={invitePlayerMutation.isPending}
                              className="h-8 text-xs font-bold"
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1" />
                              Add / Invite
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Members List Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Squad ({activeMembers.length})
            </label>
            {membersLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading roster...
              </div>
            ) : activeMembers.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground bg-muted/40 rounded-2xl">
                No active players in roster yet.
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeMembers.map((m: any) => {
                const isThisPlayerCaptain = m.player_id === team.captain_id || m.role === 'CAPTAIN';
                const isMe = m.player_id === session?.user?.id;
                return (
                  <div 
                    key={m.id} 
                    className="p-3.5 rounded-2xl border border-border bg-card/90 flex items-center justify-between gap-3 shadow-xs hover:border-border-strong transition"
                  >
                    <div 
                      onClick={() => openPlayerModal(m.player_id)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer group/player hover:opacity-90 transition"
                      title="View player profile"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted-strong flex items-center justify-center font-bold text-sm overflow-hidden shrink-0 group-hover/player:ring-2 group-hover/player:ring-primary/40 transition">
                        {m.players?.avatar_url ? (
                          <img src={m.players.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          m.players?.full_name?.charAt(0) || 'U'
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm flex items-center gap-1.5 truncate">
                          <span className="truncate group-hover/player:text-primary transition-colors text-foreground">
                            {m.players?.full_name || m.players?.display_name || 'Player'}
                          </span>
                          {isMe && <span className="text-[10px] text-you font-bold">(You)</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isThisPlayerCaptain ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-warning/15 text-warning border border-warning/30">
                              <Shield className="w-3 h-3 text-warning fill-warning/30" /> Captain
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Player
                            </span>
                          )}
                          {m.players?.gender && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              m.players.gender === 'Female' || m.players.gender === 'F'
                                ? 'bg-danger/15 text-danger border border-danger/30'
                                : 'bg-info/15 text-info border border-info/30'
                            }`}>
                              {m.players.gender === 'Female' || m.players.gender === 'F' ? '♀ Female' : '♂ Male'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isCaptain && !isThisPlayerCaptain && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeMember.mutate(m.id)}
                        disabled={removeMember.isPending}
                        className="text-danger hover:text-danger/80 hover:bg-danger/15 h-8 px-2.5 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Invited / Pending Members */}
          {invitedMembers.length > 0 && (
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-warning">
                Pending Invitations ({invitedMembers.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {invitedMembers.map((m: any) => (
                  <div 
                    key={m.id} 
                    className="p-3 rounded-2xl border border-warning/20 bg-warning/5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-warning" />
                      <div>
                        <p className="text-xs font-bold text-soft">
                          {m.players?.full_name || m.players?.email || 'Invited User'}
                        </p>
                        <span className="text-[10px] font-bold text-warning">
                          Awaiting response
                        </span>
                      </div>
                    </div>
                    {isCaptain && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeMember.mutate(m.id)}
                        className="text-muted-foreground hover:text-danger h-7 px-2 text-xs"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 2: FIXTURES & LINEUPS */}
        <section className="bg-card rounded-3xl p-5 sm:p-7 border border-border shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Fixtures & Lineup Submissions</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Select a tie below to build, adjust, and lock your playing order
                </p>
              </div>
            </div>
          </div>

          {ties.length === 0 ? (
            <div className="text-center py-10 bg-card rounded-2xl">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-bold text-soft">No ties scheduled yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">The tournament organizer has not generated fixtures for this round.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Tie Selector Pills */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2.5 scrollbar-none">
                {ties.map((tie: any) => {
                  const isTeamA = tie.team_a_id === teamId;
                  const opponentObj = isTeamA ? tie.team_b : tie.team_a;
                  const isLocked = isTeamA ? tie.lineup_locked_a : tie.lineup_locked_b;
                  const isSelected = activeTieTab === tie.id;

                  return (
                    <button
                      key={tie.id}
                      onClick={() => setActiveTieTab(tie.id)}
                      className={`px-4 py-2.5 rounded-2xl border text-xs font-black tracking-tight transition-all duration-200 flex items-center gap-2.5 shrink-0 shadow-xs cursor-pointer ${
                        isSelected 
                          ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25 ring-2 ring-primary/50 scale-[1.02]' 
                          : 'bg-card/90 text-foreground hover:text-foreground/80 border-border-strong/80 hover:border-border-strong hover:bg-muted'
                      }`}
                    >
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md font-bold ${
                        isSelected 
                          ? 'bg-primary-foreground/15 text-primary-foreground' 
                          : 'bg-muted text-soft border border-border-strong'
                      }`}>
                        {tie.tie_code}
                      </span>
                      <span className="font-bold">
                        <span className={isSelected ? 'text-primary-foreground/70 font-semibold' : 'text-muted-foreground font-semibold'}>vs</span>{' '}
                        {opponentObj?.short_name || opponentObj?.name || 'TBD'}
                      </span>
                      {isLocked ? (
                        <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-primary-foreground' : 'text-success'}`} />
                      ) : (
                        <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${isSelected ? 'bg-background' : 'bg-warning'}`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Tie Lineup Builder */}
              {ties.map((tie: any) => {
                if (tie.id !== activeTieTab) return null;
                const side = tie.team_a_id === teamId ? 'A' : 'B';
                const opponentObj = side === 'A' 
                  ? { id: tie.team_b_id, name: tie.team_b?.name || 'TBD', short_name: tie.team_b?.short_name } 
                  : { id: tie.team_a_id, name: tie.team_a?.name || 'TBD', short_name: tie.team_a?.short_name };
                
                const isLocked = side === 'A' ? tie.lineup_locked_a : tie.lineup_locked_b;

                return (
                  <div key={tie.id} id={`tie-${tie.id}`} className="border border-border rounded-2xl overflow-hidden bg-card/40">
                    <div className="bg-muted/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-strong">
                      <div className="flex items-center gap-2.5">
                        <span className="text-primary font-black text-sm bg-card px-2.5 py-1 rounded-lg border border-border-strong font-mono">
                          {tie.tie_code}
                        </span>
                        <span className="text-xs text-muted-foreground font-bold uppercase">Versus</span>
                        <ClickableTeamName team={opponentObj} className="text-base font-bold text-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          isLocked 
                            ? 'bg-success/25 text-success border border-success/40' 
                            : 'bg-warning/25 text-warning border border-warning/40'
                        }`}>
                          {isLocked ? 'Lineup Locked' : 'Lineup Not Locked'}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 bg-muted-strong rounded-lg text-soft">
                          State: {tie.state}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 sm:p-6">
                      <TeamLineupBuilder 
                        tie={tie} 
                        team={team} 
                        members={members} 
                        isCaptain={isCaptain} 
                        side={side} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 3: TOURNAMENT STANDINGS */}
        <section className="bg-card rounded-3xl p-5 sm:p-7 border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Tournament Standings</h2>
              <p className="text-xs text-muted-foreground font-medium">Current pool and team standings</p>
            </div>
          </div>
          <TeamStandingsTable tournamentId={team?.tournament_id} />
        </section>

      </div>
    </div>
  );
}
