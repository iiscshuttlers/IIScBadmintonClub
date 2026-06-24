import type { PlayerSlim } from './player';

export interface MatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  team1_partner_id: string | null;
  team2_partner_id: string | null;
  winner_id: string | null;
  match_score: string | null;
  sets_json: any;
  category: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'withdrawn';
  submitted_by: string | null;
  elo_change_p1: number | null;
  elo_change_p2: number | null;
  elo_change_p3: number | null;
  elo_change_p4: number | null;
  created_at: string;
  is_friendly: boolean;
  tournament_slug: string | null;
}

export interface MatchWithPlayers extends MatchRow {
  player1: PlayerSlim | null;
  player2: PlayerSlim | null;
  partner1: PlayerSlim | null;
  partner2: PlayerSlim | null;
}

// The monster select string — defined ONCE
export const MATCH_SELECT_WITH_PLAYERS =
  "*, player1:players!player1_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo), player2:players!player2_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo), partner1:players!team1_partner_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo), partner2:players!team2_partner_id(id, full_name, avatar_url, gender, elo_rating, singles_elo, doubles_elo, mixed_elo)";
