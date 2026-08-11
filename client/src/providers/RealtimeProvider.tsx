import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  useEffect(() => {
    // Helper to prevent 200+ clients from fetching at the exact same millisecond
    const jitteredInvalidate = (key: string[]) => {
      setTimeout(() => queryClient.invalidateQueries({ queryKey: key }), Math.random() * 3000);
    };

    // A single, multiplexed channel for all database table changes
    const channel = supabase
      .channel("system_realtime_db")
      
      // Match Updates: Surgical optimistic update for scores to prevent thundering herd
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          queryClient.setQueriesData({ queryKey: ["matches"] }, (oldData: any) => {
            if (Array.isArray(oldData)) {
              return oldData.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m));
            }
            return oldData;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        () => jitteredInvalidate(["matches"])
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "matches" },
        () => jitteredInvalidate(["matches"])
      )
      
      // Notification Updates
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: profile?.id ? `user_id=eq.${profile.id}` : undefined },
        () => jitteredInvalidate(["notifications"])
      )

      // Find & Lost Updates
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "find_lost" },
        () => jitteredInvalidate(["find_lost"])
      )

      // Player Profile Updates (Elo, Status, etc)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => jitteredInvalidate(["players"])
      )

      // Site Data Updates (Announcements, Tournaments)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_data" },
        () => jitteredInvalidate(["site_data"])
      )

      // Tournament Table Updates
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments" },
        () => jitteredInvalidate(["tournaments"])
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
