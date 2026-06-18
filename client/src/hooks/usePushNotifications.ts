import { useEffect } from "react";
import { PushNotifications, type Channel } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { getFirebaseMessaging } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";

/**
 * Registers for push notifications on native (Android/iOS via FCM)
 * AND requests Web Notification permission for PWA/browser users.
 */
export function usePushNotifications(userId: string | undefined) {
  // ─── Native Push (Android/iOS via Capacitor) ───
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return;

    let isRegistered = false;

    const createAndroidChannels = async () => {
      if (Capacitor.getPlatform() !== 'android') return;
      const channels: Channel[] = [
        { id: "notify_friendly", name: "Friendly matches", description: "Alerts for friendly match requests", importance: 4, visibility: 1 },
        { id: "notify_tournament", name: "Tournament matches", description: "Updates for tournament matches", importance: 4, visibility: 1 },
        { id: "notify_challenges", name: "Challenge invites", description: "Alerts for new challenges", importance: 4, visibility: 1 },
        { id: "notify_confirmation", name: "Match confirmations", description: "Updates when matches are confirmed", importance: 4, visibility: 1 },
        { id: "notify_announcements", name: "Announcements", description: "Important club announcements", importance: 3, visibility: 1 },
        { id: "notify_find_lost", name: "Find & Lost posts", description: "Updates on lost and found items", importance: 3, visibility: 1 },
        { id: "notify_elo_milestone", name: "ELO milestones", description: "Alerts for reaching new ELO milestones", importance: 3, visibility: 1 },
        { id: "notify_weekly_digest", name: "Weekly digest", description: "Weekly platform activity summary", importance: 2, visibility: 1 }
      ];
      for (const channel of channels) {
        try {
          await PushNotifications.createChannel(channel);
        } catch (e) {
          console.warn(`Failed to create channel ${channel.id}`, e);
        }
      }
    };

    const setup = async () => {
      try {
        // 1. Attach listeners FIRST — register() fires the "registration" event
        //    synchronously, so the listener must already be in place or the token
        //    is emitted before anyone is listening and never gets saved.
        await PushNotifications.addListener("registration", async (token) => {
          if (userId && token.value) {
            await supabase
              .from("user_push_tokens")
              .upsert(
                {
                  user_id: userId,
                  token: token.value,
                  platform: Capacitor.getPlatform(),
                },
                { onConflict: "user_id,token" },
              );
          }
        });

        await PushNotifications.addListener("registrationError", (error) => {
          console.error("Error on registration: " + JSON.stringify(error));
        });

        await PushNotifications.addListener(
          "pushNotificationReceived",
          async (notification) => {
            console.log("Push received: " + JSON.stringify(notification));
            // Show notification even when app is in foreground (native only)
            const title = notification.notification?.title || "New notification";
            const body = notification.notification?.body || "";
            const channelId = (notification.notification as any)?.channelId || "notify_announcements";

            if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
              try {
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      title,
                      body,
                      id: Math.floor(Math.random() * 100000),
                      ...(Capacitor.getPlatform() === 'android' && { channelId }),
                    },
                  ],
                });
              } catch (e) {
                console.warn("Failed to show foreground notification:", e);
              }
            }
          },
        );

        await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (notification) => {
            console.log("Push action performed: " + JSON.stringify(notification));
            const data = notification.notification.data || (notification as any).data;
            const baseUrl = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

            if (userId && data) {
              const type = data.type;
              const action = data.action;
              const matchId = data.matchId || data.match_id;

              if (type === "player_profile" && data.player_id) {
                window.location.href = `${baseUrl}/player/${data.player_id}`;
              } else if (action === "view_match" || type === "match_confirmation") {
                window.location.href = `${baseUrl}/feed/my-matches${matchId ? `?highlight=${matchId}` : ""}`;
              } else if (type === "kudos") {
                window.location.href = `${baseUrl}/feed/activity${matchId ? `?highlight=${matchId}` : ""}`;
              } else if (type === "challenge_expiry" || data.tab === "challenges") {
                window.location.href = `${baseUrl}/feed/challenges`;
              } else if (action === "view_announcements") {
                window.location.href = `${baseUrl}/feed/announcements`;
              } else if (matchId) {
                window.location.href = `${baseUrl}/feed/my-matches?highlight=${matchId}`;
              } else {
                window.location.href = `${baseUrl}/feed`;
              }
            }
          },
        );

        // 2. Create Android channels before registering
        await createAndroidChannels();

        // 3. Check permissions, then register (fires "registration" → listener saves token)
        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          const requested = await PushNotifications.requestPermissions();
          if (requested.receive !== "granted") return;
        } else if (permStatus.receive !== "granted") {
          return; // Permission denied
        }

        await PushNotifications.register();
        isRegistered = true;
      } catch (err) {
        console.warn("Failed to register push notifications", err);
      }
    };

    setup();

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

    const setupWebPush = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          if (!vapidKey) {
            console.warn("[WebPush] VITE_FIREBASE_VAPID_KEY is missing. Web push won't work.");
            return;
          }

          // Register SW first at the correct subpath, THEN init messaging so
          // Firebase never attempts its own root-level SW registration.
          const swRegistration = await navigator.serviceWorker.register(
            `${import.meta.env.BASE_URL}firebase-messaging-sw.js`,
            { scope: import.meta.env.BASE_URL }
          );

          const messaging = getFirebaseMessaging();
          if (!messaging) return;

          const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swRegistration,
          });

          if (token) {
            await supabase
              .from("user_push_tokens")
              .upsert(
                { user_id: userId, token, platform: "web" },
                { onConflict: "user_id,token" }
              );

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
