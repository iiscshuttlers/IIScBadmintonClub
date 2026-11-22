import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { recalledScroll, rememberScroll, routeKey } from "@/lib/routeContinuity";

const scrollMap = new Map<string, number>();

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

    const saved = scrollMap.get(key) ?? recalledScroll(key);
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let timeout = 0;

    const restore = () => window.scrollTo(0, saved ?? 0);

    if (saved != null && saved > 0) {
      // Tournament content is data-driven. Retry when its height changes so a
      // Back navigation is not clamped before the match list renders.
      frame = requestAnimationFrame(restore);
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(restore);
        observer.observe(document.body);
      }
      timeout = window.setTimeout(() => observer?.disconnect(), 3000);
    } else {
      restore();
    }

    previousKey.current = key;
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer?.disconnect();
    };
  }, [location, search]);

  return null;
}
