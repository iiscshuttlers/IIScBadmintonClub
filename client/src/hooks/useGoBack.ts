import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { canGoBackInApp, registerParentFallback } from "@/lib/navHistory";
import { restoreScrollOnNextRoute } from "@/lib/scrollRestoreIntent";

/**
 * Back for a screen: the previous in-app screen when there is one, otherwise
 * `parent` (replacing the current entry, so Back from the parent doesn't
 * bounce forward again). Also tells the phone's Back key where the parent is.
 *
 * `parent` is a wouter path ("/players", "/tournaments/…?cat=XD").
 */
export function useGoBack(parent: string): () => void {
  const [, navigate] = useLocation();
  const parentRef = useRef(parent);
  parentRef.current = parent;

  const goToParent = useCallback(() => {
    // Still a Back: return to where the parent list was left, if remembered.
    restoreScrollOnNextRoute();
    navigate(parentRef.current, { replace: true });
  }, [navigate]);

  useEffect(() => registerParentFallback(goToParent), [goToParent]);

  return useCallback(() => {
    if (canGoBackInApp()) window.history.back();
    else goToParent();
  }, [goToParent]);
}
