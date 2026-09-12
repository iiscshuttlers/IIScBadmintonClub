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

// onMessage() adds a new listener every call. enableWebPush() can run both
// automatically on load and again from the settings modal, so bind the
// foreground handler once or a single push fires duplicate sounds/toasts.
let foregroundHandlerBound = false;

/**
 * Turns on web/PWA push for this browser: requests Notification permission,
 * registers the FCM service worker, gets a token and saves it.
 *
 * Exported so the notification settings UI can run the exact same flow the app
 * runs automatically. Previously that modal's "Enable" button was native-only
 * and just told web users push wasn't supported.
 *
 * Returns true when push is active for this browser.
 */
export async function enableWebPush(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;

  try {
    // Don't re-prompt if the user already answered; requestPermission() resolves
    // immediately with the existing value, but this keeps the intent explicit.
    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") return false;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("[WebPush] VITE_FIREBASE_VAPID_KEY is missing. Web push won't work.");
      return false;
    }

    // Register SW first at the correct subpath, THEN init messaging so
    // Firebase never attempts its own root-level SW registration.
    //
    // The scope must NOT be BASE_URL. vite-plugin-pwa is configured with
    // `selfDestroying: true`, so registerSW.js claims BASE_URL on every
    // page load with a worker whose activate handler calls
    // registration.unregister(). A scope holds exactly one registration,
    // so the two scripts overwrite each other and the self-destroying one
    // tears this registration down — getToken() then fails silently and
    // no web token is ever saved. A nested scope keeps them independent;
    // this is also the scope Firebase uses by default.
    const swRegistration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}firebase-messaging-sw.js`,
      { scope: `${import.meta.env.BASE_URL}firebase-cloud-messaging-push-scope` }
    );

    const messaging = getFirebaseMessaging();
    if (!messaging) return false;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) return false;

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

    if (!foregroundHandlerBound) {
      foregroundHandlerBound = true;
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

    return true;
  } catch (err: any) {
    // Don't downgrade these to debug — an AbortError here is usually a real
    // fault (SW registration torn down, blocked push service), and hiding it
    // is why web push stayed broken silently.
    if (err.name === "AbortError" || err.message?.includes("push service error")) {
      console.warn("[WebPush] Push service unavailable or SW registration was torn down:", err);
    } else {
      console.warn("[WebPush] Failed to register web push:", err);
    }
    return false;
  }
}

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
            // Capacitor builds use a relative base ("./"), but the webview
            // serves the app from the origin root. Stripping the trailing slash
            // would leave ".", making every href below relative and compounding
            // the current path — tapping a notification from /player/a would
            // navigate to /player/player/b. Only web bases are real prefixes.
            const rawBase = import.meta.env.BASE_URL || "/";
            const baseUrl = rawBase.startsWith(".") ? "" : rawBase.replace(/\/$/, "");

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

    // Request permission if not already decided
    if (Notification.permission === "default") {
      // Delay slightly so we don't annoy users on first page load
      const timer = setTimeout(() => {
        enableWebPush();
      }, 5000);
      return () => clearTimeout(timer);
    } else if (Notification.permission === "granted") {
      enableWebPush();
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
