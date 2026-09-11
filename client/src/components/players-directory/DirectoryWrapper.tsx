import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { DirectoryTab } from "./tabs/DirectoryTab";
import { fetchPlayerList } from "@/services/playerService";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { useAuth } from "@/contexts/AuthContext";
import { getEloTier } from "@/lib/tiers";
import type { PlayerRow } from "@/types";
import { useAllTournamentMatches } from "@/hooks/useAllTournamentMatches";

export function DirectoryWrapper() {
  const { profile, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const getInitialParam = (param: string, defaultVal: string) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param) || defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [searchQuery, setSearchQuery] = useState(() => getInitialParam("dir_q", ""));
  const [sortBy, setSortBy] = useState<any>(() => getInitialParam("dir_sort", "elo"));
  const [showFilters, setShowFilters] = useState(false);
  const [levelFilter, setLevelFilter] = useState(() => getInitialParam("dir_level", "All"));
  const [departmentFilter, setDepartmentFilter] = useState(() => getInitialParam("dir_dept", "All"));
  const [tournamentFilter, setTournamentFilter] = useState(() => getInitialParam("dir_tourn", "All"));
  const [categoryFilter, setCategoryFilter] = useState(() => getInitialParam("dir_cat", "All"));
  const [visibleCount, setVisibleCount] = useState(24);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (searchQuery) url.searchParams.set("dir_q", searchQuery);
      else url.searchParams.delete("dir_q");
      
      url.searchParams.set("dir_sort", sortBy);
      url.searchParams.set("dir_level", levelFilter);
      url.searchParams.set("dir_dept", departmentFilter);
      url.searchParams.set("dir_tourn", tournamentFilter);
      url.searchParams.set("dir_cat", categoryFilter);
      
      window.history.replaceState(null, "", url.toString());
    } catch { /* ignore */ }
  }, [searchQuery, sortBy, levelFilter, departmentFilter, tournamentFilter, categoryFilter]);

  const { data: allMatches = [] } = useAllTournamentMatches();

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      setFetchError(false);
      const data = await fetchPlayerList();
      setPlayers(data);
    } catch (err) {
      console.error("Failed to fetch players", err);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const allDepartments = useMemo(() => {
    const deps = new Set(players.map((p) => p.department).filter(Boolean));
    return Array.from(deps).sort() as string[];
  }, [players]);

  // Compute Ranks globally (before filters)
  const rankMap = useMemo(() => {
    return calculateRanksMap(players);
  }, [players]);

  const filteredPlayers = useMemo(() => {
    let participantIds: Set<string> | null = null;
    if (tournamentFilter !== "All" || categoryFilter !== "All") {
      participantIds = new Set();
      for (const m of allMatches) {
        if (tournamentFilter !== "All" && m.tournament_id !== tournamentFilter) continue;
        if (categoryFilter !== "All" && m.category !== categoryFilter) continue;
        if (m.player1_id) participantIds.add(m.player1_id);
        if (m.player2_id) participantIds.add(m.player2_id);
        if (m.player3_id) participantIds.add(m.player3_id);
        if (m.player4_id) participantIds.add(m.player4_id);
      }
    }

    return players
      .filter((p) => {
        if (participantIds && !participantIds.has(p.id)) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            p.full_name?.toLowerCase().includes(q) ||
            p.department?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .filter((p) => levelFilter === "All" || getEloTier(p.elo_rating).name === levelFilter)
      .filter(
        (p) => departmentFilter === "All" || (p.department || "").toLowerCase() === departmentFilter.toLowerCase()
      )
      .map(p => {
        // If sorting by tournament rankings, compute temporary stats for this filter
        if (tournamentFilter !== "All" && sortBy === "elo") {
          let wins = 0;
          let losses = 0;
          for (const m of allMatches) {
            if (m.tournament_id !== tournamentFilter) continue;
            if (categoryFilter !== "All" && m.category !== categoryFilter) continue;
            
            const isTeam1 = m.player1_id === p.id || m.player3_id === p.id;
            const isTeam2 = m.player2_id === p.id || m.player4_id === p.id;
            if (isTeam1) {
              if (m.winner_side === 1) wins++; else losses++;
            } else if (isTeam2) {
              if (m.winner_side === 2) wins++; else losses++;
            }
          }
          return { ...p, _filterWins: wins, _filterLosses: losses };
        }
        return p;
      })
      .sort((a: any, b: any) => {
        if (tournamentFilter !== "All" && sortBy === "elo") {
          const aTotal = (a._filterWins || 0) + (a._filterLosses || 0);
          const bTotal = (b._filterWins || 0) + (b._filterLosses || 0);
          const aPct = aTotal === 0 ? -1 : (a._filterWins || 0) / aTotal;
          const bPct = bTotal === 0 ? -1 : (b._filterWins || 0) / bTotal;
          
          if (bPct !== aPct) return bPct - aPct;
          if ((b._filterWins || 0) !== (a._filterWins || 0)) return (b._filterWins || 0) - (a._filterWins || 0);
          return (b.elo_rating || 0) - (a.elo_rating || 0);
        }
        if (sortBy === "elo") return (b.elo_rating || 0) - (a.elo_rating || 0);
        if (sortBy === "singles") return (b.singles_elo || 0) - (a.singles_elo || 0);
        if (sortBy === "doubles") return (b.doubles_elo || 0) - (a.doubles_elo || 0);
        if (sortBy === "mixed") return (b.mixed_elo || 0) - (a.mixed_elo || 0);
        if (sortBy === "winpct") {
          const getPct = (p: any) => {
            const rec = String(p.win_loss_record || "").toUpperCase();
            const m = rec.match(/(\d+)\s*W\s*-?\s*(\d+)\s*L/);
            if (m) {
              const w = +m[1], l = +m[2];
              return w + l === 0 ? -1 : w / (w + l);
            }
            const dashMatch = rec.match(/^(\d+)\s*-\s*(\d+)$/);
            if (dashMatch) {
              const w = +dashMatch[1], l = +dashMatch[2];
              return w + l === 0 ? -1 : w / (w + l);
            }
            return -1;
          };
          return getPct(b) - getPct(a);
        }
        if (sortBy === "name") return (a.full_name || "").localeCompare(b.full_name || "");
        if (sortBy === "department") return (a.department || "").localeCompare(b.department || "");
        if (sortBy === "level") return (a.playing_level || "").localeCompare(b.playing_level || "");
        return 0;
      });
  }, [players, searchQuery, sortBy, levelFilter, departmentFilter, tournamentFilter, categoryFilter, allMatches]);

  return (
    <div className="w-full h-full p-4 lg:p-6 bg-slate-50 dark:bg-slate-950 min-h-screen max-w-7xl mx-auto">
      <DirectoryTab
        players={players}
        otherPlayersCount={players.length - (profile ? 1 : 0)}
        filteredPlayers={filteredPlayers}
        loading={loading}
        fetchError={fetchError}
        fetchPlayers={fetchPlayers}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
        ownProfile={profile as any}
        isAdmin={isAdmin}
        handleAdminDelete={() => {}}
        handleAdminEdit={() => {}}
        setSelectedOpponentId={() => {}}
        setIsLogMatchOpen={() => {}}
        setLocation={setLocation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        levelFilter={levelFilter}
        setLevelFilter={setLevelFilter}
        departmentFilter={departmentFilter}
        setDepartmentFilter={setDepartmentFilter}
        tournamentFilter={tournamentFilter}
        setTournamentFilter={setTournamentFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        allDepartments={allDepartments}
        myBuddyIds={new Set(profile?.buddies || [])}
        myBuddyRequests={{ received: new Set(), sent: new Set() }}
        handleBuddyAction={() => {}}
        followingIds={new Set()}
        handleToggleFollow={() => {}}
        isPersonalView={false}
        rankMap={rankMap}
      />
    </div>
  );
}
