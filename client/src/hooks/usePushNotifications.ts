import { useEffect } from "react";
import { PushNotifications, type Channel } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { getFirebaseMessaging } from "@/lib/firebase";
import { getToken, onMessage } from "firebase/messaging";
import {
  playSmashSound,
  playPointSound,
  playServeSound,
  playWhistleSound,
  playVictorySound,
} from "@/lib/sounds";

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
        { id: "notify_smash",   name: "Match notifications",  description: "New matches logged against you",            importance: 4, visibility: 1 },
        { id: "notify_point",   name: "Match confirmations",  description: "When your match result is confirmed",        importance: 4, visibility: 1 },
        { id: "notify_serve",   name: "Match requests",       description: "Pings and match requests from other players",importance: 4, visibility: 1 },
        { id: "notify_whistle", name: "Announcements",        description: "Club announcements and live match alerts",   importance: 3, visibility: 1 },
        { id: "notify_victory", name: "Achievements",         description: "ELO milestones, top-10, buddy requests",    importance: 3, visibility: 1 },
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
            console.log("[Push] Token received, registering via edge function. platform:", Capacitor.getPlatform());
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-push-token`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                  },
                  body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
                }
              );
              const result = await res.json();
              if (!res.ok) {
                console.error("[Push] Edge function token save failed:", result);
              } else {
                console.log("[Push] Token registered via edge function:", result);
              }
            } catch (err) {
              console.error("[Push] Failed to register token:", err);
            }
          } else {
            console.warn("[Push] Registration event fired but userId or token is missing. userId:", userId);
          }
        });

        await PushNotifications.addListener("registrationError", (error) => {
          console.error("Error on registration: " + JSON.stringify(error));
        });

        await PushNotifications.addListener(
          "pushNotificationReceived",
          async (notification) => {
            console.log("Push received: " + JSON.stringify(notification));
            // Capacitor automatically shows the foreground alert based on presentationOptions in capacitor.config.ts.
            // We just need to play the appropriate custom sound if needed.
            
            // Get channelId either from data or the root
            const channelId = notification.data?.channelId || (notification as any).channelId || "notify_whistle";

            // Play the corresponding foreground sound
            if (channelId === "notify_smash") playSmashSound();
            else if (channelId === "notify_point") playPointSound();
            else if (channelId === "notify_serve") playServeSound();
            else if (channelId === "notify_victory") playVictorySound();
            else playWhistleSound();
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

              if ((type === "player_profile" || type === "buddy_request" || type === "follow" || type === "status_update" || type === "elo_milestone") && data.player_id) {
                window.location.href = `${baseUrl}/player/${data.player_id}`;
              } else if (action === "view_match" || type === "match_confirmation" || type === "match_logged" || type === "kudos") {
                window.location.href = `${baseUrl}/my-matches${matchId ? `?highlight=${matchId}` : ""}`;
              } else if (type === "challenge_expiry" || type === "new_challenge" || action === "view_challenges" || data.tab === "challenges") {
                window.location.href = `${baseUrl}/my-matches`;
              } else if (type === "find_lost" || type === "find_lost_post" || action === "view_find_lost") {
                window.location.href = `${baseUrl}/hub?tab=lost-found`;
              } else if (type === "live_score" || action === "view_live_score") {
                window.location.href = `${baseUrl}/pulse`;
              } else if (type === "announcement" || type === "weekly_digest" || action === "view_announcements") {
                window.location.href = `${baseUrl}/pulse#announcements`;
              } else if (matchId) {
                window.location.href = `${baseUrl}/my-matches?highlight=${matchId}`;
              } else {
                window.location.href = `${baseUrl}/pulse`;
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

    // Refresh token periodically to prevent FCM expiration (~7 days without refresh)
    const refreshInterval = setInterval(() => {
      PushNotifications.register().catch((err) =>
        console.warn("Push token refresh failed", err),
      );
    }, 6 * 60 * 60 * 1000);

    return () => {
      clearInterval(refreshInterval);
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
            try {
              const { data: { session } } = await supabase.auth.getSession();
              await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-push-token`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                  },
                  body: JSON.stringify({ token, platform: "web" }),
                }
              );
            } catch (err) {
              console.warn("[WebPush] Failed to register web token:", err);
            }

            onMessage(messaging, (payload) => {
              console.log("[WebPush] Message received in foreground:", payload);
              const title = payload.notification?.title || "New Match Update";
              const body = payload.notification?.body || "Check out the latest action!";
              
              // Guess the right sound based on type/data if available
              const data = payload.data || {};
              const type = data.type || "";
              
              if (type === "match_confirmation") playPointSound();
              else if (type === "new_match") playSmashSound();
              else if (type === "serve" || type === "kudos") playServeSound();
              else if (type === "elo_milestone" || type === "top10") playVictorySound();
              else playWhistleSound();

              showWebNotification(title, body);
            });
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError" || err.message?.includes("push service error")) {
          console.debug("[WebPush] Push service not available in this browser/mode.");
        } else {
          console.warn("[WebPush] Failed to register web push:", err);
        }
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
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") showWebNotification(title, body, onClick);
    });
    return;
  }
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
