import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchFeedMatches } from "@/services/matchService";

export function useFeedMatches(ownProfile: any, initialLimit = 100, initialTournament = "all") {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(initialLimit);
  const [tournamentFilter, setTournamentFilter] = useState<string>(initialTournament);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "singles" | "doubles" | "mixed">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");

  const activeReqIdRef = useRef(0);

  const fetchFeed = useCallback(
    async (silent = false) => {
      const reqId = ++activeReqIdRef.current;
      if (!silent) setLoading(true);
      try {
        const data = await fetchFeedMatches(limitCount, categoryFilter, timeFilter, tournamentFilter);
        if (reqId === activeReqIdRef.current && data) {
          setMatches(data);
        }
      } catch (err) {
        if (reqId === activeReqIdRef.current) {
          console.warn("Error fetching feed:", err);
        }
      } finally {
        if (reqId === activeReqIdRef.current && !silent) {
          setLoading(false);
        }
      }
    },
    [limitCount, categoryFilter, timeFilter, tournamentFilter],
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const didRetryRef = useRef(false);
  useEffect(() => {
    if (loading || matches.length > 0 || didRetryRef.current) return;
    didRetryRef.current = true;
    const t = setTimeout(() => fetchFeed(true), 2000);
    return () => clearTimeout(t);
  }, [loading, matches.length, fetchFeed]);

  const followingIds = useMemo(() => {
    const list = Array.isArray(ownProfile?.following) ? ownProfile.following : [];
    return list.map(String);
  }, [ownProfile?.following]);

  const buddyIds = useMemo(() => {
    const list = Array.isArray(ownProfile?.buddies) ? ownProfile.buddies : [];
    return list.map(String);
  }, [ownProfile?.buddies]);

  const [searchQuery, setSearchQuery] = useState("");

  const displayMatches = useMemo(() => {
    let list = matches;
    if (tournamentFilter && tournamentFilter !== "all") {
      list = list.filter((m) => m.tournament_id === tournamentFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((m) => {
      const p1Name = m.player1?.full_name?.toLowerCase() || "";
      const p2Name = m.player2?.full_name?.toLowerCase() || "";
      const p3Name = m.player3?.full_name?.toLowerCase() || m.partner1?.full_name?.toLowerCase() || "";
      const p4Name = m.player4?.full_name?.toLowerCase() || m.partner2?.full_name?.toLowerCase() || "";
      const t1Label = m.team1_label?.toLowerCase() || "";
      const t2Label = m.team2_label?.toLowerCase() || "";
      const mId = m.id?.toLowerCase() || "";
      const mNumber = m.match_number?.toString().toLowerCase() || "";
      const mFormat = m.format?.toLowerCase() || "";
      const mCategory = m.category?.toLowerCase() || "";

      return (
        p1Name.includes(q) ||
        p2Name.includes(q) ||
        p3Name.includes(q) ||
        p4Name.includes(q) ||
        t1Label.includes(q) ||
        t2Label.includes(q) ||
        mId.includes(q) ||
        mNumber.includes(q) ||
        mFormat.includes(q) ||
        mCategory.includes(q)
      );
    });
  }, [matches, tournamentFilter, searchQuery]);

  const courtUtil = useMemo(() => {
    const hours = new Array(24).fill(0);
    displayMatches.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      hours[h]++;
    });
    const morning = hours.slice(5, 12).reduce((a, b) => a + b, 0);
    const afternoon = hours.slice(12, 17).reduce((a, b) => a + b, 0);
    const evening =
      hours.slice(17, 24).reduce((a, b) => a + b, 0) +
      hours.slice(0, 5).reduce((a, b) => a + b, 0);
    const total = displayMatches.length || 1;
    return {
      morning: (morning / total) * 100,
      afternoon: (afternoon / total) * 100,
      evening: (evening / total) * 100,
      isPeak: Math.max(morning, afternoon, evening),
    };
  }, [displayMatches]);

  const matchOfTheDayId = useMemo(() => {
    if (!displayMatches || displayMatches.length === 0) return null;
    const recentMatches = displayMatches.filter(
      (m) => new Date(m.created_at).getTime() > Date.now() - 48 * 60 * 60 * 1000,
    );
    if (recentMatches.length === 0) return displayMatches[0].id;
    return recentMatches.reduce((best, m) => {
      const combinedElo = (m.player1?.elo_rating || 0) + (m.player2?.elo_rating || 0);
      const bestElo = (best.player1?.elo_rating || 0) + (best.player2?.elo_rating || 0);
      return combinedElo > bestElo ? m : best;
    }, recentMatches[0]).id;
  }, [displayMatches]);

  const weeklyRecap = useMemo(() => {
    if (!displayMatches || displayMatches.length === 0) return null;
    const lastWeekMatches = displayMatches.filter(
      (m) => new Date(m.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
    );
    if (lastWeekMatches.length === 0) return null;

    let biggestUpset = null;
    let maxUpsetDiff = 0;
    const playerActivity: Record<string, { name: string; matches: number; eloClimb: number }> = {};

    lastWeekMatches.forEach((m) => {
      const addPlayer = (pid: string, name: string, eloChange: number) => {
        if (!playerActivity[pid]) playerActivity[pid] = { name, matches: 0, eloClimb: 0 };
        playerActivity[pid].matches++;
        if (eloChange && !isNaN(eloChange)) playerActivity[pid].eloClimb += eloChange;
      };

      if (m.player1) addPlayer(m.player1.id, m.player1.full_name, m.elo_change_p1 || 0);
      if (m.player2) addPlayer(m.player2.id, m.player2.full_name, m.elo_change_p2 || 0);
      if (m.partner1) addPlayer(m.partner1.id, m.partner1.full_name, m.elo_change_p3 || 0);
      if (m.partner2) addPlayer(m.partner2.id, m.partner2.full_name, m.elo_change_p4 || 0);

      const isP1Winner = m.winner_id === m.player1?.id;
      if (m.elo_change_p1 !== undefined && m.elo_change_p2 !== undefined && m.player1 && m.player2) {
        const eloDiff = m.player1.elo_rating - m.player2.elo_rating;
        if ((isP1Winner && eloDiff < -50) || (!isP1Winner && eloDiff > 50)) {
          const diff = Math.abs(eloDiff);
          if (diff > maxUpsetDiff) {
            maxUpsetDiff = diff;
            biggestUpset = m;
          }
        }
      }
    });

    const mostActive = Object.values(playerActivity).sort((a, b) => b.matches - a.matches)[0];
    const highestClimber = Object.values(playerActivity).sort((a, b) => b.eloClimb - a.eloClimb)[0];

    return { biggestUpset, mostActive, highestClimber };
  }, [matches]);

  return {
    loading,
    matches,
    displayMatches,
    limitCount,
    setLimitCount,
    courtUtil,
    matchOfTheDayId,
    weeklyRecap,
    categoryFilter,
    setCategoryFilter,
    timeFilter,
    setTimeFilter,
    tournamentFilter,
    setTournamentFilter,
    searchQuery,
    setSearchQuery
  };
}
