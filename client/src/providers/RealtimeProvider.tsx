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

      // Live bracket advancement — team ties and their individual matches.
      // invalidateQueries prefix-matches, so this refreshes ['tournament_ties', id]
      // and ['tie_matches', id] for every spectator in real time. (#31)
      // (The per-tie match rows live in the tournament_matches table; the
      // ['tie_matches', id] query key is just a cache name.)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_ties" },
        () => jitteredInvalidate(["tournament_ties"])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_matches" },
        () => {
          jitteredInvalidate(["tie_matches"]);
          jitteredInvalidate(["tournament_matches"]);
          // A match going live or finishing changes who is free to play.
          jitteredInvalidate(["match_presence"]);
        }
      )


      // "Available to play now" presence — manual toggle, no location. (#31)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_availability" },
        () => jitteredInvalidate(["presence"])
      )

      .subscribe((status, err) => {
        if (import.meta.env.DEV && status === "SUBSCRIBED") {
          console.log("🟢 Connected to System Realtime");
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (err) {
            import('@sentry/react').then(({ captureException }) => captureException(err));
          }
        }
      });

    // Tournament status changes (play starts, finishes, archived, trashed).
    // public.tournaments is not in the realtime publication, and a trashed
    // or draft tournament fails RLS for most viewers, so postgres_changes
    // could not report these. The database broadcasts just the id instead
    // (migration 20261120120300); each client refetches under its own RLS.
    const tournamentStatus = supabase
      .channel("tournament-visibility")
      .on("broadcast", { event: "status_changed" }, () => {
        jitteredInvalidate(["tournaments"]);
        jitteredInvalidate(["tournament-route"]);
      })
      .subscribe();

    // Tournament check-ins ("I'm here", breaks) and court calls (migration
    // 20261120160000). Signed-in only (RLS); signed-out spectators get the
    // presence chip from tournament_match_presence(), refreshed with the
    // matches above. Its own channel: Realtime rejects a whole channel that
    // names a table outside the publication, so if the app ships before the
    // migration only this channel fails, not notifications or live scores.
    const checkins = supabase
      .channel("tournament-checkins")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_checkins" },
        () => {
          jitteredInvalidate(["tournament_checkins"]);
          jitteredInvalidate(["match_presence"]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "court_calls" },
        () => jitteredInvalidate(["court_calls"])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(tournamentStatus);
      supabase.removeChannel(checkins);
    };
  }, [queryClient, profile?.id]);

  return <>{children}</>;
}
