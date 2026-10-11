import { useEffect, useRef, type ReactNode } from "react";

export interface OverflowTab {
  id: string;
  label: string;
  icon?: ReactNode;
  /** optional count/badge shown after the label */
  badge?: ReactNode;
}

interface OverflowTabsProps {
  tabs: OverflowTab[];
  activeId: string;
  onChange: (id: string) => void;
  /** active pill classes (defaults to the app primary) */
  activeClassName?: string;
  className?: string;
}

/**
 * Horizontal tab strip that never overflows the viewport on mobile: it scrolls
 * with snap, fades at the edges to hint more tabs, and auto-scrolls the active
 * tab into view. Replaces raw `flex overflow-x-auto` tab rows that clipped the
 * last tab on narrow screens.
 */
export function OverflowTabs({
  tabs,
  activeId,
  onChange,
  activeClassName = "bg-primary text-primary-foreground shadow-md shadow-primary/20",
  className = "",
}: OverflowTabsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  return (
    <div className={`relative ${className}`}>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent" />

      <div
        ref={scrollerRef}
        role="tablist"
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-6 px-0.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeRef : undefined}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`inline-flex shrink-0 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-xs font-black transition-all sm:text-sm ${
                isActive
                  ? activeClassName
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge != null && <span className="shrink-0">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
