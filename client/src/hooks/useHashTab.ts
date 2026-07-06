import { useState, useEffect, useCallback } from "react";

/**
 * useHashTab — keeps a tab state in sync with `window.location.hash`
 * so that browser Back / Forward works naturally.
 *
 * On Capacitor (Android/iOS), hash manipulation via replaceState can crash
 * the WebView, so we skip it entirely and use pure in-memory state.
 *
 * @param validTabs  - Array of allowed tab ids (strings)
 * @param defaultTab - Tab to fall back to when the hash is missing / invalid
 * @returns [activeTab, handleTabChange]
 */

/** True when running inside a Capacitor native shell */
const isCapacitor = typeof (window as any).Capacitor !== "undefined";

export function useHashTab<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
): [T, (tab: T) => void] {
  const getHashTab = (): T => {
    if (isCapacitor) return defaultTab;
    try {
      const hash = window.location.hash.replace("#", "");
      return (validTabs as readonly string[]).includes(hash)
        ? (hash as T)
        : defaultTab;
    } catch {
      return defaultTab;
    }
  };

  const [activeTab, setActiveTab] = useState<T>(getHashTab);

  // Listen for browser back / forward (hashchange) — web only
  useEffect(() => {
    if (isCapacitor) return;
    const onHashChange = () => {
      setActiveTab(getHashTab());
    };
    window.addEventListener("hashchange", onHashChange);
    // If there's no hash yet, push the default (replaceState keeps history clean)
    if (!window.location.hash) {
      try {
        window.history.replaceState(null, "", `#${defaultTab}`);
      } catch {
        // Ignore – some environments block this
      }
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user explicitly clicks a tab, push a new history entry
  const handleTabChange = useCallback((tab: T) => {
    setActiveTab(tab);
    if (!isCapacitor) {
      try {
        window.location.hash = tab; // pushes proper history entry
      } catch {
        // Ignore
      }
    }
  }, []);

  return [activeTab, handleTabChange];
}
