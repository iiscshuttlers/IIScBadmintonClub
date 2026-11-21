import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teamService } from '@/services/teamService';
import { umpireService } from '@/services/umpireService';
import { 
  X, 
  Swords, 
  Radio, 
  Clock, 
  CheckCircle2, 
  Lock, 
  Eye, 
  ShieldAlert, 
  Users, 
  ChevronRight, 
  Trophy,
  LayoutGrid,
  ListFilter,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bell
} from 'lucide-react';
import { useTeamModal } from '@/contexts/TeamModalContext';
import { usePlayerModal } from '@/contexts/PlayerModalContext';
import { useAuth } from '@/contexts/AuthContext';
import { TeamSquadView } from '@/components/events/TeamSquadView';
import { StatusChip } from '@/components/tournament/StatusChip';
import { WatchTieButton } from '@/components/events/WatchTieButton';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tie: any;
  tournament?: any;
  viewerIsCaptainOf?: 'A' | 'B' | null;
  viewerIsOfficial?: boolean;
  onSubmitLineup?: (side: 'A' | 'B') => void;
  onEnterOnBehalf?: (side: 'A' | 'B') => void;
}

export function TieVisualLineupModal({
  isOpen,
  onClose,
  tie,
  tournament,
  viewerIsCaptainOf,
  viewerIsOfficial,
  onSubmitLineup,
  onEnterOnBehalf,
}: Props) {
  const { session, isUmpire, isAdmin } = useAuth();
  const { openTeamModal } = useTeamModal();
  const { openPlayerModal } = usePlayerModal();
  const [viewMode, setViewMode] = useState<'court' | 'list'>(() => {
    return (localStorage.getItem('tieViewMode') as 'court' | 'list') || 'court';
  });
  const [showSquads, setShowSquads] = useState<boolean>(false);
  const [collapsedMatches, setCollapsedMatches] = useState<Record<string, boolean>>({});

  const handleSetViewMode = (mode: 'court' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('tieViewMode', mode);
  };

  // 1. Fetch rubber matches for this tie
  const { data: rubbers = [], isLoading: rubbersLoading } = useQuery({
    queryKey: ['visual_tie_rubbers', tie?.id],
    queryFn: async () => {
      if (!tie?.id) return [];
      const data = await teamService.getTieRubbersWithPlayers(tie.id);

      // Sort by status priority (Live -> Upcoming -> Completed), then by playing_order / rubber_order
      const statusPriority = (status: string) => {
        if (status === 'in_progress') return 0;
        if (status === 'completed' || status === 'walkover') return 2;
        return 1;
      };

      return (data || []).sort((a: any, b: any) => {
        const pA = statusPriority(a.status);
        const pB = statusPriority(b.status);
        if (pA !== pB) return pA - pB;
        const orderA = a.playing_order ?? a.rubber_order ?? 99;
        const orderB = b.playing_order ?? b.rubber_order ?? 99;
        return orderA - orderB;
      });
    },
    enabled: isOpen && !!tie?.id,
    refetchInterval: 4000
  });

  // 2. Fetch substitutions audit
  const { data: audits = [] } = useQuery({
    queryKey: ['visual_tie_audits', tie?.id],
    queryFn: async () => {
      if (!tie?.id) return [];
      return umpireService.fetchTieLineupAudits(tie.id);
    },
    enabled: isOpen && !!tie?.id
  });

  if (!isOpen || !tie) return null;

  const isRevealed = rubbers.some((r: any) => r.is_revealed || r.player1_id);
  const isBothLocked = tie.lineup_locked_a && tie.lineup_locked_b;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="max-w-4xl w-full max-h-[92vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-foreground"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-br from-card via-muted to-card border-b border-border shrink-0">
          <div className="flex items-center justify-between pb-3 border-b border-border-strong/50">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-primary text-primary-foreground">
                {tie.tie_code}
              </span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {tie.round_name || tie.stage || 'FIXTURE'}
              </span>
              <StatusChip state={tie.state === 'IN_PROGRESS' ? 'live' : tie.state} />
            </div>

            <div className="flex items-center gap-2">
              {/* Layout view toggle */}
              <div className="flex items-center bg-muted p-0.5 rounded-xl border border-border-strong text-xs">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('court')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'court' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Court Cards
                </button>
                <button
                  type="button"
                  onClick={() => handleSetViewMode('list')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" /> List
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Teams Matchup Header */}
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
            {/* Team A */}
            <div 
              onClick={() => {
                const teamData = {
                  id: tie.team_a?.id || tie.team_a_id,
                  name: tie.team_a?.name || 'Team A',
                  short_name: tie.team_a?.short_name,
                  logo_url: tie.team_a?.logo_url,
                  tournament_id: tie.tournament_id || tournament?.id
                };
                if (teamData.id) openTeamModal(teamData, 'roster');
              }}
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group p-1.5 sm:p-2 rounded-2xl hover:bg-muted/60 active:scale-95 transition min-w-0"
              title="Click to view Team A roster and matches"
              role="button"
              tabIndex={0}
            >
              {tie.team_a?.logo_url ? (
                <div className="relative shrink-0">
                  <img 
                    src={tie.team_a.logo_url} 
                    alt={tie.team_a?.name || "Team A"} 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-foreground/20 shadow-lg ring-2 ring-success/20 group-hover:ring-success/40 transition-all duration-200" 
                  />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-info via-info to-individual flex items-center justify-center font-black text-xs sm:text-sm tracking-wider text-on-accent shrink-0 shadow-lg ring-2 ring-info/20 group-hover:ring-info/40 border border-foreground/20 transition-all duration-200">
                  {tie.team_a?.short_name ? tie.team_a.short_name.slice(0, 4) : 'A'}
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <h3 className="font-black text-xs sm:text-lg text-success group-hover:underline underline-offset-2 transition-colors truncate">
                  {tie.team_a?.name || "Team A"}
                </h3>
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold flex items-center gap-1 group-hover:text-success transition-colors truncate max-w-full">
                  <span className="truncate">{tie.team_a?.short_name || "Side A"}</span>
                  <span className="hidden xs:inline text-muted-foreground">•</span>
                  <span className="hidden xs:inline whitespace-nowrap">View Squad →</span>
                </span>
              </div>
            </div>

            {/* Score Center */}
            <div className="flex flex-col items-center justify-center px-2 sm:px-4 shrink-0 min-w-[56px] sm:min-w-[72px]">
              <div className="font-mono text-xl sm:text-3xl font-black text-foreground flex items-center gap-1.5 sm:gap-2 leading-none">
                <span className="text-primary">{tie.score_team_a ?? 0}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-primary">{tie.score_team_b ?? 0}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-muted-foreground uppercase mt-0.5">TIE SCORE</span>
            </div>

            {/* Team B */}
            <div 
              onClick={() => {
                const teamData = {
                  id: tie.team_b?.id || tie.team_b_id,
                  name: tie.team_b?.name || 'Team B',
                  short_name: tie.team_b?.short_name,
                  logo_url: tie.team_b?.logo_url,
                  tournament_id: tie.tournament_id || tournament?.id
                };
                if (teamData.id) openTeamModal(teamData, 'roster');
              }}
              className="flex items-center justify-end gap-2 sm:gap-3 cursor-pointer group p-1.5 sm:p-2 rounded-2xl hover:bg-muted/60 active:scale-95 transition text-right min-w-0"
              title="Click to view Team B roster and matches"
              role="button"
              tabIndex={0}
            >
              <div className="min-w-0 flex-1 overflow-hidden">
                <h3 className="font-black text-xs sm:text-lg text-foreground group-hover:underline underline-offset-2 transition-colors truncate">
                  {tie.team_b?.name || "Team B"}
                </h3>
                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold flex items-center justify-end gap-1 group-hover:text-soft transition-colors truncate max-w-full">
                  <span className="hidden xs:inline whitespace-nowrap">← View Squad</span>
                  <span className="hidden xs:inline text-muted-foreground">•</span>
                  <span className="truncate">{tie.team_b?.short_name || "Side B"}</span>
                </span>
              </div>
              {tie.team_b?.logo_url ? (
                <div className="relative shrink-0">
                  <img 
                    src={tie.team_b.logo_url} 
                    alt={tie.team_b?.name || "Team B"} 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-foreground/20 shadow-lg ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-200" 
                  />
                </div>
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-individual via-individual to-individual flex items-center justify-center font-black text-xs sm:text-sm tracking-wider text-on-accent shrink-0 shadow-lg ring-2 ring-individual/20 group-hover:ring-individual/40 border border-foreground/20 transition-all duration-200">
                  {tie.team_b?.short_name ? tie.team_b.short_name.slice(0, 4) : 'B'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Secret / Lock status notice */}
        {!isRevealed ? (
          <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 text-xs ${
            isBothLocked
              ? 'bg-success/10 border-success/20 text-success'
              : 'bg-warning/10 border-warning/20 text-warning'
          }`}>
            <div className="flex items-center gap-2.5">
              {isBothLocked ? (
                <Lock className="w-4 h-4 text-success shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
              )}
              <span className="font-semibold">
                {isBothLocked 
                  ? "Both teams have locked secret lineups. Head-to-head pairings will appear as soon as the match referee reveals them."
                  : (!tie.lineup_locked_a && !tie.lineup_locked_b)
                    ? "Both teams are yet to submit their lineup."
                    : !tie.lineup_locked_a
                      ? `${tie.team_a?.name || "Team A"} is yet to submit their lineup.`
                      : `${tie.team_b?.name || "Team B"} is yet to submit their lineup.`
                }
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip 
                state={isBothLocked ? "locked" : "pending"} 
                label={isBothLocked ? "Lineups Locked" : "Lineup Pending"} 
              />
              {/* Role-aware actionable next steps */}
              {viewerIsCaptainOf && !isBothLocked && (
                <button
                  type="button"
                  onClick={() => onSubmitLineup?.(viewerIsCaptainOf)}
                  className="px-3 py-1.5 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
                >
                  <Lock className="w-3.5 h-3.5" /> Submit Lineup
                </button>
              )}
              {!viewerIsCaptainOf && viewerIsOfficial && !isBothLocked && (
                <div className="flex items-center gap-1.5">
                  {!tie.lineup_locked_a && (
                    <button
                      type="button"
                      onClick={() => onEnterOnBehalf?.('A')}
                      className="px-2.5 py-1 rounded-lg border border-warning/40 bg-warning/20 hover:bg-warning/30 text-warning text-[11px] font-bold transition cursor-pointer"
                    >
                      Enter {tie.team_a?.short_name || 'Side A'}
                    </button>
                  )}
                  {!tie.lineup_locked_b && (
                    <button
                      type="button"
                      onClick={() => onEnterOnBehalf?.('B')}
                      className="px-2.5 py-1 rounded-lg border border-warning/40 bg-warning/20 hover:bg-warning/30 text-warning text-[11px] font-bold transition cursor-pointer"
                    >
                      Enter {tie.team_b?.short_name || 'Side B'}
                    </button>
                  )}
                </div>
              )}
              {/* Persistent Watcher Toggle */}
              <WatchTieButton tieId={tie.id} compact={true} />
            </div>
          </div>
        ) : (!tie.lineup_locked_a || !tie.lineup_locked_b) ? (
          <div className="p-3 bg-warning/10 border-b border-warning/20 text-warning flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-warning shrink-0" />
              <span className="font-semibold">
                {!tie.lineup_locked_a && !tie.lineup_locked_b
                  ? "Notice: Both teams are yet to submit their tiebreaker lineup."
                  : !tie.lineup_locked_a
                    ? `Notice: ${tie.team_a?.name || "Team A"} is yet to submit their tiebreaker lineup.`
                    : `Notice: ${tie.team_b?.name || "Team B"} is yet to submit their tiebreaker lineup.`
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip state="pending" label="Pending" compact={true} />
              <WatchTieButton tieId={tie.id} compact={true} />
            </div>
          </div>
        ) : null}

        {/* Scrollable Court Rubbers Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Collapsible Squads reference tray */}
          <div className="bg-background/40 rounded-2xl border border-border/80 p-3">
            <button
              type="button"
              onClick={() => setShowSquads(!showSquads)}
              className="w-full flex items-center justify-between text-xs font-bold text-soft hover:text-foreground transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Squad Rosters &amp; Bench</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>{showSquads ? "Hide Squads" : "View Squads"}</span>
                {showSquads ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            {showSquads && (
              <div className="mt-3 pt-3 border-t border-border">
                <TeamSquadView tie={tie} rubbers={rubbers} tournament={tournament} />
              </div>
            )}
          </div>

          {rubbersLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-xs text-muted-foreground mt-2 font-bold">Loading match lineup...</p>
            </div>
          ) : rubbers.length === 0 ? (
            <div className="py-12 px-4 text-center bg-muted/40 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center">
              <Swords className="w-10 h-10 text-muted-foreground mb-2" />
              <p className="font-bold text-sm text-soft">No matches announced yet for this tie</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Lineup pairings are revealed officially once captains submit their playing order and match play begins.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                {viewerIsCaptainOf && (
                  <button
                    type="button"
                    onClick={() => onSubmitLineup?.(viewerIsCaptainOf)}
                    className="px-4 py-2 rounded-xl bg-warning hover:bg-warning/90 text-xs font-black text-warning-foreground flex items-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Lock className="w-3.5 h-3.5" /> Submit your lineup
                  </button>
                )}
                {!viewerIsCaptainOf && viewerIsOfficial && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEnterOnBehalf?.('A')}
                      className="px-3 py-1.5 rounded-xl border border-warning/40 bg-warning/20 hover:bg-warning/30 text-warning text-xs font-bold transition cursor-pointer"
                    >
                      Enter {tie.team_a?.short_name || 'Side A'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnterOnBehalf?.('B')}
                      className="px-3 py-1.5 rounded-xl border border-warning/40 bg-warning/20 hover:bg-warning/30 text-warning text-xs font-bold transition cursor-pointer"
                    >
                      Enter {tie.team_b?.short_name || 'Side B'}
                    </button>
                  </>
                )}
                <WatchTieButton tieId={tie.id} />
              </div>
            </div>
          ) : (
            <div className={viewMode === 'court' ? "grid grid-cols-1 gap-4" : "space-y-3"}>
              {/* Table header for compact list view */}
              {viewMode === 'list' && (
                <div className="flex items-center gap-2 sm:gap-3 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <span className="w-12 shrink-0">Cat</span>
                  <span className="flex-1 text-right truncate">Side A</span>
                  <span className="w-14 text-center shrink-0">Score</span>
                  <span className="flex-1 text-left truncate">Side B</span>
                  <span className="w-20 text-right shrink-0">Status</span>
                </div>
              )}
              {rubbers.map((rubber: any, idx: number) => {
                const isDoubles = rubber.category.includes('D');
                const isDecider = rubber.is_decider_tiebreaker || rubber.match_code?.includes('DECIDER');
                const rubberRevealed = rubber.is_revealed || !!rubber.player1_id;
                const isCompleted = rubber.status === 'completed' || rubber.status === 'walkover';
                const isCollapsed = isCompleted && (collapsedMatches[rubber.id || idx] ?? true);

                const s1 = rubber.set1_team1 !== null ? `${rubber.set1_team1}-${rubber.set1_team2}` : null;
                const s2 = rubber.set2_team1 !== null ? `${rubber.set2_team1}-${rubber.set2_team2}` : null;
                const s3 = rubber.set3_team1 !== null ? `${rubber.set3_team1}-${rubber.set3_team2}` : null;
                const scoreString = [s1, s2, s3].filter(Boolean).join("  •  ");

                if (viewMode === 'list') {
                  const aNames = rubberRevealed
                    ? [rubber.player1?.full_name, isDoubles ? rubber.player2?.full_name : null].filter(Boolean).join(' / ') || 'Pending'
                    : 'Secret lineup';
                  const bNames = rubberRevealed
                    ? [rubber.player3?.full_name, isDoubles ? rubber.player4?.full_name : null].filter(Boolean).join(' / ') || 'Pending'
                    : 'Secret lineup';
                  return (
                    <div
                      key={rubber.id || idx}
                      className="flex items-center gap-2 sm:gap-3 px-3 sm:px-3.5 py-2.5 rounded-xl bg-card/70 border border-border hover:border-border-strong transition text-sm"
                    >
                      <span className="font-black text-[10px] px-2 py-0.5 rounded-lg bg-primary text-primary-foreground shrink-0">
                        {rubber.category}
                      </span>
                      {rubber.playing_order && (
                        <span className="hidden sm:inline text-[10px] font-bold text-accent shrink-0">#{rubber.playing_order}</span>
                      )}
                      <span className="flex-1 min-w-0 text-right truncate font-bold text-foreground">{aNames}</span>
                      <span className="font-mono text-xs font-black text-primary shrink-0 px-1.5 whitespace-nowrap">
                        {scoreString || 'vs'}
                      </span>
                      <span className="flex-1 min-w-0 text-left truncate font-bold text-foreground">{bNames}</span>
                      <StatusChip state={rubber.status} compact={true} />
                    </div>
                  );
                }

                return (
                  <div
                    key={rubber.id || idx}
                    className={`relative rounded-3xl border transition-all overflow-hidden ${
                      rubber.status === 'live' || rubber.status === 'in_progress'
                        ? "bg-card border-live/50 shadow-lg shadow-live/30 ring-1 ring-live/30"
                        : rubber.status === 'completed'
                        ? "bg-card/90 border-border-strong/80"
                        : "bg-card/70 border-border"
                    }`}
                  >
                    {/* Top Court Banner */}
                    <div className="px-4 py-2.5 bg-muted/60 border-b border-border flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-[11px] px-2 py-0.5 rounded-lg bg-primary text-primary-foreground">
                          {rubber.category}
                        </span>
                        <span className="font-bold text-soft">
                          {rubber.rubber_label || `Match ${rubber.rubber_order || (idx + 1)}`}
                        </span>
                        {rubber.playing_order && (
                          <span className="text-[10px] font-bold text-accent bg-accent/20 px-2 py-0.5 rounded-full border border-accent/30">
                            Match #{rubber.playing_order}
                          </span>
                        )}
                        {isDecider && (
                          <span className="text-[10px] font-black text-warning bg-warning/25 px-2 py-0.5 rounded-full border border-warning/30">
                            Decider
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <StatusChip state={rubber.status} compact={true} />
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => {
                              const key = rubber.id || idx;
                              setCollapsedMatches(prev => ({ ...prev, [key]: !isCollapsed }));
                            }}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
                            title={isCollapsed ? "Expand match details" : "Collapse match details"}
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Head-to-Head Visual Court Body (hidden if completed and collapsed) */}
                    {!isCollapsed && (
                    <div className="p-4 sm:p-5 bg-gradient-to-r from-background/40 via-card/20 to-background/40">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                        
                        {/* Team A Players */}
                        <div className="flex items-center gap-3 min-w-0">
                          {rubberRevealed ? (
                            <div className="space-y-1.5 min-w-0">
                              {/* Player 1 */}
                              {rubber.player1 ? (
                                <button
                                  type="button"
                                  onClick={() => openPlayerModal(rubber.player1.id)}
                                  className="flex items-center gap-2 group/p text-left cursor-pointer hover:opacity-80 transition"
                                  title="View player profile"
                                >
                                  <div className="w-8 h-8 rounded-xl bg-info/20 text-info border border-info/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                    {rubber.player1?.avatar_url ? (
                                      <img src={rubber.player1.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                    ) : (
                                      rubber.player1?.full_name?.charAt(0) || 'A'
                                    )}
                                  </div>
                                  <span className="font-bold text-sm text-foreground group-hover/p:text-primary transition-colors truncate">
                                    {rubber.player1?.full_name || 'Pending'}
                                  </span>
                                </button>
                              ) : (
                                <span className="font-bold text-sm text-muted-foreground">Pending</span>
                              )}
                              {/* Player 2 if doubles */}
                              {isDoubles && (
                                rubber.player2 ? (
                                  <button
                                    type="button"
                                    onClick={() => openPlayerModal(rubber.player2.id)}
                                    className="flex items-center gap-2 group/p text-left cursor-pointer hover:opacity-80 transition"
                                    title="View player profile"
                                  >
                                    <div className="w-8 h-8 rounded-xl bg-info/20 text-info border border-info/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                      {rubber.player2?.avatar_url ? (
                                        <img src={rubber.player2.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                      ) : (
                                        rubber.player2?.full_name?.charAt(0) || 'A'
                                      )}
                                    </div>
                                    <span className="font-bold text-sm text-foreground group-hover/p:text-primary transition-colors truncate">
                                      {rubber.player2?.full_name || 'Pending'}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="font-bold text-sm text-muted-foreground">Pending</span>
                                )
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground italic text-xs">
                              <Lock className="w-4 h-4 text-muted-foreground" />
                              <span>Secret Lineup</span>
                            </div>
                          )}
                        </div>

                        {/* Center Court Net & Score */}
                        <div className="flex flex-col items-center justify-center px-3 sm:px-6 border-x border-border/80">
                          {scoreString ? (
                            <div className="font-mono text-sm sm:text-base font-black text-primary tracking-wide whitespace-nowrap text-center">
                              {scoreString}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border-strong">
                              VS
                            </div>
                          )}
                          <span className="text-[9px] font-bold text-muted-foreground mt-1 uppercase">
                            {rubber.best_of_sets ? `Best of ${rubber.best_of_sets}` : 'Best of 3'}
                          </span>
                        </div>

                        {/* Team B Players */}
                        <div className="flex items-center justify-end gap-3 min-w-0 text-right">
                          {rubberRevealed ? (
                            <div className="space-y-1.5 min-w-0">
                              {/* Player 3 */}
                              {rubber.player3 ? (
                                <button
                                  type="button"
                                  onClick={() => openPlayerModal(rubber.player3.id)}
                                  className="flex items-center justify-end gap-2 group/p text-right cursor-pointer hover:opacity-80 transition w-full"
                                  title="View player profile"
                                >
                                  <span className="font-bold text-sm text-foreground group-hover/p:text-primary transition-colors truncate">
                                    {rubber.player3?.full_name || 'Pending'}
                                  </span>
                                  <div className="w-8 h-8 rounded-xl bg-warning/20 text-warning border border-warning/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                    {rubber.player3?.avatar_url ? (
                                      <img src={rubber.player3.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                    ) : (
                                      rubber.player3?.full_name?.charAt(0) || 'B'
                                    )}
                                  </div>
                                </button>
                              ) : (
                                <span className="font-bold text-sm text-muted-foreground">Pending</span>
                              )}
                              {/* Player 4 if doubles */}
                              {isDoubles && (
                                rubber.player4 ? (
                                  <button
                                    type="button"
                                    onClick={() => openPlayerModal(rubber.player4.id)}
                                    className="flex items-center justify-end gap-2 group/p text-right cursor-pointer hover:opacity-80 transition w-full"
                                    title="View player profile"
                                  >
                                    <span className="font-bold text-sm text-foreground group-hover/p:text-primary transition-colors truncate">
                                      {rubber.player4?.full_name || 'Pending'}
                                    </span>
                                    <div className="w-8 h-8 rounded-xl bg-warning/20 text-warning border border-warning/30 flex items-center justify-center font-bold text-xs shrink-0 group-hover/p:ring-2 group-hover/p:ring-primary/40">
                                      {rubber.player4?.avatar_url ? (
                                        <img src={rubber.player4.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                                      ) : (
                                        rubber.player4?.full_name?.charAt(0) || 'B'
                                      )}
                                    </div>
                                  </button>
                                ) : (
                                  <span className="font-bold text-sm text-muted-foreground">Pending</span>
                                )
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground italic text-xs">
                              <span>Secret Lineup</span>
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                    )}

                    {/* Revealer / Timestamp info footer if revealed */}
                    {rubber.revealed_at && rubber.revealer && (
                      <div className="px-4 py-1.5 bg-background/60 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-primary" />
                          Revealed by: <strong className="text-soft">{rubber.revealer.full_name}</strong>
                        </span>
                        <span>{new Date(rubber.revealed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Audit trail alert if any substitutions occurred */}
          {audits.length > 0 && (
            <div className="mt-4 p-3.5 rounded-2xl bg-warning/10 border border-warning/25 text-xs text-warning space-y-1.5">
              <div className="font-black flex items-center gap-1.5 text-warning">
                <ShieldAlert className="w-4 h-4" /> Official Player Substitution Notice
              </div>
              {audits.map((a: any) => (
                <div key={a.id} className="text-[11px] text-soft">
                  Rubber #{a.rubber_order} ({a.side}): <strong className="text-warning">{a.repl_player?.full_name}</strong> substituted for {a.orig_player?.full_name}. Authorized by referee {a.referee?.full_name} with dual captain consent. Reason: "{a.reason}"
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-card/90 flex justify-between items-center shrink-0">
          <span className="text-xs text-muted-foreground font-bold">
            Total Rubbers: {rubbers.length}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-muted hover:bg-muted-strong text-foreground font-bold text-xs rounded-full transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
