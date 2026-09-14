import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface UserMatchAlert {
  match_id: string;
  remind_before_mins: number;
}

export function useUserMatchAlerts(userId?: string | null) {
  const queryClient = useQueryClient();
  
  const { data: alerts = [] } = useQuery({
    queryKey: ["match_alerts", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("match_reminders")
        .select("match_id, remind_before_mins")
        .eq("user_id", userId);
      return data || [];
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 mins
  });

  useEffect(() => {
    if (!userId) return;

    const handleEvent = () => {
      queryClient.invalidateQueries({ queryKey: ["match_alerts", userId] });
    };
    
    window.addEventListener("match_alerts_changed", handleEvent);
    return () => {
      window.removeEventListener("match_alerts_changed", handleEvent);
    };
  }, [userId, queryClient]);

  return alerts;
}
