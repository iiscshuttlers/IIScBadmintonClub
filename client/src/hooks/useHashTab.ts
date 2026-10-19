import { useState, useEffect, useCallback } from "react";
import { Capacitor } from '@capacitor/core';

/**
 * useHashTab — keeps a tab state in sync with the URL so that
 * browser / Android Back works naturally.
 *
 * WEB:  uses window.location.hash + hashchange event.
 *       Each tab click pushes a new hash history entry so pressing
 *       Back walks back through tabs before leaving the page.
 *
 * CAPACITOR (Android / iOS):
 *       Uses window.history.pushState with a named key in the state
 *       object (no hash in the URL — hash changes can cause a WebView
 *       reload on some Android versions).  A popstate listener restores
 *       the tab when the hardware/gesture back button fires.
 *       The last tab is also written to localStorage so a cold-start
 *       returns to the right tab.
 */

const isCapacitor = Capacitor.isNativePlatform();

/** Build a stable storage key from the tab list */
function makeStateKey(validTabs: readonly string[]): string {
  return `htab__${validTabs.join("_")}`;
}

export function useHashTab<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
): [T, (tab: T) => void] {
  const stateKey = makeStateKey(validTabs);

  const getInitialTab = (): T => {
    if (!isCapacitor) {
      // Web: derive from hash
      try {
        const hash = window.location.hash.replace("#", "");
        if ((validTabs as readonly string[]).includes(hash)) return hash as T;
      } catch { /* ignore */ }
    } else {
      // Capacitor: check history state pushed by a previous tab click
      try {
        const sv = (window.history.state as Record<string, string> | null)?.[stateKey];
        if (sv && (validTabs as readonly string[]).includes(sv)) return sv as T;
      } catch { /* ignore */ }
    }
    // Both: fall back to persisted localStorage value
    try {
      const saved = localStorage.getItem("nav_" + stateKey);
      if (saved && (validTabs as readonly string[]).includes(saved)) return saved as T;
    } catch { /* ignore */ }
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState<T>(getInitialTab);

  useEffect(() => {
    if (!isCapacitor) {
      // ── WEB ──────────────────────────────────────────────────────────
      const onHashChange = () => {
        const hash = window.location.hash.replace("#", "");
        setActiveTab(
          (validTabs as readonly string[]).includes(hash) ? (hash as T) : defaultTab,
        );
      };
      window.addEventListener("hashchange", onHashChange);
      // Seed the hash on first render so Back can return to defaultTab
      if (!window.location.hash) {
        try { window.history.replaceState(null, "", `#${defaultTab}`); } catch { /* ignore */ }
      }
      return () => window.removeEventListener("hashchange", onHashChange);
    } else {
      // ── CAPACITOR ────────────────────────────────────────────────────
      // The hardware / gesture back button fires window.history.back()
      // via useNativeBackButton, which triggers popstate here.
      const onPopState = (e: PopStateEvent) => {
        const sv = (e.state as Record<string, string> | null)?.[stateKey];
        if (sv && (validTabs as readonly string[]).includes(sv)) {
          setActiveTab(sv as T);
        } else {
          // Popped past all tab entries — restore persisted or default
          const saved = (() => {
            try { return localStorage.getItem("nav_" + stateKey); } catch { return null; }
          })();
          setActiveTab(
            saved && (validTabs as readonly string[]).includes(saved)
              ? (saved as T)
              : defaultTab,
          );
        }
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = useCallback(
    (tab: T) => {
      setActiveTab(tab);

      if (!isCapacitor) {
        // Web: assign to hash — this pushes a history entry and fires hashchange
        try { window.location.hash = tab; } catch { /* ignore */ }
      } else {
        // Capacitor: push a state entry so Back can pop to the previous tab
        try {
          const newState: Record<string, string> = {
            ...(window.history.state as Record<string, string> | null ?? {}),
            [stateKey]: tab,
          };
          window.history.pushState(newState, "");
        } catch { /* ignore */ }
      }

      // Persist across sessions / cold starts
      try { localStorage.setItem("nav_" + stateKey, tab); } catch { /* ignore */ }
    },
    [stateKey],
  );

  return [activeTab, handleTabChange];
}
