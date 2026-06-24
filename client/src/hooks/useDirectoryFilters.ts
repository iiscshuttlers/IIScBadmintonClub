import { useState, useRef, useEffect, useMemo } from "react";
import type { Player } from "@/components/players-directory/PlayerCard";
import { parseWinPct } from "@/components/players-directory/PlayerCard";

export function useDirectoryFilters(
  players: Player[],
  sessionUserId: string | undefined,
  myBuddyIds: Set<string>
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [levelFilter, setLevelFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<
    "elo" | "winpct" | "name" | "department" | "level"
  >("name");

  // Debounce search input by 150ms
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const otherPlayers = useMemo(
    () => players.filter((p) => p.id !== sessionUserId),
    [players, sessionUserId]
  );

  const allDepartments = useMemo(
    () =>
      Array.from(new Set(players.map((p) => p.department).filter(Boolean))).sort(),
    [players]
  );

  // Fuzzy score: returns 0 if no match, higher = better match
  const fuzzyScore = (text: string, query: string): number => {
    if (!query) return 1;
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(` ${q}`)) return 70; // word boundary
    if (t.includes(q)) return 50;
    // Check if all chars of query appear in order in text
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length ? 20 : 0;
  };

  const filteredPlayers = useMemo(() => {
    const q = debouncedSearchQuery.trim();
    return otherPlayers
      .map((player) => {
        const matchesLevel =
          levelFilter === "All" || player.playing_level === levelFilter;
        const matchesDept =
          departmentFilter === "All" || player.department === departmentFilter;
        if (!matchesLevel || !matchesDept) return null;

        if (!q) return { player, score: 0 };
        const nameScore = fuzzyScore(player.full_name, q);
        const nickScore = player.nickname ? fuzzyScore(player.nickname, q) : 0;
        const deptScore = fuzzyScore(player.department || "", q) * 0.5;
        const totalScore = Math.max(nameScore, nickScore, deptScore);
        if (totalScore === 0) return null;
        return { player, score: totalScore };
      })
      .filter(Boolean)
      .sort((a, b) => {
        // Hoist Looking-to-Play buddies above everyone else
        const aIsLtpBuddy =
          (a!.player as any).is_looking_to_play && myBuddyIds.has(a!.player.id);
        const bIsLtpBuddy =
          (b!.player as any).is_looking_to_play && myBuddyIds.has(b!.player.id);
        if (aIsLtpBuddy && !bIsLtpBuddy) return -1;
        if (!aIsLtpBuddy && bIsLtpBuddy) return 1;

        // If searching, sort by fuzzy score first
        if (q && a!.score !== b!.score) return b!.score - a!.score;

        if (sortBy === "elo")
          return (b!.player.elo_rating ?? 0) - (a!.player.elo_rating ?? 0);
        if (sortBy === "winpct")
          return (
            (parseWinPct(b!.player.win_loss_record) ?? 0) -
            (parseWinPct(a!.player.win_loss_record) ?? 0)
          );
        if (sortBy === "department")
          return (a!.player.department || "").localeCompare(
            b!.player.department || ""
          );
        if (sortBy === "level")
          return (a!.player.playing_level || "").localeCompare(
            b!.player.playing_level || ""
          );
        if (sortBy === "name")
          return a!.player.full_name.localeCompare(b!.player.full_name);
        return 0;
      })
      .map((item) => item!.player);
  }, [
    otherPlayers,
    debouncedSearchQuery,
    levelFilter,
    departmentFilter,
    sortBy,
    myBuddyIds,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    levelFilter,
    setLevelFilter,
    departmentFilter,
    setDepartmentFilter,
    showFilters,
    setShowFilters,
    sortBy,
    setSortBy,
    filteredPlayers,
    allDepartments,
  };
}
