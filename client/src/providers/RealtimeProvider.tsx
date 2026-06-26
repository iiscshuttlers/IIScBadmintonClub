import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  useEffect(() => {
    // A single, multiplexed channel for all database table changes
    const channel = supabase
      .channel("system_realtime_db")
      
      // Match Updates (Invalidates all match-related queries)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["matches"] });
        }
      )
      
      // Notification Updates
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: profile?.id ? `user_id=eq.${profile.id}` : undefined },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )

      // Find & Lost Updates
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "find_lost" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["find_lost"] });
        }
      )

      // Player Profile Updates (Elo, Status, etc)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["players"] });
        }
      )

      // Site Data Updates (Announcements, Tournaments)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["site_data"] });
        }
      )

      .subscribe((status) => {
        if (import.meta.env.DEV && status === "SUBSCRIBED") {
          console.log("🟢 Connected to System Realtime");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, profile?.id]);

  return <>{children}</>;
}
