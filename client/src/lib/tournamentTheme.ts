/**
 * Tournament theming tokens.
 *
 * Two event families get distinct, scoped identities so a user always knows
 * which world they are in:
 *   - individual (Open events)  → violet / indigo
 *   - team       (Team events)  → emerald / teal
 *
 * Ranked state is a separate, colour-blind-safe accent (always paired with an
 * icon + label, never colour alone):
 *   - ranked   → amber / gold  (★ "Ranked" — affects ELO)
 *   - unranked → slate / muted (○ "Casual" — no ELO)
 *
 * These are returned as complete Tailwind class-string literals so the JIT
 * scanner picks them up. Do NOT build these strings dynamically.
 */

export type EventFamily = "individual" | "team";

export interface TournamentThemeInput {
  tournament_type?: string | null;   // 'open' | 'team'
  format_family?: string | null;     // 'OPEN_EVENT' | 'TEAM' | ...
  counts_for_elo?: boolean | null;
}

export interface FamilyTokens {
  /** solid accent text, e.g. headings / icons */
  text: string;
  /** solid accent background (for primary pills / buttons) */
  bg: string;
  /** soft tinted background (for subtle chips / surfaces) */
  bgSoft: string;
  /** accent border */
  border: string;
  /** focus/selection ring */
  ring: string;
  /** gradient stops for hero / banners */
  gradient: string;
}

export interface TournamentTheme {
  family: EventFamily;
  ranked: boolean;
  /** human label for the event family */
  familyLabel: string;
  tokens: FamilyTokens;
}

const INDIVIDUAL: FamilyTokens = {
  text: "text-violet-600 dark:text-violet-300",
  bg: "bg-violet-600",
  bgSoft: "bg-violet-50 dark:bg-violet-500/10",
  border: "border-violet-200 dark:border-violet-500/30",
  ring: "ring-violet-500/40",
  gradient: "from-violet-500 to-indigo-500",
};

const TEAM: FamilyTokens = {
  text: "text-emerald-600 dark:text-emerald-300",
  bg: "bg-emerald-600",
  bgSoft: "bg-emerald-50 dark:bg-emerald-500/10",
  border: "border-emerald-200 dark:border-emerald-500/30",
  ring: "ring-emerald-500/40",
  gradient: "from-emerald-500 to-teal-500",
};

/** Derive the event family from either tournament_type or format_family. */
export function getEventFamily(input: TournamentThemeInput): EventFamily {
  const t = (input.tournament_type || "").toLowerCase();
  const f = (input.format_family || "").toUpperCase();
  if (t === "team" || f === "TEAM") return "team";
  return "individual";
}

export function getTournamentTheme(input: TournamentThemeInput): TournamentTheme {
  const family = getEventFamily(input);
  return {
    family,
    ranked: input.counts_for_elo === true,
    familyLabel: family === "team" ? "Team Event" : "Individual",
    tokens: family === "team" ? TEAM : INDIVIDUAL,
  };
}

/**
 * CSS-variable overrides per family. Setting `--primary` on a wrapper re-tints
 * every `bg-primary` / `text-primary` / `ring-primary` descendant to the event
 * family's colour (the same mechanism the global data-accent themes use), so a
 * whole console section can adopt its family identity without per-class edits.
 */
export const FAMILY_CSS_VARS: Record<EventFamily, Record<string, string>> = {
  individual: {
    // violet-600
    "--primary": "#7c3aed",
    "--primary-foreground": "#ffffff",
  },
  team: {
    // emerald-600
    "--primary": "#059669",
    "--primary-foreground": "#ffffff",
  },
};

/** Ranked-state tokens (colour-blind-safe: always paired with icon + label). */
export const RANKED_TOKENS = {
  ranked: {
    text: "text-amber-600 dark:text-amber-300",
    bgSoft: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/40",
    label: "Ranked",
    sublabel: "Affects ELO",
  },
  unranked: {
    text: "text-slate-500 dark:text-slate-400",
    bgSoft: "bg-slate-100 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-600/50",
    label: "Casual",
    sublabel: "No ELO",
  },
} as const;
