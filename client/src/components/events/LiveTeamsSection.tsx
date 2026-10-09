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
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { resolveMemberGender } from "@/components/events/TeamRosterModal";

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
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
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
        // 1. Fetch teams
        const { data: rawTeams, error: teamsError } = await supabase
          .from("tournament_teams")
          .select("id, tournament_id, name, short_name, pool, seed, captain_id, status")
          .eq("tournament_id", tournamentId)
          .neq("status", "DELETED")
          .order("name", { ascending: true });

        if (teamsError) throw teamsError;
        const validTeams = rawTeams || [];

        // 2. Fetch members with joined player info
        const { data: rawMembers, error: membersError } = await supabase
          .from("tournament_team_members")
          .select("id, team_id, player_id, role, status, player:players!player_id(id, full_name, email, gender, is_guest, avatar_url)")
          .eq("tournament_id", tournamentId)
          .eq("status", "ACTIVE");

        if (membersError) throw membersError;

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
          const { data: captainPlayers } = await supabase
            .from("players")
            .select("id, full_name, email, gender, is_guest, avatar_url")
            .in("id", captainIdsToFetch);

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
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Teams & Squads...</p>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-sm">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
          <Shield className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-1">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Left: Summary Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-black">
            <Shield className="w-3.5 h-3.5" />
            {totalStats.teamsCount} Teams
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
            <Users className="w-3.5 h-3.5" />
            {totalStats.totalPlayers} Players
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800/40">
            <span>♂</span>
            <span>{totalStats.maleCount}</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800/40">
            <span>♀</span>
            <span>{totalStats.femaleCount}</span>
          </span>
        </div>

        {/* Right: Search & Expand All */}
        <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search team or player..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-primary/20 transition shadow-2xs"
            />
          </div>

          <button
            onClick={toggleAll}
            className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition shadow-2xs flex items-center gap-1.5"
            title={allExpanded ? "Collapse all teams" : "Expand all teams"}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
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
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
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
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
              No teams matching "{searchQuery}"
            </p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or switching pools.</p>
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
                className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs ${
                  isExpanded
                    ? "border-primary/40 ring-1 ring-primary/20 shadow-md"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Team Card Header (Clickable Accordion Trigger) */}
                <button
                  type="button"
                  onClick={() => toggleTeam(team.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 select-none cursor-pointer"
                >
                  {/* Left: Team Name & Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 text-primary flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                      <Shield className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight">
                          {team.name}
                        </h4>
                        {team.short_name && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {team.short_name}
                          </span>
                        )}
                        {team.pool && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                            Pool {team.pool}
                          </span>
                        )}
                      </div>

                      {/* Captain & Manager preview line when collapsed */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                        {manager && (
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
                            <Briefcase className="w-3 h-3" />
                            Mgr: {manager.player.full_name}
                          </span>
                        )}
                        {manager && captain && <span>·</span>}
                        {captain && (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                            <Crown className="w-3 h-3 fill-current" />
                            Capt: {captain.player.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Squad Stats & Chevron */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {team.members.length} players
                      </span>
                      <span className="px-2 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40 text-[11px]">
                        ♂ {mCount}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 text-[11px]">
                        ♀ {fCount}
                      </span>
                    </div>

                    <div className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
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
                      className="overflow-hidden border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40"
                    >
                      <div className="p-4 sm:p-5 space-y-2.5">
                        {team.members.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400 font-semibold">
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
                                className={`p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all duration-150 ${
                                  isManager
                                    ? "bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-transparent border-2 border-purple-400 dark:border-purple-500/60 shadow-xs"
                                    : isCaptain
                                    ? "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-2 border-amber-400 dark:border-amber-500/60 shadow-xs"
                                    : isViceCaptain
                                    ? "bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent border-2 border-indigo-400 dark:border-indigo-500/60 shadow-xs"
                                    : isFemale
                                    ? "bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 hover:border-rose-300"
                                    : "bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-900/40 hover:border-sky-300"
                                }`}
                              >
                                {/* Left: Avatar & Member Info */}
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Avatar */}
                                  <div
                                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs ${
                                      isManager
                                        ? "bg-purple-600 text-white ring-2 ring-purple-400/50"
                                        : isCaptain
                                        ? "bg-amber-500 text-slate-950 ring-2 ring-amber-400/50"
                                        : isViceCaptain
                                        ? "bg-indigo-600 text-white ring-2 ring-indigo-400/50"
                                        : isFemale
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 ring-2 ring-rose-300/40"
                                        : "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 ring-2 ring-sky-300/40"
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
                                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                        {member.player.full_name}
                                      </span>

                                      {/* Role Badges */}
                                      {isManager && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
                                          <Briefcase className="w-3 h-3" />
                                          Manager
                                        </span>
                                      )}
                                      {isCaptain && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-2xs">
                                          <Crown className="w-3 h-3 fill-current" />
                                          Captain
                                        </span>
                                      )}
                                      {isViceCaptain && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                                          <Award className="w-3 h-3" />
                                          Vice-Captain
                                        </span>
                                      )}
                                    </div>

                                    {member.player.email && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                        {member.player.email}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Gender Pill Badge */}
                                <div className="shrink-0 flex items-center gap-1.5">
                                  {isFemale ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800 shadow-2xs">
                                      <span>♀</span>
                                      <span className="hidden sm:inline">Female</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-300/60 dark:border-sky-800 shadow-2xs">
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
