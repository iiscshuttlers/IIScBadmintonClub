import { useState, useEffect, useMemo } from "react";
import { 
  Shield, 
  Crown, 
  Users, 
  ChevronDown, 
  Briefcase, 
  Award, 
  Search, 
  Loader2, 
  Layers,
  ExternalLink,
  Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { teamService, tournamentService, playerService } from "@/services";
import { resolveMemberGender } from "@/components/events/TeamRosterModalHelper";
import { useTeamModal } from "@/contexts/TeamModalContext";
import { usePlayerModal } from "@/contexts/PlayerModalContext";
import { calculateMinRosterRequirements, RosterRequirementResult } from "@/lib/teamLineupRules";
import { TeamLogo } from "@/components/events/TeamLogo";


export type MemberRole = "MANAGER" | "CAPTAIN" | "VICE_CAPTAIN" | "PLAYER";

export interface TeamMemberItem {
  id: string;
  player_id: string;
  role: MemberRole;
  is_manager: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  gender: "Male" | "Female";
  player: {
    id: string;
    full_name: string;
    email?: string | null;
    gender?: string | null;
    is_guest?: boolean | null;
    avatar_url?: string | null;
  };
}

export interface TeamWithMembers {
  id: string;
  tournament_id: string;
  name: string;
  short_name?: string | null;
  pool?: string | null;
  seed?: number | null;
  captain_id?: string | null;
  status: string;
  members: TeamMemberItem[];
}

interface LiveTeamsSectionProps {
  tournamentId?: string;
  showParticipants?: boolean | null;
}

function normalizeRole(rawRole?: string | null, isTeamCaptain?: boolean): MemberRole {
  const r = (rawRole || "").trim().toUpperCase();
  if (r === "MANAGER" || r === "TEAM_MANAGER" || r === "COACH") return "MANAGER";
  if (r === "CAPTAIN" || isTeamCaptain) return "CAPTAIN";
  if (r === "VICE_CAPTAIN" || r === "VICE-CAPTAIN" || r === "VICE CAPTAIN" || r === "VC") return "VICE_CAPTAIN";
  return "PLAYER";
}

function getRoleRank(role: MemberRole): number {
  switch (role) {
    case "MANAGER": return 1;
    case "CAPTAIN": return 2;
    case "VICE_CAPTAIN": return 3;
    case "PLAYER": return 4;
    default: return 5;
  }
}

export function LiveTeamsSection({ tournamentId, showParticipants }: LiveTeamsSectionProps) {
  const { openTeamModal } = useTeamModal();
  const { openPlayerModal } = usePlayerModal();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [rosterRequirements, setRosterRequirements] = useState<RosterRequirementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPool, setSelectedPool] = useState<string>("ALL");


  useEffect(() => {
    if (!tournamentId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadTeamsAndMembers() {
      setLoading(true);
      try {
        // 0. Fetch tournament config for dynamic roster calculation
        const tourneyData = await tournamentService.fetchTournamentById(tournamentId).catch(() => null);

        // 1. Fetch teams
        const validTeams = await teamService.getTeamsForLiveDisplay(tournamentId);

        // 2. Fetch members with joined player info
        const rawMembers = await teamService.getTournamentTeamMembers(tournamentId);

        // Group members by team_id
        const membersByTeam: Record<string, TeamMemberItem[]> = {};
        for (const t of validTeams) {
          membersByTeam[t.id] = [];
        }

        const captainIdsToFetch: string[] = [];

        (rawMembers || []).forEach((m: any) => {
          if (!m.player || !membersByTeam[m.team_id]) return;
          const targetTeam = validTeams.find(t => t.id === m.team_id);
          const isCap = targetTeam?.captain_id === m.player_id || m.role === "CAPTAIN";
          const role = normalizeRole(m.role, isCap);
          const resolvedGender = resolveMemberGender(m.player.gender, m.player.full_name);

          membersByTeam[m.team_id].push({
            id: m.id,
            player_id: m.player_id,
            role,
            is_manager: role === "MANAGER",
            is_captain: role === "CAPTAIN",
            is_vice_captain: role === "VICE_CAPTAIN",
            gender: resolvedGender,
            player: m.player,
          });
        });

        // Check if any team has a captain_id not yet included in members
        for (const t of validTeams) {
          if (t.captain_id && !membersByTeam[t.id].some(m => m.player_id === t.captain_id)) {
            captainIdsToFetch.push(t.captain_id);
          }
        }

        // Fetch missing captains if any
        if (captainIdsToFetch.length > 0) {
          const captainPlayers = await playerService.getPlayersByIds(captainIdsToFetch);

          if (captainPlayers) {
            const capMap = new Map(captainPlayers.map(p => [p.id, p]));
            for (const t of validTeams) {
              if (t.captain_id && !membersByTeam[t.id].some(m => m.player_id === t.captain_id)) {
                const player = capMap.get(t.captain_id);
                if (player) {
                  membersByTeam[t.id].unshift({
                    id: `captain-${player.id}`,
                    player_id: player.id,
                    role: "CAPTAIN",
                    is_manager: false,
                    is_captain: true,
                    is_vice_captain: false,
                    gender: resolveMemberGender(player.gender, player.full_name),
                    player,
                  });
                }
              }
            }
          }
        }

        // Sort members for each team:
        // Rank 1: Manager
        // Rank 2: Captain
        // Rank 3: Vice-Captain
        // Rank 4: Players (alphabetical)
        const assembled: TeamWithMembers[] = validTeams.map(t => {
          const mList = membersByTeam[t.id] || [];
          mList.sort((a, b) => {
            const rankA = getRoleRank(a.role);
            const rankB = getRoleRank(b.role);
            if (rankA !== rankB) return rankA - rankB;
            return a.player.full_name.localeCompare(b.player.full_name);
          });

          return {
            ...t,
            members: mList,
          };
        });

        if (isMounted) {
          if (tourneyData) {
            const rawFormat: any = tourneyData.tie_format_config;
            let currentRubbers: any[] = [];
            if (Array.isArray(rawFormat)) currentRubbers = rawFormat;
            else if (rawFormat?.rubbers && Array.isArray(rawFormat.rubbers)) currentRubbers = rawFormat.rubbers;

            const rulesObj = typeof rawFormat === 'object' && !Array.isArray(rawFormat) ? rawFormat : {};
            if (currentRubbers.length > 0) {
              const req = calculateMinRosterRequirements(currentRubbers, {
                max_rubbers_per_male: rulesObj.max_rubbers_per_male ?? tourneyData.max_rubbers_per_player ?? 2,
                max_rubbers_per_female: rulesObj.max_rubbers_per_female ?? tourneyData.max_rubbers_per_player ?? 2,
                allow_same_discipline_repeat: rulesObj.allow_same_discipline_repeat ?? false,
                ignore_gender_rules: tourneyData.ignore_gender_rules,
                team_roster_min: tourneyData.team_roster_min
              });
              setRosterRequirements(req);
            }
          }

          setTeams(assembled);
          // By default, expand the first team for immediate feedback
          if (assembled.length > 0) {
            setExpandedTeamIds(new Set([assembled[0].id]));
          }
          setLoading(false);
        }

      } catch (err) {
        console.error("Failed to load tournament teams:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadTeamsAndMembers();

    return () => {
      isMounted = false;
    };
  }, [tournamentId]);

  // Distinct pools
  const pools = useMemo(() => {
    const s = new Set<string>();
    teams.forEach(t => {
      if (t.pool) s.add(t.pool);
    });
    return Array.from(s).sort();
  }, [teams]);

  // Filter teams by search & pool
  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teams.filter(team => {
      if (selectedPool !== "ALL" && team.pool !== selectedPool) return false;
      if (!q) return true;

      // Match team name or short name
      if (team.name.toLowerCase().includes(q)) return true;
      if (team.short_name?.toLowerCase().includes(q)) return true;

      // Match any player name inside the team
      return team.members.some(m => m.player.full_name.toLowerCase().includes(q));
    });
  }, [teams, selectedPool, searchQuery]);

  // Total stats
  const totalStats = useMemo(() => {
    let totalPlayers = 0;
    let maleCount = 0;
    let femaleCount = 0;
    teams.forEach(t => {
      totalPlayers += t.members.length;
      t.members.forEach(m => {
        if (m.gender === "Male") maleCount++;
        else femaleCount++;
      });
    });
    return { teamsCount: teams.length, totalPlayers, maleCount, femaleCount };
  }, [teams]);

  // Toggle single team expand
  const toggleTeam = (teamId: string) => {
    setExpandedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  // Expand / Collapse all
  const toggleAll = () => {
    if (expandedTeamIds.size === filteredTeams.length) {
      setExpandedTeamIds(new Set());
    } else {
      setExpandedTeamIds(new Set(filteredTeams.map(t => t.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Loading Teams & Squads...</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-16 bg-card rounded-3xl border border-border p-8 shadow-sm">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
          <Shield className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-soft mb-1">
          No Teams Registered Yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Tournament teams and player rosters will appear here once configured by tournament organizers.
        </p>
      </div>
    );
  }

  const allExpanded = filteredTeams.length > 0 && expandedTeamIds.size === filteredTeams.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 p-4 sm:p-5 rounded-3xl border border-border shadow-xs">
        {/* Left: Summary Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-black">
            <Shield className="w-3.5 h-3.5" />
            {totalStats.teamsCount} Teams
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-soft text-xs font-bold">
            <Users className="w-3.5 h-3.5" />
            {totalStats.totalPlayers} Players
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-info/15 text-info text-xs font-bold border border-info/25">
            <span>♂</span>
            <span>{totalStats.maleCount}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger/15 text-danger text-xs font-bold border border-danger/25">
            <span>♀</span>
            <span>{totalStats.femaleCount}</span>
          </span>
        </div>

        {/* Right: Search & Expand All */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search team or player..."
              className="w-full pl-9 pr-4 py-2 bg-muted border border-border-strong rounded-full text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition shadow-2xs"
            />
          </div>

          <button
            onClick={toggleAll}
            className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold bg-muted hover:bg-muted-strong text-soft border border-border-strong transition shadow-2xs flex items-center gap-1.5"
            title={allExpanded ? "Collapse all teams" : "Expand all teams"}
          >
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{allExpanded ? "Collapse All" : "Expand All"}</span>
          </button>
        </div>
      </div>

      {/* Pool Filter Chips (if tournament has pools) */}
      {pools.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedPool("ALL")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
              selectedPool === "ALL"
                ? "bg-foreground text-background shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted-strong"
            }`}
          >
            All Pools ({teams.length})
          </button>
          {pools.map(p => {
            const count = teams.filter(t => t.pool === p).length;
            return (
              <button
                key={p}
                onClick={() => setSelectedPool(p)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                  selectedPool === p
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted-strong"
                }`}
              >
                Pool {p} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Teams Accordion List */}
      <div className="space-y-4">
        {filteredTeams.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-dashed border-border">
            <Users className="w-10 h-10 text-faint mx-auto mb-2" />
            <p className="font-bold text-sm text-soft">
              No teams matching "{searchQuery}"
            </p>
            <p className="text-xs text-muted-foreground mt-1">Try clearing your search query or switching pools.</p>
          </div>
        ) : (
          filteredTeams.map((team) => {
            const isExpanded = expandedTeamIds.has(team.id);
            const mCount = team.members.filter(m => m.gender === "Male").length;
            const fCount = team.members.filter(m => m.gender === "Female").length;
            const captain = team.members.find(m => m.is_captain);
            const manager = team.members.find(m => m.is_manager);

            return (
              <div
                key={team.id}
                className={`bg-card rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  isExpanded
                    ? "border-primary/40 ring-1 ring-primary/20 shadow-md"
                    : "border-border hover:border-border-strong"
                }`}
              >
                {/* Team Card Header (Clickable Accordion Trigger) */}
                <button
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left transition-colors hover:bg-muted/40 select-none cursor-pointer"
                >
                  {/* Left: Team Name & Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <TeamLogo
                      name={team.name}
                      shortName={team.short_name}
                      size="md"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 
                          onClick={(e) => {
                            e.stopPropagation();
                            openTeamModal({ id: team.id, name: team.name, short_name: team.short_name, pool: team.pool, captain_id: team.captain_id, tournament_id: team.tournament_id });
                          }}
                          className="font-black text-base sm:text-lg text-foreground leading-tight hover:text-primary transition-colors cursor-pointer hover:underline underline-offset-2 flex items-center gap-1.5 group"
                          title="Click to view full team roster and live/upcoming/completed matches"
                        >
                          {team.name}
                          <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </h4>
                        {team.short_name && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-soft">
                            {team.short_name}
                          </span>
                        )}
                        {team.pool && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/25">
                            Pool {team.pool}
                          </span>
                        )}
                      </div>

                      {/* Captain & Manager preview line when collapsed */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        {manager && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPlayerModal(manager.player.id || manager.player_id);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-individual hover:underline cursor-pointer"
                          >
                            <Briefcase className="w-3 h-3" />
                            Mgr: {manager.player.full_name}
                          </button>
                        )}
                        {manager && captain && <span>·</span>}
                        {captain && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPlayerModal(captain.player.id || captain.player_id);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-warning hover:underline cursor-pointer"
                          >
                            <Crown className="w-3 h-3 fill-current" />
                            Capt: {captain.player.full_name}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Squad Stats & Chevron */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <span className={`px-2.5 py-1 rounded-full ${
                        rosterRequirements && team.members.length < rosterRequirements.minTotalPlayers
                          ? "bg-warning/15 text-warning border border-warning/25"
                          : "bg-muted text-soft"
                      }`}>
                        {team.members.length}{rosterRequirements ? `/${rosterRequirements.minTotalPlayers}` : ''} players
                      </span>
                      <span className={`px-2 py-1 rounded-full text-[11px] border ${
                        rosterRequirements && mCount < rosterRequirements.minMalePlayers
                          ? "bg-danger/15 text-danger border-danger/40"
                          : "bg-info/15 text-info border-info/25"
                      }`}>
                        ♂ {mCount}{rosterRequirements ? `/${rosterRequirements.minMalePlayers}` : ''}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-[11px] border ${
                        rosterRequirements && fCount < rosterRequirements.minFemalePlayers
                          ? "bg-danger/15 text-danger border-danger/40"
                          : "bg-danger/15 text-danger border-danger/25"
                      }`}>
                        ♀ {fCount}{rosterRequirements ? `/${rosterRequirements.minFemalePlayers}` : ''}
                      </span>
                      {rosterRequirements && (
                        (fCount < rosterRequirements.minFemalePlayers) ? (
                          <span className="text-[10px] font-bold text-danger bg-danger/20 px-2 py-0.5 rounded-full border border-danger/40">
                            Needs {rosterRequirements.minFemalePlayers - fCount}♀
                          </span>
                        ) : (mCount < rosterRequirements.minMalePlayers) ? (
                          <span className="text-[10px] font-bold text-info bg-info/20 px-2 py-0.5 rounded-full border border-info/40">
                            Needs {rosterRequirements.minMalePlayers - mCount}♂
                          </span>
                        ) : null
                      )}
                    </div>


                    <div className={`p-1.5 rounded-full bg-muted text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-180 bg-primary/10 text-primary" : ""
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {/* Expanded Squad Members List */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key={`content-${team.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden border-t border-border/80 bg-card/40"
                    >
                      <div className="p-4 sm:p-5 space-y-2.5">
                        <button
                          type="button"
                          onClick={() => openTeamModal({ id: team.id, name: team.name, short_name: team.short_name, pool: team.pool, captain_id: team.captain_id, tournament_id: team.tournament_id })}
                          className="w-full mb-3 py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black flex items-center justify-center gap-1.5 transition-colors border border-primary/20 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Team Roster & Schedule (Live · Upcoming · Completed)
                        </button>
                        {team.members.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground font-semibold">
                            No players assigned to this team yet.
                          </div>
                        ) : (
                          team.members.map((member) => {
                            const isManager = member.is_manager;
                            const isCaptain = member.is_captain;
                            const isViceCaptain = member.is_vice_captain;
                            const isFemale = member.gender === "Female";

                            return (
                              <div
                                key={member.id}
                                onClick={() => openPlayerModal(member.player.id || member.player_id)}
                                className={`p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer hover:shadow-md hover:scale-[1.005] active:scale-[0.99] ${
                                  isManager
                                    ? "bg-gradient-to-r from-individual/15 via-individual/5 to-transparent border-2 border-individual/60 shadow-xs hover:border-individual"
                                    : isCaptain
                                    ? "bg-gradient-to-r from-warning/15 via-warning/5 to-transparent border-2 border-warning/60 shadow-xs hover:border-warning"
                                    : isViceCaptain
                                    ? "bg-gradient-to-r from-info/15 via-info/5 to-transparent border-2 border-info/60 shadow-xs hover:border-info"
                                    : isFemale
                                    ? "bg-danger/10 border border-danger/25 hover:border-danger"
                                    : "bg-info/10 border border-info/25 hover:border-info"
                                }`}
                                title="Click to view player stats & profile"
                              >
                                {/* Left: Avatar & Member Info */}
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Avatar */}
                                  <div
                                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                                      isManager
                                        ? "bg-individual text-individual-foreground ring-2 ring-individual/50"
                                        : isCaptain
                                        ? "bg-warning text-warning-foreground ring-2 ring-warning/50"
                                        : isViceCaptain
                                        ? "bg-info text-info-foreground ring-2 ring-info/50"
                                        : isFemale
                                        ? "bg-danger/25 text-danger ring-2 ring-danger/40"
                                        : "bg-info/25 text-info ring-2 ring-info/40"
                                    }`}
                                  >
                                    {isManager ? (
                                      <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />
                                    ) : isCaptain ? (
                                      <Crown className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                                    ) : isViceCaptain ? (
                                      <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                                    ) : (
                                      member.player.full_name.charAt(0).toUpperCase()
                                    )}
                                  </div>

                                  {/* Name and Badges */}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-sm text-foreground truncate">
                                        {member.player.full_name}
                                      </span>

                                      {/* Role Badges */}
                                      {isManager && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-individual text-individual-foreground shadow-2xs">
                                          <Briefcase className="w-3 h-3" />
                                          Manager
                                        </span>
                                      )}
                                      {isCaptain && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold text-gold-foreground shadow-2xs">
                                          <Crown className="w-3 h-3 fill-current" />
                                          Captain
                                        </span>
                                      )}
                                      {isViceCaptain && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-info text-info-foreground shadow-2xs">
                                          <Award className="w-3 h-3" />
                                          Vice-Captain
                                        </span>
                                      )}
                                    </div>

                                    {member.player.email && (
                                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                        {member.player.email}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Gender Pill Badge */}
                                <div className="shrink-0 flex items-center gap-1.5">
                                  {isFemale ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-danger/20 text-danger border border-danger/40 shadow-2xs">
                                      <span>♀</span>
                                      <span className="hidden sm:inline">Female</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-info/20 text-info border border-info/40 shadow-2xs">
                                      <span>♂</span>
                                      <span className="hidden sm:inline">Male</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
