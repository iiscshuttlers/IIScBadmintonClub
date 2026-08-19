import { useQuery } from "@tanstack/react-query";
import { playerService } from "@/services/playerService";

export function usePlayers() {
  return useQuery({
    queryKey: ["players", "directory"],
    queryFn: () => playerService.getAllPlayers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useOtherPlayersSlim(currentUserId?: string) {
  return useQuery({
    queryKey: ["players", "other_slim", currentUserId],
    queryFn: () => currentUserId ? playerService.getOtherPlayersSlim(currentUserId) : Promise.resolve([]),
    enabled: !!currentUserId,
    staleTime: 1000 * 60 * 15,
  });
}

export function usePlayerBuddies(profileId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["players", "buddies", profileId],
    queryFn: () => playerService.getBuddies(profileId),
    enabled: options?.enabled ?? !!profileId,
  });
}

export function useFollowers(profileId?: string) {
  return useQuery({
    queryKey: ["players", "followers", profileId],
    queryFn: () => profileId ? playerService.getFollowers(profileId) : Promise.resolve([]),
    enabled: !!profileId,
  });
}

export function useBuddyRequests(profileId?: string) {
  return useQuery({
    queryKey: ["players", "buddy_requests", profileId],
    queryFn: () => profileId ? playerService.getBuddyRequests(profileId) : Promise.resolve([]),
    enabled: !!profileId,
  });
}

export function usePendingMatches(profileId?: string) {
  return useQuery({
    queryKey: ["matches", "pending", profileId],
    queryFn: () => profileId ? playerService.getPendingMatches(profileId) : Promise.resolve([]),
    enabled: !!profileId,
  });
}

export function useAllMatches() {
  return useQuery({
    queryKey: ["matches", "all_completed"],
    queryFn: () => playerService.getAllCompletedMatches(),
    staleTime: 1000 * 60 * 10,
  });
}

export function useAllTournamentMatches() {
  return useQuery({
    queryKey: ["tournament_matches", "all_completed"],
    queryFn: async () => {
      const { supabase } = await import("@/lib/supabase");
      const { data, error } = await supabase
        .from("tournament_matches")
        .select("id, player1_id, player2_id, player3_id, player4_id, team1_label, team2_label, winner_id, winner_side, category, status, created_at, ended_at")
        .eq("status", "completed");
      if (error) throw error;
      
      // Transform to match what TournamentStandingsTab expects
      return (data || []).map((m: any) => {
        let w_partner = null;
        let l_id = null;
        let l_partner = null;
        
        if (m.winner_side === 1) {
          w_partner = m.player3_id;
          l_id = m.player2_id;
          l_partner = m.player4_id;
        } else if (m.winner_side === 2) {
          w_partner = m.player4_id;
          l_id = m.player1_id;
          l_partner = m.player3_id;
        }
        
        return {
          ...m,
          team1_partner_id: m.player3_id,
          team2_partner_id: m.player4_id,
          winner_partner_id: w_partner,
          loser_id: l_id,
          loser_partner_id: l_partner
        };
      });
    },
    staleTime: 1000 * 60 * 10,
  });
}
