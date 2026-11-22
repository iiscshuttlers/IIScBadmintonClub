import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SectionTab<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
}

/** Up to three per row on phones; one row from `sm` up. */
const PHONE_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

/**
 * The segmented tab bar under a section page's header (Club, Players).
 * Buttons report their state with aria-pressed.
 */
export function SectionTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: readonly SectionTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  label: string;
}) {
  return (
    <div className="flex justify-center w-full px-2">
      <div
        role="group"
        aria-label={label}
        className={cn(
          "grid sm:flex sm:flex-wrap sm:justify-center gap-1 w-full sm:w-auto bg-muted/80 backdrop-blur-md p-1 rounded-2xl border border-border shadow-inner",
          PHONE_COLS[Math.min(tabs.length, 3)],
        )}
      >
        {tabs.map(({ id, label: tabLabel, icon }) => (
          <Button
            key={id}
            variant="tab"
            size="tab"
            onClick={() => onChange(id)}
            aria-pressed={active === id}
            className={cn(
              "w-full sm:w-auto",
              active === id
                ? "bg-card text-primary shadow-md scale-100"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 scale-95",
            )}
          >
            {icon} {tabLabel}
          </Button>
        ))}
      </div>
    </div>
  );
}
