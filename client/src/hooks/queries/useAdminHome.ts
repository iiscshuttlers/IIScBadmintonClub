import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { adminService, type AdminLogEntry } from "@/services/adminService";

/** New (unread) member feedback, for the "Content & inbox" badge. Plain number (persisted cache). */
export function useNewFeedbackCount(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "feedback-new-count"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("user_feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** The latest admin actions for Home. Plain array (the React Query cache is persisted). */
export function useRecentAdminActivity(enabled: boolean, limit = 5) {
  return useQuery({
    queryKey: ["admin", "recent-activity", limit],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<AdminLogEntry[]> => adminService.getLogs(0, limit),
  });
}
