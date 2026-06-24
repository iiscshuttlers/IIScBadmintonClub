import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialService } from "@/services/socialService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function useSocialActions() {
  const queryClient = useQueryClient();
  const { profile: ownProfile, refreshProfile } = useAuth();

  const handleBuddyAction = useMutation({
    mutationFn: async ({ playerId, action, receiverName }: { playerId: string; action: 'send' | 'cancel' | 'accept' | 'remove', receiverName?: string }) => {
      if (!ownProfile) throw new Error("Not authenticated");

      switch (action) {
        case 'send':
          await socialService.sendBuddyRequest(ownProfile.id, playerId, ownProfile.full_name);
          break;
        case 'cancel':
          await socialService.cancelBuddyRequest(ownProfile.id, playerId);
          break;
        case 'accept':
          await socialService.acceptBuddyRequest(playerId, ownProfile.id, ownProfile.full_name);
          break;
        case 'remove':
          await socialService.removeBuddy(ownProfile.id, playerId);
          break;
      }
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["buddy-requests"] });
      if (action === 'send') toast.success("Buddy request sent!");
      if (action === 'cancel') toast.success("Buddy request cancelled.");
      if (action === 'accept') {
        toast.success("You are now buddies!");
        refreshProfile();
      }
      if (action === 'remove') {
        refreshProfile();
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to perform action");
    }
  });

  const handleToggleFollow = useMutation({
    mutationFn: async ({ targetId, targetName }: { targetId: string, targetName: string }) => {
      if (!ownProfile) throw new Error("Not authenticated");
      const currentFollowing = (ownProfile as any).following || [];
      const newFollowing = await socialService.toggleFollow(ownProfile.id, targetId, currentFollowing, targetName, ownProfile.full_name);
      return newFollowing;
    },
    onSuccess: (newFollowing) => {
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      refreshProfile(); // to update own following list
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to toggle follow");
    }
  });

  return {
    handleBuddyAction: handleBuddyAction.mutateAsync,
    handleToggleFollow: handleToggleFollow.mutateAsync,
    isBuddyActionLoading: handleBuddyAction.isPending,
    isFollowLoading: handleToggleFollow.isPending,
  };
}
