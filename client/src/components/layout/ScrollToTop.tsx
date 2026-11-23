import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { recalledScroll, rememberScroll, routeKey } from "@/lib/routeContinuity";
import { takeScrollRestoreIntent } from "@/lib/scrollRestoreIntent";

const scrollMap = new Map<string, number>();

/** Input that means the user is scrolling themselves, so stop restoring. */
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

export function ScrollToTop() {
  const [location] = useLocation();
  const search = useSearch();
  const previousKey = useRef<string | null>(null);
  // The last offset a scroll event reported. On a route change the next page
  // has already rendered, and if it is shorter the browser has clamped
  // window.scrollY, so reading it then saved 0 and Back lost the list position.
  const lastScrollY = useRef(typeof window === "undefined" ? 0 : window.scrollY);

  useEffect(() => {
    const onScroll = () => {
      lastScrollY.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Runs right after the new route commits, before the browser dispatches the
  // scroll event caused by clamping to the new page's height.
  useLayoutEffect(() => {
    const key = routeKey(location, search, window.location.hash);
    if (previousKey.current && previousKey.current !== key) {
      scrollMap.set(previousKey.current, lastScrollY.current);
      rememberScroll(previousKey.current, lastScrollY.current);
    }
  }, [location, search]);

  useEffect(() => {
    const key = routeKey(location, search, window.location.hash);

    // Browser restoration and app restoration otherwise compete on Android.
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";

    // Only Back/Forward, a reload or useGoBack's fallback restore; a link tap
    // starts at the top (lib/scrollRestoreIntent).
    const saved = takeScrollRestoreIntent() ? scrollMap.get(key) ?? recalledScroll(key) : null;
    previousKey.current = key;

    if (saved == null || saved <= 0) {
      window.scrollTo(0, 0);
      return;
    }

    // Tournament content is data-driven. Retry when the page grows so a Back
    // navigation is not clamped before the match list renders, but stop as
    // soon as the offset is reached or the user scrolls: re-applying it on
    // every resize yanked the page back while the user was reading.
    let frame = 0;
    let timeout = 0;
    let observer: ResizeObserver | undefined;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop);
    };
    const restore = () => {
      if (stopped) return;
      window.scrollTo(0, saved);
      if (Math.abs(window.scrollY - saved) < 2) stop();
    };

    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, { passive: true });
    frame = requestAnimationFrame(restore);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(restore);
      observer.observe(document.body);
    }
    timeout = window.setTimeout(stop, 3000);

    return stop;
  }, [location, search]);

  return null;
}
