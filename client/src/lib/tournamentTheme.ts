/**
 * Tournament theming tokens.
 *
 * Two event families get distinct, scoped identities so a user always knows
 * which world they are in:
 *   - individual (Open events)  → the theme's `individual` colour
 *   - team       (Team events)  → the theme's `team` colour
 *
 * Ranked state is a separate, colour-blind-safe accent (always paired with an
 * icon + label, never colour alone):
 *   - ranked   → gold  (★ "Ranked" — affects ELO)
 *   - unranked → muted (○ "Casual" — no ELO)
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
  text: "text-individual",
  bg: "bg-individual",
  bgSoft: "bg-individual/10",
  border: "border-individual/30",
  ring: "ring-individual/40",
  gradient: "from-individual to-info",
};

const TEAM: FamilyTokens = {
  text: "text-team",
  bg: "bg-team",
  bgSoft: "bg-team/10",
  border: "border-team/30",
  ring: "ring-team/40",
  gradient: "from-team to-success",
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
 * Class for a subtree that belongs to one event family. It exposes `--family`,
 * `--family-foreground` and `--family-glow` (index.css) for family badges and
 * glows. It deliberately does not re-tint `--primary`: buttons, tabs and links
 * use the theme's single primary colour everywhere for consistency. Use
 * `tokens.*` above (text-individual / text-team …) to mark family identity.
 */
export const FAMILY_CLASS: Record<EventFamily, string> = {
  individual: "family-individual",
  team: "family-team",
};

/**
 * Single source of truth for semantic tournament states.
 * Colors signal meaning strictly:
 * - brand: --primary for actions / "do this"
 * - live: --live exclusively for in-progress action
 * - pending: --warning for awaiting reveal or needs-attention
 * - success: --success for completed results
 * - neutral: muted tokens for archived, casual, or default
 */
export const SEMANTIC = {
  brand: {
    text: "text-primary",
    bg: "bg-primary text-primary-foreground",
    border: "border-primary/30",
  },
  live: {
    text: "text-live",
    bg: "bg-live text-live-foreground",
    bgSoft: "bg-live/15 text-live",
    border: "border-live/30",
  },
  pending: {
    text: "text-warning",
    bg: "bg-warning text-warning-foreground",
    bgSoft: "bg-warning/15 text-warning",
    border: "border-warning/30",
  },
  success: {
    text: "text-success",
    bg: "bg-success text-success-foreground",
    bgSoft: "bg-success/15 text-success",
    border: "border-success/30",
  },
  neutral: {
    text: "text-muted-foreground",
    bg: "bg-muted-strong text-soft",
    bgSoft: "bg-muted text-muted-foreground",
    border: "border-border-strong/60",
  },
} as const;

/** Ranked-state tokens (colour-blind-safe: always paired with icon + label). */
export const RANKED_TOKENS = {
  ranked: {
    text: "text-gold",
    bgSoft: "bg-gold/10",
    border: "border-gold/40",
    label: "Ranked",
    sublabel: "Affects ELO",
  },
  unranked: {
    text: "text-muted-foreground",
    bgSoft: "bg-muted-foreground/10",
    border: "border-border-strong/50",
    label: "Casual",
    sublabel: "No ELO",
  },
} as const;
