import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const scrollMap = new Map<string, number>();

export function ScrollToTop() {
  const [location] = useLocation();
  const prevLocation = useRef<string | null>(null);

  useEffect(() => {
    // Save scroll position for the previous route
    if (prevLocation.current && prevLocation.current !== location) {
      scrollMap.set(prevLocation.current, window.scrollY);
    }

    // Restore or reset
    const saved = scrollMap.get(location);
    if (saved !== undefined) {
      requestAnimationFrame(() => window.scrollTo(0, saved));
    } else {
      window.scrollTo(0, 0);
    }

    prevLocation.current = location;
  }, [location]);

  return null;
}
