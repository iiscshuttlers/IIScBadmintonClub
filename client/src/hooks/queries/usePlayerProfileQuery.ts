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
    queryKey: ["playerMatches", id],
    queryFn: async () => {
      if (!id) return [];
      return fetchPlayerMatches(id, 50);
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });

  const rankQuery = useQuery({
    queryKey: ["playerRank", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("players")
        .select("id, elo_rating")
        .is("deleted_at", null)
        .order("elo_rating", { ascending: false });

      if (error) throw error;
      if (!data) return null;

      const rank = data.findIndex((p) => p.id === id) + 1;
      return rank > 0 ? rank : null;
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
    eloRank: rankQuery.data,
    liveMatches,
    eloLogs: eloLogsQuery.data || [],
    silentRefresh,
    isMatchParticipant,
  };
}
