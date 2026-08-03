import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { App as CapacitorApp } from "@capacitor/app";

const ROUTE_KEY = "iiscshuttlers:last_route";

// Routes we never want to restore into (transient / redirect-only entry points)
const NO_RESTORE = new Set(["/", "/join", "/404"]);

/**
 * Persists the current route to localStorage and restores it on a cold start.
 *
 * Both the Android (Capacitor WebView) and the desktop PWA relaunch at "/",
 * losing the user's place. On the first render after a cold start we detect
 * that we've landed on the default entry point ("/") and, if a meaningful
 * route was saved from a previous session, navigate back to it.
 *
 * We only restore when the app opened at "/", so explicit URLs (shared links,
 * deep links, browser refresh on a specific page) are always respected.
 */
export function RoutePersistence() {
  const [location, setLocation] = useLocation();
  const restored = useRef(false);

  // Restore once, on cold start only.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    // Only restore when we landed on the default entry point.
    if (location !== "/") return;

    try {
      const saved = localStorage.getItem(ROUTE_KEY);
      if (saved && !NO_RESTORE.has(saved.split("?")[0].split("#")[0])) {
        // replace so the "/" cold-start entry doesn't sit in history
        setLocation(saved, { replace: true });
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — nothing to restore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every route change (including query string + hash).
  useEffect(() => {
    const saveState = () => {
      try {
        const full = location + window.location.search + window.location.hash;
        localStorage.setItem(ROUTE_KEY, full);
      } catch {
        // ignore write failures
      }
    };

    saveState();

    let sub: any;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) saveState();
    }).then(res => sub = res);

    return () => {
      if (sub) sub.remove();
    };
  }, [location]);

  return null;
}
