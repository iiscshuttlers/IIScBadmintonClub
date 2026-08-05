import { fetchSiteData } from "@/lib/siteData";
import { supabase } from "@/lib/supabase";

export async function getTournaments() {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*, tournament_matches(category, match_code, round_name, winner_side, team1_label, team2_label)")
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching tournaments:", error);
    return [];
  }
  
  // Transform snake_case columns to camelCase to match the expected LiveTournament type
  return data.map((t) => {
    let winners: any[] | undefined = undefined;

    // Only compute winners if the tournament is completed or archived
    if (t.status === "completed" || t.status === "archived") {
      const finals = (t.tournament_matches || []).filter((m: any) => 
        (m.round_name === "Final" || m.match_code?.includes("_F_")) && m.winner_side
      );
      
      if (finals.length > 0) {
        winners = finals.map((m: any) => ({
          category: m.category,
          winner: m.winner_side === 1 ? m.team1_label : m.team2_label
        }));
      }
    }

    return {
      id: t.id,
      slug: t.slug || t.id,
      name: t.name,
      subtitle: t.tournament_type,
      description: t.description,
      startDate: t.start_date,
      endDate: t.end_date,
      status: computeTournamentStatus(t),
      venue: t.venue,
      categories: t.categories,
      created_at: t.created_at,
      eligibility: t.eligibility,
      form_url: t.form_url,
      form_status: t.form_status,
      form_close_date: t.form_close_date,
      tournament_type: t.tournament_type,
      bracket_format: t.bracket_format,
      archived_at: t.archived_at,
      created_by: t.created_by,
      winners,
    };
  });
}

/** Registration form states an admin can pick. */
export type FormStatus = "open" | "closing_soon" | "closed" | "disabled";

/** Automatically compute the logical status of a tournament based on today's date */
export function computeTournamentStatus(t: { status: string, start_date?: string | null, end_date?: string | null }): string {
  if (t.status === "draft" || t.status === "archived") return t.status;
  
  if (t.start_date) {
    const now = new Date();
    // Use local timezone to get today's date string YYYY-MM-DD
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const start = t.start_date;
    const end = t.end_date || t.start_date;
    
    if (todayStr < start) return "upcoming";
    if (todayStr >= start && todayStr <= end) return "active";
    if (todayStr > end) return "completed";
  }
  
  return t.status;
}

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
