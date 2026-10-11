import { User, Users } from "lucide-react";
import { getTournamentTheme, type TournamentThemeInput } from "@/lib/tournamentTheme";

interface EventTypeBadgeProps extends TournamentThemeInput {
  /** Compact = icon only (with aria-label); default shows icon + label. */
  compact?: boolean;
  className?: string;
}

/**
 * Pill that identifies a tournament's event family (Individual vs Team),
 * themed in that family's colour. Icon + label, so it reads without colour.
 */
export function EventTypeBadge({ compact = false, className = "", ...input }: EventTypeBadgeProps) {
  const { family, familyLabel, tokens } = getTournamentTheme(input);
  const Icon = family === "team" ? Users : User;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${tokens.bgSoft} ${tokens.border} ${tokens.text} ${className}`}
      title={familyLabel}
      aria-label={familyLabel}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {!compact && <span>{familyLabel}</span>}
    </span>
  );
}
