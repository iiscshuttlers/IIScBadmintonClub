import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { DirectoryTab } from "./tabs/DirectoryTab";
import { fetchPlayerList } from "@/services/playerService";
import { calculateRanksMap } from "@/lib/rankingUtils";
import { useAuth } from "@/contexts/AuthContext";
import type { PlayerRow } from "@/types";

export function DirectoryWrapper() {
  const { profile, isAdmin } = useAuth();
  const [, setLocation] = useLocation();

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"elo" | "singles" | "doubles" | "mixed" | "winpct" | "name" | "department" | "level">("elo");
  const [showFilters, setShowFilters] = useState(false);
  const [levelFilter, setLevelFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [visibleCount, setVisibleCount] = useState(24);

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
    return players
      .filter((p) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            p.full_name?.toLowerCase().includes(q) ||
            p.department?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .filter((p) => levelFilter === "All" || p.playing_level === levelFilter)
      .filter(
        (p) => departmentFilter === "All" || p.department === departmentFilter
      )
      .sort((a, b) => {
        if (sortBy === "elo") return (b.elo_rating || 0) - (a.elo_rating || 0);
        if (sortBy === "singles") return (b.singles_elo || 0) - (a.singles_elo || 0);
        if (sortBy === "doubles") return (b.doubles_elo || 0) - (a.doubles_elo || 0);
        if (sortBy === "mixed") return (b.mixed_elo || 0) - (a.mixed_elo || 0);
        if (sortBy === "winpct") {
          const getPct = (p: any) => {
            const w = p.stats?.wins || 0;
            const l = p.stats?.losses || 0;
            return w + l === 0 ? -1 : w / (w + l);
          };
          return getPct(b) - getPct(a);
        }
        if (sortBy === "name") return (a.full_name || "").localeCompare(b.full_name || "");
        if (sortBy === "department") return (a.department || "").localeCompare(b.department || "");
        if (sortBy === "level") return (a.playing_level || "").localeCompare(b.playing_level || "");
        return 0;
      });
  }, [players, searchQuery, sortBy, levelFilter, departmentFilter]);

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
