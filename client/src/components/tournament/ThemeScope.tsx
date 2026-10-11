import type { CSSProperties, ReactNode } from "react";
import { FAMILY_CSS_VARS, getEventFamily, type EventFamily, type TournamentThemeInput } from "@/lib/tournamentTheme";

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
 * editing each class. Mirrors the global data-accent mechanism, but scoped.
 */
export function ThemeScope({ family, className, children, ...input }: ThemeScopeProps) {
  const resolved = family ?? getEventFamily(input);
  return (
    <div style={FAMILY_CSS_VARS[resolved] as CSSProperties} className={className}>
      {children}
    </div>
  );
}
