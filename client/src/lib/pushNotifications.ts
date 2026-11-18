import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "./supabase";
import { playSmashSound } from "./sounds";
import { notificationTarget } from "./notificationDeepLinks";

/** Navigate based on data payload from a push notification tap (#19). */
function handleDeepLink(data: Record<string, string> | undefined) {
  const target = notificationTarget(data);
  if (!target) return;
  if (target.kind === "external") window.open(target.url, "_system");
  else window.location.href = target.path;
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
