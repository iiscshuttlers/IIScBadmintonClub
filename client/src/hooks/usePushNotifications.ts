import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";

/**
 * Registers for push notifications on native (Android/iOS via FCM)
 * AND requests Web Notification permission for PWA/browser users.
 */
export function usePushNotifications(
  userId: string | undefined,
  playerSlug: string | undefined,
) {
  // ─── Native Push (Android/iOS via Capacitor) ───
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return;

    let isRegistered = false;

    const registerPush = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === "prompt") {
          const requested = await PushNotifications.requestPermissions();
          if (requested.receive !== "granted") return;
        } else if (permStatus.receive !== "granted") {
          return; // Permission denied
        }

        await PushNotifications.register();
      } catch (err) {
        console.warn("Failed to register push notifications", err);
      }
    };

    registerPush();

    const addListeners = async () => {
      await PushNotifications.addListener("registration", async (token) => {
        // Save FCM token to Supabase for backend to use when user is offline
        if (userId && token.value) {
          await supabase
            .from("push_tokens")
            .upsert(
              {
                user_id: userId,
                token: token.value,
                platform: Capacitor.getPlatform(),
              },
              { onConflict: "token" },
            );
        }
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("Error on registration: " + JSON.stringify(error));
      });

      await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          console.log("Push received: " + JSON.stringify(notification));
        },
      );

      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (notification) => {
          console.log("Push action performed: " + JSON.stringify(notification));
          const data =
            notification.notification.data || (notification as any).data;
          const matchId = data?.matchId;

          // Navigate to dedicated matches page with highlight
          if (playerSlug) {
            window.location.href = `${import.meta.env.BASE_URL || "/"}matches${matchId ? `?highlight=${matchId}` : ""}`;
          }
        },
      );
      isRegistered = true;
    };

    addListeners();

    return () => {
      if (isRegistered) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [userId]);

  // ─── Web/PWA Browser Notification Permission ───
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !userId) return;
    if (!("Notification" in window)) return;

    // Request permission if not already decided
    if (Notification.permission === "default") {
      // Delay slightly so we don't annoy users on first page load
      const timer = setTimeout(() => {
        Notification.requestPermission().then((perm) => {
          console.log("[WebPush] Notification permission:", perm);
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [userId]);
}

/**
 * Show a browser notification for web/PWA users.
 * Works when the tab is in the background.
 */
export function showWebNotification(
  title: string,
  body: string,
  onClick?: () => void,
) {
  if (Capacitor.isNativePlatform()) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body,
      icon: `${import.meta.env.BASE_URL || "/"}icon-192.png`,
      badge: `${import.meta.env.BASE_URL || "/"}icon-192.png`,
      tag: "match-alert", // Replaces previous notification with same tag
      requireInteraction: false,
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  } catch (e) {
    console.warn("[WebPush] Failed to show notification:", e);
  }
}
