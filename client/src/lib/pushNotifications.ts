import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";
import { playSmashSound } from "./sounds";

/** Navigate based on data payload from a push notification tap (#19). */
function handleDeepLink(data: Record<string, string> | undefined) {
  if (!data) return;

  // Some senders only set `action`, others only set `type` — check both.
  const type = data.type || data.action;
  if (!type) return;

  switch (type) {
    case "match_confirmation":
    case "match_logged":
    case "view_match":
      window.location.href = "/my-matches";
      break;
    case "challenge_expiry":
    case "new_challenge":
    case "view_challenges":
      window.location.href = "/my-matches";
      break;
    case "find_lost":
    case "find_lost_post":
    case "view_find_lost":
      window.location.href = "/hub?tab=lost-found";
      break;
    case "announcement":
    case "view_announcements":
      window.location.href = "/pulse#announcements";
      break;
    case "kudos":
      window.location.href = "/my-matches";
      break;
    case "player_profile":
    case "buddy_request":
    case "follow":
    case "status_update":
    case "elo_milestone":
      if (data.player_id) {
        window.location.href = `/player/${data.player_id}`;
      } else {
        window.location.href = "/pulse";
      }
      break;
    case "weekly_digest":
      window.location.href = "/my-matches";
      break;
    default:
      window.location.href = "/pulse";
  }
}

export const registerPushNotifications = async (userId: string) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== "granted") {
    console.log("User denied push notifications");
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", async (token) => {
    await supabase.from("user_push_tokens").upsert(
      { user_id: userId, token: token.value, platform: Capacitor.getPlatform(), updated_at: new Date().toISOString() },
      { onConflict: "user_id, token" },
    );
  });

  PushNotifications.addListener("registrationError", (error: any) => {
    console.error("Push registration error:", JSON.stringify(error));
  });

  PushNotifications.addListener("pushNotificationReceived", (_notification) => {
    playSmashSound();
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification?.data as Record<string, string> | undefined;
    handleDeepLink(data);
  });

  // Refresh token every 6 hours to prevent expiration (FCM tokens expire after ~7 days without refresh)
  setInterval(() => {
    PushNotifications.register().catch(err => console.error("Token refresh failed:", err));
  }, 6 * 60 * 60 * 1000);
};
