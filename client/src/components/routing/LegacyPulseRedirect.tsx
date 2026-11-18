import { useEffect, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { canonicalFromPulse } from "@/lib/tournamentRoutes";

/**
 * WP5: tournament- or match-scoped Pulse links (`/pulse?id=…`,
 * `/pulse#match-card-…`) move to their canonical URLs. Runs before any
 * guest gate so old links work for signed-out visitors; club-wide Pulse
 * URLs render `children` untouched.
 */
export function LegacyPulseRedirect({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const search = useSearch(); // re-evaluate when the query changes in-app
  const target = typeof window === "undefined" ? null : canonicalFromPulse(search, window.location.hash);

  useEffect(() => {
    if (target) setLocation(target, { replace: true });
  }, [target, setLocation]);

  return target ? null : <>{children}</>;
}
