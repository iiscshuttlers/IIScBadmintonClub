import { Star, Circle } from "lucide-react";
import { RANKED_TOKENS } from "@/lib/tournamentTheme";

interface RankedBadgeProps {
  ranked: boolean | null | undefined;
  /** Compact = icon only (with aria-label); default shows icon + label. */
  compact?: boolean;
  /** Append the "Affects ELO" / "No ELO" sublabel. */
  withSublabel?: boolean;
  className?: string;
}

/**
 * Pill indicating whether a tournament counts toward ELO. Colour-blind-safe:
 * ranked = ★ amber "Ranked", casual = ○ slate "Casual" — never colour alone.
 */
export function RankedBadge({ ranked, compact = false, withSublabel = false, className = "" }: RankedBadgeProps) {
  const isRanked = ranked === true;
  const t = isRanked ? RANKED_TOKENS.ranked : RANKED_TOKENS.unranked;
  const Icon = isRanked ? Star : Circle;
  const label = withSublabel ? `${t.label} · ${t.sublabel}` : t.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${t.bgSoft} ${t.border} ${t.text} ${className}`}
      title={`${t.label} — ${t.sublabel}`}
      aria-label={`${t.label}. ${t.sublabel}.`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${isRanked ? "fill-current" : ""}`} aria-hidden="true" />
      {!compact && <span>{label}</span>}
    </span>
  );
}
