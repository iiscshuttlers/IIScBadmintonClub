import { useState, useEffect, useCallback } from "react";

/**
 * useHashTab — keeps a tab state in sync with `window.location.hash`
 * so that browser Back / Forward works naturally.
 *
 * @param validTabs  - Array of allowed tab ids (strings)
 * @param defaultTab - Tab to fall back to when the hash is missing / invalid
 * @returns [activeTab, handleTabChange]
 */
export function useHashTab<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
): [T, (tab: T) => void] {
  const getHashTab = (): T => {
    const hash = window.location.hash.replace("#", "");
    return (validTabs as readonly string[]).includes(hash)
      ? (hash as T)
      : defaultTab;
  };

  const [activeTab, setActiveTab] = useState<T>(getHashTab);

  // Listen for browser back / forward (hashchange)
  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(getHashTab());
    };
    window.addEventListener("hashchange", onHashChange);
    // If there's no hash yet, push the default (replaceState keeps history clean)
    if (!window.location.hash) {
      window.history.replaceState(null, "", `#${defaultTab}`);
    }
    return () => window.removeEventListener("hashchange", onHashChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user explicitly clicks a tab, push a new history entry
  const handleTabChange = useCallback((tab: T) => {
    setActiveTab(tab);
    window.location.hash = tab; // pushes proper history entry
  }, []);

  return [activeTab, handleTabChange];
}
