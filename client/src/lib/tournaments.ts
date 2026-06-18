import { fetchSiteData } from "@/lib/siteData";

export async function getTournaments() {
  return [];
}

/** Registration form states an admin can pick. */
export type FormStatus = "open" | "closing_soon" | "closed" | "disabled";

/**
 * Generic, admin-editable config for the single "featured / upcoming tournament"
 * shown on the Events page. Stored in `site_data` under key `tournament_config`,
 * with a static fallback at `public/data/tournament.json`.
 */
export interface TournamentConfig {
  /** Whether the tournament tab/section is shown at all. */
  enabled: boolean;
  /** Short display name, e.g. "INVICTA 2026" or "Upcoming Tournament". */
  name: string;
  /** Tournament start date (YYYY-MM-DD) or "". */
  startDate: string;
  /** Tournament end / finals date (YYYY-MM-DD) or "". */
  endDate: string;
  /** Free-text label shown when no date range is set, e.g. "Not yet announced" / "Postponed". */
  datesLabel: string;
  venue: string;
  /** Free text, e.g. "MS · WS · MD · WD · XD" or "Team Event". */
  categories: string;
  eligibility: string;
  description: string;
  /** Microsoft Form (or any) registration link. */
  formUrl: string;
  formStatus: FormStatus;
  /** Date the registration form closes (YYYY-MM-DD) or "" — surfaced on the calendar. */
  formCloseDate: string;
}

export const DEFAULT_TOURNAMENT_CONFIG: TournamentConfig = {
  enabled: true,
  name: "Upcoming Tournament",
  startDate: "",
  endDate: "",
  datesLabel: "Not yet announced",
  venue: "Gymkhana Courts",
  categories: "Not yet announced",
  eligibility: "All IISc Members",
  description:
    "Details for the next tournament will be announced here soon. Stay tuned!",
  formUrl: "",
  formStatus: "disabled",
  formCloseDate: "",
};

/** Fetch the tournament config, merged over defaults so missing keys are safe. */
export async function fetchTournamentConfig(): Promise<TournamentConfig> {
  try {
    const data = await fetchSiteData<Partial<TournamentConfig>>(
      "tournament_config",
      "tournament.json",
    );
    return { ...DEFAULT_TOURNAMENT_CONFIG, ...(data || {}) };
  } catch {
    return DEFAULT_TOURNAMENT_CONFIG;
  }
}

/** Human-readable date(s) for the info card. */
export function tournamentDatesDisplay(c: TournamentConfig): string {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  if (c.startDate && c.endDate) {
    if (c.startDate === c.endDate) return fmt(c.startDate);
    return `${fmt(c.startDate)} – ${fmt(c.endDate)}`;
  }
  if (c.startDate) return fmt(c.startDate);
  return c.datesLabel || "Not yet announced";
}
