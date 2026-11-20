import type { ReactNode } from "react";

/**
 * FotMob/BWF-style horizontal chip selector (day, court, …). One row that
 * scrolls sideways instead of a dropdown, with ≥44 px targets and
 * `aria-pressed` on the selected chip. The empty string value means "all".
 */

export interface ChipOption {
  value: string;
  label: ReactNode;
  /** Extra screen-reader text appended to the label, e.g. ", live". */
  srSuffix?: string;
}

export function ChipStrip({
  label,
  options,
  value,
  onChange,
}: {
  /** Accessible group name, e.g. "Day" or "Court". */
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-1 px-1 flex flex-wrap gap-1.5 pb-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value || "__all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-xs font-black whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active
                ? "bg-foreground text-background"
                : "bg-muted text-soft"
            }`}
          >
            {o.label}
            {o.srSuffix && <span className="sr-only">{o.srSuffix}</span>}
          </button>
        );
      })}
    </div>
  );
}
