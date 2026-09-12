import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface UserMatchAlert {
  match_id: string;
  remind_before_mins: number;
}

export function useUserMatchAlerts(userId?: string | null) {
  const [alerts, setAlerts] = useState<UserMatchAlert[]>([]);

  const fetchAlerts = async () => {
    if (!userId) {
      setAlerts([]);
      return;
    }
    const { data } = await supabase
      .from("match_reminders")
      .select("match_id, remind_before_mins")
      .eq("user_id", userId);
    
    if (data) {
      setAlerts(data);
    }
  };

  useEffect(() => {
    fetchAlerts();

    if (!userId) return;

    const handleEvent = () => fetchAlerts();
    window.addEventListener("match_alerts_changed", handleEvent);

    return () => {
      window.removeEventListener("match_alerts_changed", handleEvent);
    };
  }, [userId]);

  return alerts;
}
