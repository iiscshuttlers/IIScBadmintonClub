/**
 * Whether the next route change should get its remembered scroll offset back
 * (read by components/layout/ScrollToTop).
 *
 * Only Back/Forward (popstate), a reload, and useGoBack's parent fallback
 * restore. A link tap to a page visited earlier starts at the top, as on any
 * website; restoring there made pages open at seemingly random positions.
 *
 * `href` pins the intent to the URL it was made for, so a popstate that did
 * not change the route (an in-page history step) can't leak into the next
 * link tap. `null` means "whichever route comes next" (set right before a
 * navigation); it lapses after a second in case that navigation was a no-op.
 */
let intent: { href: string | null; at: number } | null = null;
const NEXT_ROUTE_WINDOW_MS = 1000;

if (typeof window !== "undefined") {
  // Capture phase, registered at import: runs before wouter's own popstate
  // listener re-renders the app, so the intent is set when ScrollToTop runs.
  window.addEventListener(
    "popstate",
    () => {
      intent = { href: window.location.href, at: Date.now() };
    },
    { capture: true },
  );
  try {
    const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav && (nav.type === "reload" || nav.type === "back_forward")) {
      intent = { href: window.location.href, at: Date.now() };
    }
  } catch {
    // Navigation timing unavailable: a fresh load starts at the top.
  }
}

/** Restore the remembered offset on the next route (a programmatic Back). */
export function restoreScrollOnNextRoute(): void {
  intent = { href: null, at: Date.now() };
}

/** Consumes the intent: true when the route now showing should restore. */
export function takeScrollRestoreIntent(): boolean {
  const current = intent;
  intent = null;
  if (!current) return false;
  if (current.href === null) return Date.now() - current.at < NEXT_ROUTE_WINDOW_MS;
  return current.href === window.location.href;
}
