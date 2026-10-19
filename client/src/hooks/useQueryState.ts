import { useState, useEffect, useCallback } from "react";

/**
 * useQueryState — syncs a piece of state with a URL query parameter.
 *
 * @param key          - Query-string key (e.g. "subtab")
 * @param defaultValue - Value used when the param is absent
 * @param replace      - When true, use replaceState instead of pushState so
 *                       filter/secondary state changes don't litter history.
 *                       Use false (default) for primary navigation tabs.
 */
export function useQueryState<T extends string>(
  key: string,
  defaultValue: T,
  replace = false,
): [T, (val: T) => void] {
  const getVal = useCallback((): T => {
    try {
      const params = new URLSearchParams(window.location.search);
      const val = params.get(key);
      return val !== null ? (val as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  }, [key, defaultValue]);

  const [state, setState] = useState<T>(getVal);

  useEffect(() => {
    const onPopState = () => setState(getVal());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [getVal]);

  const setUrlState = useCallback(
    (val: T) => {
      setState(val);
      try {
        const url = new URL(window.location.href);
        if (val === defaultValue) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, val);
        }
        if (replace) {
          window.history.replaceState(window.history.state ?? null, "", url.toString());
        } else {
          window.history.pushState(null, "", url.toString());
        }
      } catch {
        // ignore
      }
    },
    [key, defaultValue, replace],
  );

  return [state, setUrlState];
}
