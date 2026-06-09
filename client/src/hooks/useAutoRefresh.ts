import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

export function useAutoRefresh(
  fetchFn: () => void | Promise<void>,
  intervalMs = 60_000,
  enabled = true,
) {
  const savedFn = useRef(fetchFn);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    savedFn.current = fetchFn;
  }, [fetchFn]);

  const tick = useCallback(() => {
    if (document.visibilityState === "visible") {
      savedFn.current();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    timerRef.current = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        savedFn.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // On Capacitor (Android/iOS), visibilitychange is unreliable — use appStateChange
    let removeCapacitorListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) savedFn.current();
        }).then((handle) => {
          removeCapacitorListener = () => handle.remove();
        });
      });
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      removeCapacitorListener?.();
    };
  }, [intervalMs, enabled, tick]);
}
