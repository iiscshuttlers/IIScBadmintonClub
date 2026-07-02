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
    onMutate: async ({ playerId, action }) => {
      if (!ownProfile) return;
      await queryClient.cancelQueries({ queryKey: ["players", "buddy_requests", ownProfile.id] });
      const previousRequests = queryClient.getQueryData(["players", "buddy_requests", ownProfile.id]);

      queryClient.setQueryData(["players", "buddy_requests", ownProfile.id], (old: any) => {
        const list = old || [];
        if (action === 'send') {
          return [...list, { id: 'temp-' + Date.now(), status: 'pending', sender_id: ownProfile.id, receiver_id: playerId }];
        }
        if (action === 'cancel') {
          return list.filter((r: any) => !(r.sender_id === ownProfile.id && r.receiver_id === playerId));
        }
        if (action === 'accept') {
          return list.map((r: any) => (r.sender_id === playerId && r.receiver_id === ownProfile.id) ? { ...r, status: 'accepted' } : r);
        }
        if (action === 'remove') {
          return list.filter((r: any) => !(r.sender_id === ownProfile.id && r.receiver_id === playerId) && !(r.sender_id === playerId && r.receiver_id === ownProfile.id));
        }
        return list;
      });

      return { previousRequests };
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["players", "buddy_requests"] });
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
    onError: (error: any, _variables, context: any) => {
      console.error(error);
      if (context?.previousRequests && ownProfile) {
        queryClient.setQueryData(["players", "buddy_requests", ownProfile.id], context.previousRequests);
      }
      toast.error("Failed to perform action: " + (error.message || error.toString()));
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
    onError: (error: any) => {
      console.error(error);
      toast.error("Failed to toggle follow: " + (error.message || error.toString()));
    }
  });

  return {
    handleBuddyAction: handleBuddyAction.mutateAsync,
    handleToggleFollow: handleToggleFollow.mutateAsync,
    isBuddyActionLoading: handleBuddyAction.isPending,
    isFollowLoading: handleToggleFollow.isPending,
  };
}
