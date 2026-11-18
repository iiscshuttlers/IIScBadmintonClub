import type { ReactNode } from "react";
import { FAMILY_CLASS, getEventFamily, type EventFamily, type TournamentThemeInput } from "@/lib/tournamentTheme";

interface ThemeScopeProps extends TournamentThemeInput {
  /** Explicit family override; otherwise derived from the tournament fields. */
  family?: EventFamily;
  className?: string;
  children: ReactNode;
}

/**
 * Re-tints its subtree to the event family's accent by overriding the `--primary`
 * CSS variable, so every `bg-primary` / `text-primary` / `ring-primary` inside
 * adopts the family colour (violet for individual, emerald for team) without
 * editing each class. The variables live in index.css (`.family-*`) so dark
 * mode gets the lighter, AA-readable shade.
 */
export function ThemeScope({ family, className, children, ...input }: ThemeScopeProps) {
  const resolved = family ?? getEventFamily(input);
  return <div className={className ? `${FAMILY_CLASS[resolved]} ${className}` : FAMILY_CLASS[resolved]}>{children}</div>;
}
