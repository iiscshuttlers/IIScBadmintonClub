import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialService } from "@/services/socialService";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function useSocialActions() {
  const queryClient = useQueryClient();
  const { profile: ownProfile, refreshProfile } = useAuth();

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
    handleToggleFollow: handleToggleFollow.mutateAsync,
    isFollowLoading: handleToggleFollow.isPending,
  };
}
