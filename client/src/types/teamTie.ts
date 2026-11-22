/**
 * Row shapes for the team-event (tie) screens: tournament_ties, their rubbers
 * (tournament_matches rows with a tie_id), the secret lineups and the lineup
 * audit trail — each with the embeds the tie queries select.
 */
import type { Tables } from '@/lib/supabase-types-auto';
import type { TieLineupRulesConfig, TieRubberConfig } from '@/lib/teamLineupRules';

/** A `players` embed narrowed to a few columns, e.g. `players!fk(id, full_name)`. */
export interface PlayerNameEmbed {
  id?: string;
  full_name: string;
  avatar_url?: string | null;
}

/**
 * A `players` embed selected with PLAYER_PUBLIC_COLUMNS (never the private
 * contact columns). id, full_name and gender are always among them.
 */
export type RosterPlayerEmbed = Pick<Tables<'players'>, 'id' | 'full_name' | 'gender'> & Partial<Tables<'players'>>;

/** Team columns embedded on a tie as team_a / team_b; which columns depends on the query. */
export interface TieTeamEmbed {
  id?: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  captain_id?: string | null;
}

/** A tournament_ties row with both teams embedded. */
export type TieWithTeams = Tables<'tournament_ties'> & {
  team_a?: TieTeamEmbed | null;
  team_b?: TieTeamEmbed | null;
};

/** The rubber columns embedded on a tie as `matches:tournament_matches(...)`. */
export type TieMatchSummary = Pick<
  Tables<'tournament_matches'>,
  'id' | 'status' | 'court_number' | 'rubber_order' | 'match_code'
>;

/** A tie as teamService.getTournamentTies selects it: teams plus a summary of its rubbers. */
export type TieWithTeamsAndMatches = TieWithTeams & {
  matches?: TieMatchSummary[] | null;
};

/** One rubber (a tournament_matches row of a tie) with its player embeds. */
export type TieRubberRow = Tables<'tournament_matches'> & {
  player1?: PlayerNameEmbed | null;
  player2?: PlayerNameEmbed | null;
  player3?: PlayerNameEmbed | null;
  player4?: PlayerNameEmbed | null;
  revealer?: PlayerNameEmbed | null;
};

/** A tie_lineups row with the lineup players and the official who revealed it. */
export type TieLineupWithPlayers = Tables<'tie_lineups'> & {
  player1?: PlayerNameEmbed | null;
  player2?: PlayerNameEmbed | null;
  revealer?: PlayerNameEmbed | null;
};

/** A tie_lineup_audits row with the official's and both players' names. */
export type TieLineupAuditWithNames = Tables<'tie_lineup_audits'> & {
  referee?: { full_name: string } | null;
  orig_player?: { full_name: string } | null;
  repl_player?: { full_name: string } | null;
};

/** A tournament_team_members row with its player embedded as `players(...)`. */
export type TeamMemberWithPlayer = Tables<'tournament_team_members'> & {
  players?: RosterPlayerEmbed | null;
};

/** One rubber of a tie format (tournaments.tie_format_config). */
export interface TieFormatRubber extends TieRubberConfig {
  best_of_sets?: number | null;
  points_to_win?: number | null;
}

/** The extra decider rubber a tie format may add after the regular rubbers. */
export interface TieExtraDeciderRubber {
  enabled: boolean;
  category?: string;
  label?: string;
  best_of_sets?: number;
  points_to_win?: number;
}

/**
 * tie_format_config stored as an object: the rubbers, the repeat rules and the
 * decider / points settings the bracket generator and settings editor write.
 */
export interface TieFormatConfigObject extends TieLineupRulesConfig {
  rubbers?: TieFormatRubber[];
  extra_decider_rubber?: TieExtraDeciderRubber;
  tie_points_win?: number;
  tie_points_draw?: number;
  [key: string]: unknown;
}

/** tournaments.tie_format_config: an older bare list of rubbers, or the config object. */
export type TieFormatConfig = TieFormatRubber[] | TieFormatConfigObject;

/** jsonb returned by the add_decider_rubber_to_tie RPC. */
export type AddDeciderRubberResult = {
  success: boolean;
  match_id: string;
  rubber_order: number;
  label: string;
  category: string;
};
