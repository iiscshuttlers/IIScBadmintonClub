import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatPlayerData, visibleMatchesForViewer, isMatchParticipant } from "@/lib/playerUtils";
import { fetchPlayerMatches } from "@/services/matchService";
import type { PlayerProfileType } from "@/types";

export function usePlayerProfileQuery(id: string | undefined, ownPlayerProfileId: string | undefined) {
  const profileQuery = useQuery({
    queryKey: ["playerProfile", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data ? formatPlayerData(data) : null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const matchesQuery = useQuery({
    queryKey: ["playerMatches", id, "v2"],
    queryFn: async () => {
      if (!id) return [];
      return fetchPlayerMatches(id, 50);
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });

  const rankQuery = useQuery({
    queryKey: ["playerRank", id, "v2"],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("players")
        .select("id, elo_rating, singles_elo, doubles_elo, mixed_elo, gender")
        .is("deleted_at", null);

      if (error) throw error;
      if (!data) return null;

      const targetPlayer = data.find((p) => p.id.toLowerCase() === id.toLowerCase());
      const targetGender = targetPlayer?.gender?.toLowerCase() || "unknown";

      const sameGenderData = targetGender !== "unknown" 
        ? data.filter(p => (p.gender || "").toLowerCase() === targetGender)
        : data;

      const sortedOverall = [...data].sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
      const sortedSingles = [...sameGenderData].sort((a, b) => (b.singles_elo || 0) - (a.singles_elo || 0));
      const sortedDoubles = [...sameGenderData].sort((a, b) => (b.doubles_elo || 0) - (a.doubles_elo || 0));
      const sortedMixed = [...data].sort((a, b) => (b.mixed_elo || 0) - (a.mixed_elo || 0));

      const overallRank = sortedOverall.findIndex((p) => p.id.toLowerCase() === id.toLowerCase()) + 1;
      const singlesRank = sortedSingles.findIndex((p) => p.id.toLowerCase() === id.toLowerCase()) + 1;
      const doublesRank = sortedDoubles.findIndex((p) => p.id.toLowerCase() === id.toLowerCase()) + 1;
      const mixedRank = sortedMixed.findIndex((p) => p.id.toLowerCase() === id.toLowerCase()) + 1;

      return {
        overall: overallRank > 0 ? overallRank : null,
        singles: singlesRank > 0 ? singlesRank : null,
        doubles: doublesRank > 0 ? doublesRank : null,
        mixed: mixedRank > 0 ? mixedRank : null,
        targetGender: targetGender
      };
    },
    enabled: !!id,
    staleTime: 15 * 60 * 1000,
  });

  const eloLogsQuery = useQuery({
    queryKey: ["playerEloLogs", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("elo_calculation_logs")
        .select("*")
        .eq("player_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const loading =
    profileQuery.isLoading ||
    matchesQuery.isLoading ||
    rankQuery.isLoading ||
    eloLogsQuery.isLoading;

  const rawMatches = matchesQuery.data || [];
  const liveMatches = visibleMatchesForViewer(rawMatches, ownPlayerProfileId);

  const silentRefresh = async () => {
    await Promise.all([
      profileQuery.refetch(),
      matchesQuery.refetch(),
      rankQuery.refetch(),
      eloLogsQuery.refetch(),
    ]);
  };

  return {
    player: profileQuery.data as PlayerProfileType | null | undefined,
    loading,
    eloRank: liveMatches.some(m => m.status === 'confirmed' || m.status === 'completed') ? rankQuery.data : null,
    liveMatches,
    eloLogs: eloLogsQuery.data || [],
    silentRefresh,
    isMatchParticipant,
  };
}
