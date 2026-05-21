import { useEffect, useRef, useCallback } from "react";

/**
 * useAutoRefresh — silently re-fetches data on an interval while the tab is visible.
 * Scroll position is never touched; React reconciliation handles DOM updates in-place.
 *
 * @param fetchFn   The async function that refreshes data (should update state internally).
 * @param intervalMs Polling interval in milliseconds (default 60 000 = 1 min).
 * @param enabled   Set to false to pause polling (e.g. while a modal is open).
 */
export function useAutoRefresh(
  fetchFn: () => void | Promise<void>,
  intervalMs = 60_000,
  enabled = true
) {
  const savedFn = useRef(fetchFn);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always keep the latest fetch function in the ref
  useEffect(() => {
    savedFn.current = fetchFn;
  }, [fetchFn]);

  const tick = useCallback(() => {
    // Only refresh when the tab is active — saves bandwidth on background tabs
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

    // Also fire immediately when the user returns to the tab after being away
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        savedFn.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled, tick]);
}
