import { motion } from "framer-motion";
import type { ElementType, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Brainy "VOLT" glow stat card — a dark-surface card with a blurred corner
 * orb, a tinted icon chip and an oversized neon numeral, all keyed to a
 * single accent colour.
 *
 * Pass `color` as a theme token (e.g. "var(--primary)", "var(--accent)",
 * "var(--chart-4)", "var(--secondary)") so the value stays vivid in dark mode
 * and legible in light mode.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  delay = 0,
  expandable,
  expanded,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  sub?: string;
  color: string;
  delay?: number;
  expandable?: boolean;
  expanded?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
      className={`relative h-full overflow-hidden rounded-2xl border border-border bg-card px-4 pt-4 ${expandable ? "pb-8" : "pb-4"} shadow-sm sheen`}
    >
      <div
        className="absolute -top-8 -right-8 h-28 w-28 rounded-full opacity-30 blur-2xl"
        style={{ background: color }}
      />
      <div className="relative flex flex-col gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div>
          <div className="flex min-h-16 items-center text-display text-[2rem]" style={{ color }}>
            {value}
          </div>
          <p className="mt-1.5 text-xs font-semibold text-foreground">{label}</p>
          {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {expandable && (
        <ChevronDown
          className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 transition-transform duration-300 ${
            expanded ? "rotate-180 text-primary" : "text-muted-foreground/60"
          }`}
        />
      )}
    </motion.div>
  );
}
