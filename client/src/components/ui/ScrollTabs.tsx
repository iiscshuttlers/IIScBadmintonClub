import { useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";

/**
 * Cricbuzz/FotMob-style section tabs: one horizontally scrolling row of
 * link pills (≥44 px), `aria-current="page"` on the active one, and the
 * active pill kept in view horizontally only (never scrolls the page).
 * Same behaviour as the tournament tab row in Pulse `LiveTab`.
 */

export interface ScrollTab {
  key: string;
  label: string;
  href: string;
}

function revealActive(row: HTMLElement | null, smooth: boolean) {
  const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
  if (!row || !active) return;
  const r = row.getBoundingClientRect();
  const a = active.getBoundingClientRect();
  const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
  if (a.left < r.left) row.scrollBy({ left: a.left - r.left - 16, behavior });
  else if (a.right > r.right) row.scrollBy({ left: a.right - r.right + 16, behavior });
}

export function ScrollTabs({
  tabs,
  activeKey,
  label,
  replace = true,
}: {
  tabs: ScrollTab[];
  activeKey: string;
  /** Accessible name of the navigation landmark. */
  label: string;
  /** Replace history on switch so Back leaves the page rather than stepping through tabs. */
  replace?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const setRow = useCallback((el: HTMLDivElement | null) => {
    rowRef.current = el;
    if (!el) return;
    requestAnimationFrame(() => revealActive(el, false));
    document.fonts?.ready.then(() => revealActive(el, false)).catch(() => {});
  }, []);
  useEffect(() => {
    const f = requestAnimationFrame(() => revealActive(rowRef.current, true));
    return () => cancelAnimationFrame(f);
  }, [activeKey]);

  return (
    <nav
      aria-label={label}
      ref={setRow}
      className="flex flex-wrap items-center gap-2 pb-1"
    >
      {tabs.map((t) => {
        const active = t.key === activeKey;
        return (
          <Link
            key={t.key}
            href={t.href}
            replace={replace}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 inline-flex items-center min-h-[44px] px-4 rounded-full text-sm font-black whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? "bg-foreground text-background"
                : "bg-card text-soft border border-border"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
