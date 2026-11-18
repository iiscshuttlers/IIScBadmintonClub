export interface Tournament {
  id: string;
  name: string;
  tournament_type: string;
  bracket_format: string;
  format_family: 'OPEN_EVENT' | 'TEAM';
  categories: string[];
  status: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  description: string | null;
  eligibility: string | null;
  form_url: string | null;
  form_status: string;
  form_close_date: string | null;
  auto_reminders_enabled?: boolean;
  archived_at: string | null;
  created_at: string;
  created_by?: string | null;
  year?: number | null;
  show_participants?: boolean | null;
  show_brackets?: boolean | null;
  counts_for_elo?: boolean;
  ignore_gender_rules?: boolean;
  play_dead_rubbers?: boolean;
  tie_format_config?: any;
  max_rubbers_per_player?: number;
  team_roster_min?: number;
  require_app_registration?: boolean;
  tie_points_win?: number | null;
  tie_points_draw?: number | null;
  slug?: string | null;
  min_rest_minutes?: number | null;
  estimated_match_minutes?: number | null;
  unavailable_court_periods?: UnavailableCourtPeriod[] | any;
}

export interface UnavailableCourtPeriod {
  id?: string;
  court: string;
  start: string;
  end: string;
  reason?: string;
  [key: string]: any;
}

export type TournamentInsert = Partial<Omit<Tournament, 'id' | 'created_at'>> & {
  name: string;
};

export interface Participant {
  id: string;
  tournament_id?: string;
  category: string;
  player_id: string | null;
  partner_id: string | null;
  display_name: string | null;
  seed: number | null;
  /** Pinned first-match round. null = automatic bye allocation. */
  entry_round: number | null;
  email?: string | null;
  created_at?: string;
}

export type ParticipantInsert = Omit<Participant, 'id' | 'created_at'> & {
  id?: string;
  tournament_id: string;
};

export interface TournamentMatch {
  id: string;
  tournament_id?: string;
  category: string;
  match_code: string;
  round: number;
  round_name: string;
  match_number: number;
  player1_id: string | null;
  player3_id: string | null;
  team1_label: string | null;
  player2_id: string | null;
  player4_id: string | null;
  team2_label: string | null;
  court_number: string | null;
  scheduled_at: string | null;
  points_to_win: number | null;
  best_of_sets: number | null;
  golden_point: number | null;
  winner_side: 1 | 2 | null;
  winner_id: string | null;
  score: string | null;
  sets_history: string[] | null;
  status: string;
  locked: boolean;
  advances_to_match: string | null;
  advances_to_position: 1 | 2 | null;
  advances_to_match_loser: string | null;
  advances_to_position_loser: 1 | 2 | null;
  reminder_sent: boolean | null;
  result_revision?: number;
  result_operation_id?: string | null;
  scored_by?: string | null;
  umpired_by?: string | null;
  created_at?: string;
}

export type TournamentMatchInsert = Partial<TournamentMatch> & {
  tournament_id: string;
  category: string;
  round: number;
  match_number: number;
};

export interface RoundRule {
  id?: string;
  tournament_id?: string;
  category: string;
  round: number;
  round_name: string | null;
  points_to_win: number;
  best_of_sets: number;
  golden_point: number;
}

export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface Registration {
  id: string;
  tournament_id: string;
  status: RegistrationStatus;
  full_name: string;
  email: string | null;
  phone: string | null;
  categories: string[];
  partner_names: string | null;
  transaction_id: string | null;
  message: string | null;
  created_at: string;
  player?: { id: string; full_name: string; avatar_url: string | null } | null;
}
