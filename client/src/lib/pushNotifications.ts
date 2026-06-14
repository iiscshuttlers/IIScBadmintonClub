import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";

/** Navigate based on data payload from a push notification tap (#19). */
function handleDeepLink(data: Record<string, string> | undefined) {
  if (!data) return;

  const type = data.type;
  if (!type) return;

  switch (type) {
    case "match_confirmation":
      window.location.href = "/feed/my-matches";
      break;
    case "challenge_expiry":
      window.location.href = "/feed/challenges";
      break;
    case "new_challenge":
      if (data.challenge_id) {
        window.location.href = `/feed/challenges`;
      }
      break;
    case "find_lost":
      window.location.href = "/find-lost";
      break;
    case "announcement":
      window.location.href = "/feed/announcements";
      break;
    case "kudos":
    case "player_profile":
      if (data.player_id) {
        window.location.href = `/player/${data.player_id}`;
      } else {
        window.location.href = "/feed";
      }
      break;
    case "elo_milestone":
      if (data.player_id) {
        window.location.href = `/player/${data.player_id}`;
      }
      break;
    case "weekly_digest":
      window.location.href = "/feed/my-matches";
      break;
    default:
      window.location.href = "/feed";
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
      { user_id: userId, token: token.value, platform: Capacitor.getPlatform() },
      { onConflict: "user_id, token" },
    );
  });

  PushNotifications.addListener("registrationError", (error: any) => {
    console.error("Push registration error:", JSON.stringify(error));
  });

  PushNotifications.addListener("pushNotificationReceived", (_notification) => {
    // Foreground notification — could show an in-app toast here
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification?.data as Record<string, string> | undefined;
    handleDeepLink(data);
  });
};
