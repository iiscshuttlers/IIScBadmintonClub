import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { showWebNotification } from "./usePushNotifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";

export function usePingsNotification() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel("pings")
      .on(
        "broadcast",
        { event: "ping" },
        async (payload) => {
          if (payload.payload?.target_id === profile.id) {
            const senderName = payload.payload.sender_name || "A player";
            const message = `${senderName} is looking to play a match with you!`;

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
                        title: "🏸 Match Request!",
                        body: message,
                        id: Math.floor(Math.random() * 1000000),
                        schedule: { at: new Date(Date.now() + 100) },
                        extra: { type: "ping" },
                      },
                    ],
                  });
                }
              } catch (e) {
                console.warn("Failed to schedule local notification", e);
              }
            } else {
              showWebNotification(
                "🏸 Match Request!",
                message,
                () => {
                  window.location.href = `${import.meta.env.BASE_URL || "/"}players`;
                },
              );
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
