import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchFeedMatches } from "@/services/matchService";

export function useFeedMatches(ownProfile: any) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [limitCount, setLimitCount] = useState(100);
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "singles" | "doubles" | "mixed">("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");

  const fetchFeed = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchFeedMatches(limitCount, categoryFilter, timeFilter, tournamentFilter);
        if (data) {
          setMatches(data);
        }
      } catch (err) {
        console.warn("Error fetching feed:", err);
      } finally {
        if (!silent) setLoading(false);
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

  const displayMatches = useMemo(() => {
    return matches;
  }, [matches]);

  const courtUtil = useMemo(() => {
    const hours = new Array(24).fill(0);
    matches.forEach((m) => {
      const h = new Date(m.created_at).getHours();
      hours[h]++;
    });
    const morning = hours.slice(5, 12).reduce((a, b) => a + b, 0);
    const afternoon = hours.slice(12, 17).reduce((a, b) => a + b, 0);
    const evening =
      hours.slice(17, 24).reduce((a, b) => a + b, 0) +
      hours.slice(0, 5).reduce((a, b) => a + b, 0);
    const total = matches.length || 1;
    return {
      morning: (morning / total) * 100,
      afternoon: (afternoon / total) * 100,
      evening: (evening / total) * 100,
      isPeak: Math.max(morning, afternoon, evening),
    };
  }, [matches]);

  const matchOfTheDayId = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const recentMatches = matches.filter(
      (m) => new Date(m.created_at).getTime() > Date.now() - 48 * 60 * 60 * 1000,
    );
    if (recentMatches.length === 0) return matches[0].id;
    return recentMatches.reduce((best, m) => {
      const combinedElo = (m.player1?.elo_rating || 0) + (m.player2?.elo_rating || 0);
      const bestElo = (best.player1?.elo_rating || 0) + (best.player2?.elo_rating || 0);
      return combinedElo > bestElo ? m : best;
    }, recentMatches[0]).id;
  }, [matches]);

  const weeklyRecap = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const lastWeekMatches = matches.filter(
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
    setTournamentFilter
  };
}
