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
