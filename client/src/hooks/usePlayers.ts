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
