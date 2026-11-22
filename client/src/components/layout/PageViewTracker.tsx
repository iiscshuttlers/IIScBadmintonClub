import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";
import { normaliseRoute } from "@/lib/pageViews";

/** How long a screen must stay open to count; skips redirect hops (/pulse → /tournaments). */
const SETTLE_MS = 1000;

/**
 * Logs one `page_view` per screen change for signed-in members (track() is
 * a no-op for visitors), with only the route shape (lib/pageViews). Tab
 * changes that only touch ?query or #hash on the same screen don't count.
 */
export function PageViewTracker() {
  const [location] = useLocation();
  const { session } = useAuth();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      if (lastPath.current === location) return;
      lastPath.current = location;
      track("page_view", { route: normaliseRoute(location) });
    }, SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [location, session]);

  return null;
}
