import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Tables } from "@/lib/supabase-types-auto";
import { useAuth } from "@/contexts/AuthContext";
import { showWebNotification } from "./usePushNotifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { playVictorySound } from "@/lib/sounds";

/**
 * Watches the signed-in player's row and celebrates once when a rating gain
 * lifts them into the overall top 10 (cleared again when they drop out).
 */
export function useTopTenAlert() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel("top-ten-alert")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "players",
          filter: `id=eq.${profile.id}`
        },
        async (payload) => {
          const oldPlayer = payload.old as Partial<Tables<"players">>;
          const newPlayer = payload.new as Tables<"players">;

          if (newPlayer.elo_rating > oldPlayer.elo_rating) {
            // Check if entered top 10
            const { data } = await supabase
              .from("players")
              .select("id")
              .order("elo_rating", { ascending: false })
              .limit(10);

            if (data && data.some((p) => p.id === profile.id)) {
              // They are in top 10!
              if (!localStorage.getItem("notified_top10")) {
                localStorage.setItem("notified_top10", "true");
                playVictorySound();
                if (Capacitor.isNativePlatform()) {
                  try {
                    const permStatus = await LocalNotifications.checkPermissions();
                    if (permStatus.display === "prompt") await LocalNotifications.requestPermissions();
                    if (permStatus.display === "granted" || permStatus.display === "prompt") {
                      await LocalNotifications.schedule({
                        notifications: [{
                          title: "🎉 Top 10 Reached!",
                          body: "You've just entered the Top 10! Keep up the great work!",
                          id: Math.floor(Math.random() * 1000000),
                          schedule: { at: new Date(Date.now() + 100) },
                          channelId: "notify_victory",
                        }],
                      });
                    }
                  } catch (err) {
                    import('@sentry/react').then(({ captureException }) => captureException(err));
                  }
                } else {
                  showWebNotification("🎉 Top 10 Reached!", "You've just entered the Top 10! Keep up the great work!", () => {});
                }
              }
            } else {
              localStorage.removeItem("notified_top10");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);
}
