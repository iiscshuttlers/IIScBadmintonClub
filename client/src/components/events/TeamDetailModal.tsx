import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Shield, 
  Crown, 
  Users, 
  Loader2, 
  Swords, 
  Radio, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Trophy,
  Activity
} from "lucide-react";
import { Link } from "wouter";
import { teamService } from "@/services/teamService";
import { playerService } from "@/services/playerService";
import { resolveMemberGender } from "@/components/events/TeamRosterModalHelper";
import { usePlayerModal } from "@/contexts/PlayerModalContext";
import { TeamLogo } from "@/components/events/TeamLogo";

export interface TeamDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    name: string;
    short_name?: string | null;
    pool?: string | null;
    captain_id?: string | null;
    tournament_id?: string | null;
    logo_url?: string | null;
  } | null;
  tournamentId?: string;
  initialTab?: "roster" | "matches";
}

interface TeamMemberItem {
  id: string;
  player_id: string;
  role: string;
  is_captain: boolean;
  gender: "Male" | "Female";
  player: {
    id: string;
    full_name: string;
    email?: string | null;
    gender?: string | null;
    is_guest?: boolean | null;
    avatar_url?: string | null;
    elo_rating?: number | null;
  };
}

interface TieMatchItem {
  id: string;
  tie_id: string;
  match_code: string;
  category: string;
  rubber_order: number;
  rubber_label: string;
  playing_order?: number | null;
  status: string;
  winner_side?: number | null;
  /** Already formatted, e.g. "21-17, 20-22, 21-15". */
  score?: string | null;
  player1?: { full_name: string } | null;
  player2?: { full_name: string } | null;
  player3?: { full_name: string } | null;
  player4?: { full_name: string } | null;
}

interface TeamTieItem {
  id: string;
  tie_code: string;
  round_name: string;
  stage: string;
  state: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  score_team_a: number;
  score_team_b: number;
  winner_team_id?: string | null;
  created_at?: string;
  team_a: { id: string; name: string; short_name?: string | null; logo_url?: string | null };
  team_b: { id: string; name: string; short_name?: string | null; logo_url?: string | null };
  rubbers?: TieMatchItem[];
}

export function TeamDetailModal({ 
  isOpen, 
  onClose, 
  team, 
  tournamentId,
  initialTab = "roster" 
}: TeamDetailModalProps) {
  const { openPlayerModal } = usePlayerModal();
  const [activeTab, setActiveTab] = useState<"roster" | "matches">(initialTab);
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [ties, setTies] = useState<TeamTieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<"ALL" | "Male" | "Female">("ALL");

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !team?.id) {
      setMembers([]);
      setTies([]);
      return;
    }

    let isMounted = true;
    async function loadTeamData() {
      setLoading(true);
      try {
        // 1. Fetch team record to verify captain_id and details
        const teamRec = await teamService.getTeamDetailRecord(team!.id);

        const captainId = teamRec?.captain_id || team!.captain_id;

        // 2. Fetch team members with joined player info
        const rawMembers = await teamService.getActiveTeamMembersWithCards(team!.id);

        const list: TeamMemberItem[] = (rawMembers || [])
          .filter((m: any) => m.player)
          .map((m: any) => {
            const isCap = m.role === "CAPTAIN" || m.player_id === captainId;
            const resolvedGender = resolveMemberGender(m.player.gender, m.player.full_name);
            return {
              id: m.id,
              player_id: m.player_id,
              role: isCap ? "CAPTAIN" : m.role || "PLAYER",
              is_captain: isCap,
              gender: resolvedGender,
              player: m.player
            };
          });

        // 3. If captain is designated on team but not present in tournament_team_members list, fetch and prepend captain
        if (captainId && !list.some(m => m.player_id === captainId)) {
          const captainPlayer = await playerService.getRosterCard(captainId);

          if (captainPlayer) {
            list.unshift({
              id: `captain-${captainPlayer.id}`,
              player_id: captainPlayer.id,
              role: "CAPTAIN",
              is_captain: true,
              gender: resolveMemberGender(captainPlayer.gender, captainPlayer.full_name),
              player: captainPlayer
            });
          }
        }

        // Sort: Captain ALWAYS first, then alphabetical
        list.sort((a, b) => {
          if (a.is_captain && !b.is_captain) return -1;
          if (!a.is_captain && b.is_captain) return 1;
          return a.player.full_name.localeCompare(b.player.full_name);
        });

        // 4. Fetch ties involving this team
        const rawTies = await teamService.getTeamTiesWithScores(team!.id);

        const priority = (state: string) => {
          if (state === 'IN_PROGRESS') return 0;
          if (state === 'COMPLETED') return 2;
          return 1;
        };

        const formattedTies: TeamTieItem[] = ((rawTies || []) as any).sort((a: any, b: any) => {
          const pA = priority(a.state);
          const pB = priority(b.state);
          if (pA !== pB) return pA - pB;
          return a.tie_code.localeCompare(b.tie_code);
        });

        // Fetch rubbers for these ties if any exist
        if (formattedTies.length > 0) {
          const tieIds = formattedTies.map(t => t.id);
          const rawRubbers = await teamService.getTieRubberSummaries(tieIds);

          const rubbersByTie = new Map<string, TieMatchItem[]>();
          (rawRubbers || []).forEach((r: any) => {
            if (!rubbersByTie.has(r.tie_id)) rubbersByTie.set(r.tie_id, []);
            rubbersByTie.get(r.tie_id)!.push(r);
          });

          formattedTies.forEach(t => {
            const rList = rubbersByTie.get(t.id) || [];
            rList.sort((a, b) => (a.playing_order ?? a.rubber_order) - (b.playing_order ?? b.rubber_order));
            t.rubbers = rList;
          });
        }

        if (isMounted) {
          setMembers(list);
          setTies(formattedTies);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load team details:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadTeamData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, team?.id]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const counts = useMemo(() => {
    const m = members.filter(i => i.gender === "Male").length;
    const f = members.filter(i => i.gender === "Female").length;
    return { male: m, female: f, total: members.length };
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (genderFilter === "ALL") return members;
    return members.filter(m => m.gender === genderFilter);
  }, [members, genderFilter]);

  // Categorize matches: Live first, Upcoming next, Completed last
  const categorizedMatches = useMemo(() => {
    const live: TeamTieItem[] = [];
    const upcoming: TeamTieItem[] = [];
    const completed: TeamTieItem[] = [];

    ties.forEach(t => {
      if (t.state === 'IN_PROGRESS') {
        live.push(t);
      } else if (t.state === 'COMPLETED') {
        completed.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { live, upcoming, completed, total: ties.length };
  }, [ties]);

  if (!isOpen || !team) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] bg-background/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="max-w-2xl w-full max-h-[92vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Hero */}
        <div className="p-5 pb-4 border-b border-border bg-card/80 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <TeamLogo
                name={team.name}
                shortName={team.short_name}
                logoUrl={team.logo_url}
                size="lg"
              />
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight truncate">
                    {team.name}
                  </h2>
                  {team.short_name && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-soft">
                      {team.short_name}
                    </span>
                  )}
                  {team.pool && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                      Pool {team.pool}
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-2">
                  <span>{counts.total} Registered Players</span>
                  <span>•</span>
                  <span>{categorizedMatches.total} Tournament Fixtures</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/team-hub/${team.id}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-muted hover:bg-muted-strong text-soft text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-border-strong"
                  title="Open Team Hub to manage team, rosters and lineups"
                >
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Team Hub</span>
                </button>
              </Link>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-soft hover:bg-muted rounded-full transition-colors shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Squad Roster vs Fixtures/Matches) */}
          <div className="mt-4 flex items-center gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px ${
                activeTab === "roster"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-soft"
              }`}
            >
              <Users className="w-4 h-4" />
              Squad Roster ({counts.total})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("matches")}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-black transition-all border-b-2 -mb-px ${
                activeTab === "matches"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-soft"
              }`}
            >
              <Swords className="w-4 h-4" />
              Fixtures & Matches ({categorizedMatches.total})
              {categorizedMatches.live.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-live animate-ping inline-block" />
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: Squad Roster */}
        {activeTab === "roster" && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Quick Filter Bar */}
            <div className="p-3 sm:px-5 border-b border-border bg-card/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setGenderFilter("ALL")}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${
                    genderFilter === "ALL"
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/90"
                  }`}
                >
                  All ({counts.total})
                </button>
                <button
                  onClick={() => setGenderFilter("Male")}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                    genderFilter === "Male"
                      ? "bg-info text-info-foreground shadow-sm"
                      : "bg-info/15 text-info hover:bg-info/10 border border-info/25"
                  }`}
                >
                  <span>♂ Male</span>
                  <span className="opacity-80">({counts.male})</span>
                </button>
                <button
                  onClick={() => setGenderFilter("Female")}
                  className={`text-xs font-bold px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                    genderFilter === "Female"
                      ? "bg-danger text-danger-foreground shadow-sm"
                      : "bg-danger/15 text-danger hover:bg-danger/10 border border-danger/25"
                  }`}
                >
                  <span>♀ Female</span>
                  <span className="opacity-80">({counts.female})</span>
                </button>
              </div>

              <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                {filteredMembers.length} displayed
              </div>
            </div>

            {/* Scrollable Members List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loading Squad...</p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-16 bg-muted/40 rounded-2xl border border-dashed border-border">
                  <Users className="w-10 h-10 text-faint mx-auto mb-2" />
                  <p className="font-bold text-sm text-soft">
                    {genderFilter !== "ALL" ? `No ${genderFilter} players found` : "No players registered in this team yet"}
                  </p>
                </div>
              ) : (
                filteredMembers.map((member) => {
                  const isFemale = member.gender === "Female";
                  const isCaptain = member.is_captain;

                  return (
                    <div
                      key={member.id}
                      onClick={() => openPlayerModal(member.player.id || member.player_id)}
                      className={`relative p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer hover:shadow-md hover:scale-[1.008] active:scale-[0.99] ${
                        isCaptain
                          ? "bg-gradient-to-r from-warning/15 via-warning/5 to-transparent border-2 border-warning/60 shadow-sm hover:border-warning"
                          : isFemale
                          ? "bg-danger/10 border border-danger/25 hover:border-danger"
                          : "bg-info/10 border border-info/25 hover:border-info"
                      }`}
                      title="Click to view player stats & profile"
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                            isCaptain
                              ? "bg-warning text-warning-foreground ring-2 ring-warning/50"
                              : isFemale
                              ? "bg-danger/25 text-danger ring-2 ring-danger/40"
                              : "bg-info/25 text-info ring-2 ring-info/40"
                          }`}
                        >
                          {isCaptain ? (
                            <Crown className="w-5 h-5 fill-current" />
                          ) : member.player.avatar_url ? (
                            <img src={member.player.avatar_url} alt="" className="w-full h-full rounded-2xl object-cover" />
                          ) : (
                            member.player.full_name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                              {member.player.full_name}
                            </span>
                            {isCaptain && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold text-gold-foreground shadow-xs">
                                <Crown className="w-3 h-3 fill-current" />
                                Captain
                              </span>
                            )}
                            {member.player.is_guest && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted-strong text-soft">
                                Guest
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate mt-0.5">
                            {member.player.elo_rating && (
                              <span>Rating: <strong className="text-soft">{member.player.elo_rating}</strong></span>
                            )}
                            {member.player.email && (
                              <span className="truncate opacity-75">{member.player.email}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Gender Pill Badge */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isFemale ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-danger/20 text-danger border border-danger/40 shadow-2xs">
                            <span>♀</span>
                            <span>Female</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-info/20 text-info border border-info/40 shadow-2xs">
                            <span>♂</span>
                            <span>Male</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Team Matches & Ties (Live first, Upcoming next, Completed last) */}
        {activeTab === "matches" && (
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loading Fixtures...</p>
              </div>
            ) : categorizedMatches.total === 0 ? (
              <div className="text-center py-16 bg-muted/40 rounded-2xl border border-dashed border-border">
                <Calendar className="w-10 h-10 text-faint mx-auto mb-2" />
                <p className="font-bold text-sm text-soft">No fixtures scheduled for this team yet</p>
                <p className="text-xs text-muted-foreground mt-1">Fixtures will appear once the tournament schedule is generated.</p>
              </div>
            ) : (
              <>
                {/* 1. LIVE MATCHES (FIRST) */}
                {categorizedMatches.live.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-live">
                      <Radio className="w-4 h-4 animate-pulse" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Live on Court ({categorizedMatches.live.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categorizedMatches.live.map((tie) => (
                        <TieMatchCard key={tie.id} tie={tie} currentTeamId={team.id} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. UPCOMING MATCHES (NEXT) */}
                {categorizedMatches.upcoming.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Clock className="w-4 h-4" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Upcoming Fixtures ({categorizedMatches.upcoming.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categorizedMatches.upcoming.map((tie) => (
                        <TieMatchCard key={tie.id} tie={tie} currentTeamId={team.id} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. COMPLETED MATCHES (LAST) */}
                {categorizedMatches.completed.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4" />
                      <h3 className="text-xs font-black uppercase tracking-wider">
                        Completed Results ({categorizedMatches.completed.length})
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {categorizedMatches.completed.map((tie) => (
                        <TieMatchCard key={tie.id} tie={tie} currentTeamId={team.id} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card/50 flex justify-between items-center shrink-0">
          <span className="text-[11px] font-bold text-muted-foreground">
            {team.pool ? `Pool ${team.pool}` : "IISc Badminton Tournament"}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-muted text-foreground hover:bg-muted-strong font-bold text-xs rounded-full transition shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Single Tie Match Card inside the team modal
function TieMatchCard({ tie, currentTeamId }: { tie: TeamTieItem; currentTeamId: string }) {
  const isTeamA = tie.team_a?.id === currentTeamId;
  const opponent = isTeamA ? tie.team_b : tie.team_a;
  const currentTeam = isTeamA ? tie.team_a : tie.team_b;
  const myScore = isTeamA ? tie.score_team_a : tie.score_team_b;
  const oppScore = isTeamA ? tie.score_team_b : tie.score_team_a;

  const isLive = tie.state === 'IN_PROGRESS';
  const isCompleted = tie.state === 'COMPLETED';
  const isWin = isCompleted && tie.winner_team_id === currentTeamId;
  const isLoss = isCompleted && tie.winner_team_id && tie.winner_team_id !== currentTeamId;
  const isDraw = isCompleted && !tie.winner_team_id;

  const [expanded, setExpanded] = useState(isLive);

  return (
    <div className={`p-4 rounded-2xl border transition-all ${
      isLive
        ? "bg-live/10 border-live/40 shadow-sm"
        : isCompleted
        ? isWin
          ? "bg-success/10 border-success/30"
          : "bg-muted/40 border-border"
        : "bg-muted/30 border-border"
    }`}>
      <div className="flex items-center justify-between gap-3">
        {/* Stage & Round Info */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-muted text-soft">
            {tie.tie_code}
          </span>
          <span className="text-xs font-bold text-muted-foreground uppercase">
            {tie.round_name || tie.stage}
          </span>
        </div>

        {/* State / Result Badge */}
        <div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-live text-live-foreground animate-pulse">
              <Radio className="w-3 h-3" /> LIVE NOW
            </span>
          ) : isCompleted ? (
            isWin ? (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-success text-success-foreground">
                WON ({myScore} - {oppScore})
              </span>
            ) : isLoss ? (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-danger/20 text-danger border border-danger/30">
                LOST ({myScore} - {oppScore})
              </span>
            ) : (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-muted-strong text-soft">
                DRAW ({myScore} - {oppScore})
              </span>
            )
          ) : (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              SCHEDULED
            </span>
          )}
        </div>
      </div>

      {/* Opponent & Matchup */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold text-muted-foreground">vs</div>
          <div>
            <h4 className="font-black text-sm text-foreground">
              {opponent?.name || "TBD / BYE"}
            </h4>
            {opponent?.short_name && (
              <span className="text-[10px] font-bold text-muted-foreground">
                {opponent.short_name}
              </span>
            )}
          </div>
        </div>

        {/* Tie Score */}
        <div className="text-right">
          <div className="text-base font-black tracking-tight text-foreground">
            <span className={isWin ? "text-success" : ""}>{myScore}</span>
            <span className="mx-1 text-muted-foreground">-</span>
            <span className={isLoss ? "text-danger" : ""}>{oppScore}</span>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Tie Score</span>
        </div>
      </div>

      {/* Rubber Matches details toggle */}
      {tie.rubbers && tie.rubbers.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/60">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-soft"
          >
            <span>Rubbers Breakdown ({tie.rubbers.length} Matches)</span>
            <span className="text-[11px] text-primary">{expanded ? "Hide ▲" : "View Rubbers ▼"}</span>
          </button>

          {expanded && (
            <div className="mt-2.5 space-y-2">
              {tie.rubbers.map((rubber) => {
                // tournament_matches has no per-set columns; `score` is the
                // stored "21-17, 20-22, 21-15" string.
                const scoreStr = rubber.score?.trim() || "";

                return (
                  <div 
                    key={rubber.id} 
                    className="p-2 rounded-xl bg-card/60 border border-border flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {rubber.category}
                      </span>
                      <span className="font-semibold text-soft">
                        {rubber.rubber_label || `Rubber #${rubber.rubber_order}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {scoreStr ? (
                        <span className="font-mono font-bold text-foreground">
                          {scoreStr}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {rubber.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
