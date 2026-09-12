import { useState, useEffect, useCallback } from "react";

export function useQueryState<T extends string>(key: string, defaultValue: T): [T, (val: T) => void] {
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
    const onPopState = () => {
      setState(getVal());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [getVal]);

  const setUrlState = useCallback((val: T) => {
    setState(val);
    try {
      const url = new URL(window.location.href);
      if (val === defaultValue) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, val);
      }
      window.history.pushState(null, "", url.toString());
    } catch {
      // ignore
    }
  }, [key, defaultValue]);

  return [state, setUrlState];
}
