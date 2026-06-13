import { useEffect } from "react";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { messaging } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";

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
    if (!("Notification" in window) || !messaging) return;

    const setupWebPush = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // Get Firebase Web Push Token using the VAPID key
          // Note: VAPID Key comes from Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          
          if (!vapidKey) {
            console.warn("[WebPush] VITE_FIREBASE_VAPID_KEY is missing. Web push won't work.");
            return;
          }

          const token = await getToken(messaging, { vapidKey });
          
          if (token) {
            // Save token to Supabase
            await supabase
              .from("push_tokens")
              .upsert(
                {
                  user_id: userId,
                  token: token,
                  platform: "web",
                },
                { onConflict: "token" }
              );
            
            // Listen for foreground messages
            onMessage(messaging, (payload) => {
              console.log("[WebPush] Message received in foreground:", payload);
              const title = payload.notification?.title || "New Match Update";
              const body = payload.notification?.body || "Check out the latest action!";
              showWebNotification(title, body);
            });
          }
        }
      } catch (err) {
        console.warn("[WebPush] Failed to register web push:", err);
      }
    };

    // Request permission if not already decided
    if (Notification.permission === "default") {
      // Delay slightly so we don't annoy users on first page load
      const timer = setTimeout(() => {
        setupWebPush();
      }, 5000);
      return () => clearTimeout(timer);
    } else if (Notification.permission === "granted") {
      setupWebPush();
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
