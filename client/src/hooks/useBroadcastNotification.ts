import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { showWebNotification } from "./usePushNotifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

export function useBroadcastNotification() {
  const lastAnnouncementRef = useRef<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("broadcast-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "site_data",
        },
        async (payload) => {
          const row = payload.new as any;
          if (!row) return;

          if (row.key === "announcements") {
            try {
              const data = row.value;
              if (data && data.recent && data.recent.length > 0) {
                // Get the latest announcement
                const latest = data.recent[0];
                
                // If it's a new announcement we haven't seen during this session
                if (latest.title && latest.title !== lastAnnouncementRef.current) {
                  lastAnnouncementRef.current = latest.title;

                  // Fire notification
                  if (Capacitor.isNativePlatform()) {
                    try {
                      const permStatus = await LocalNotifications.checkPermissions();
                      if (permStatus.display === "prompt") {
                        await LocalNotifications.requestPermissions();
                      }
                      if (permStatus.display === "granted" || permStatus.display === "prompt") {
                        await LocalNotifications.schedule({
                          notifications: [
                            {
                              title: "📢 Club Update!",
                              body: latest.title,
                              id: Math.floor(Math.random() * 1000000),
                              schedule: { at: new Date(Date.now() + 100) },
                              actionTypeId: "",
                              extra: { type: "announcement" },
                            },
                          ],
                        });
                      }
                    } catch (e) {
                      console.warn("Failed to schedule local notification", e);
                    }
                  } else {
                    showWebNotification(
                      "📢 Club Update!",
                      latest.title,
                      () => {
                        window.location.href = `${import.meta.env.BASE_URL || "/"}announcements`;
                      },
                    );
                  }
                }
              }
            } catch (e) {
               console.error("Failed to parse announcement data", e);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
