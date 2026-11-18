import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useLocation } from "wouter";
import { notificationTarget } from "@/lib/notificationDeepLinks";

export function useNotificationDeepLinks() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const open = (data: Record<string, unknown> | null | undefined) => {
      const target = notificationTarget(data);
      if (!target) return;
      if (target.kind === "external") {
        window.open(target.url, "_system");
        return;
      }
      navigate(target.path);
    };

    let nativeHandle: { remove: () => Promise<void> | void } | null = null;
    if (Capacitor.isNativePlatform()) {
      void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        open((action.notification?.data ?? (action as unknown as { data?: Record<string, unknown> }).data) as Record<string, unknown> | undefined);
      }).then((handle) => { nativeHandle = handle; });
    }

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_DEEP_LINK") open({ link: event.data.path });
    };
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      void nativeHandle?.remove();
    };
  }, [navigate]);
}
