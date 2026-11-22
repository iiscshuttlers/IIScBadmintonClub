import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Replaces the current entry with `to(search, hash)` — used for the retired
 * /pulse and /legacy pages (see lib/sectionRedirects). Replace, not push, so
 * Back skips the old URL. Renders nothing; runs before any guest gate.
 */
export function SectionRedirect({ to }: { to: (search: string, hash: string) => string }) {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(to(window.location.search, window.location.hash), { replace: true });
  }, [to, setLocation]);
  return null;
}
