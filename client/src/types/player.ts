export interface PlayerRow {
  id: string;
  full_name: string;
  nickname: string | null;
  email: string | null;
  iisc_email: string | null;
  contact_number: string | null;
  department: string;
  joined_year: number | null;
  playing_level: string;
  playing_style: string;
  dominant_hand: string | null;
  favorite_shot: string | null;
  favorite_idol: string | null;
  favorite_format: string | null;
  push_token?: string | null;
  pref_notify_smash?: boolean;
  pref_notify_point?: boolean;
  pref_notify_serve?: boolean;
  pref_notify_whistle?: boolean;
  pref_notify_victory?: boolean;
  pref_notify_buddy_status?: boolean;
  quote: string | null;
  avatar_url: string;
  current_racket: string;
  racket_details: RacketDetail[] | null;
  shoes: string | null;  // JSON string
  stats: PlayerStats | null;
  nationality: string | null;
  home_state: string | null;
  height: string | null;
  years_playing: number | null;
  coach: string | null;
  bio: string | null;
  apparel: string | null;
  instagram: string | null;
  achievements: string[] | null;
  tournament_history: string[] | null;
  career_highlights: CareerHighlight[] | null;
  elo_rating: number;
  singles_elo: number | null;
  doubles_elo: number | null;
  mixed_elo: number | null;
  tournament_elo: number | null;
  tournament_singles_elo: number | null;
  tournament_doubles_elo: number | null;
  tournament_mixed_elo: number | null;
  win_loss_record: string | null;
  recent_form: string | null;
  is_looking_to_play: boolean | null;
  is_retired: boolean | null;
  role: 'master_admin' | 'admin' | 'umpire' | 'player';
  gender: string | null;
  buddies: string[] | null;
  following: string[] | null;
  followers: string[] | null;
  is_guest: boolean | null;
  deleted_at: string | null;
  created_at?: string;
}

export interface RacketDetail {
  name: string;
  string: string;
  tension: string;
  primary?: boolean;
}

export interface ShoeItem {
  name: string;
  primary?: boolean;
}

export interface PlayerStats {
  wins?: number;
  losses?: number;
  winPercentage?: number;
  totalMatches?: number;
  currentStreak?: string;
  longestWinStreak?: number;
  titlesWon?: number;
  runnerUp?: number;
  semifinals?: number;
  categoryStats?: {
    singles?: { wins: number; losses: number };
    doubles?: { wins: number; losses: number };
    mixed?: { wins: number; losses: number };
  };
  media?: MediaItem[];
}

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  caption?: string;
}

export interface CareerHighlight {
  year: number | string;
  title: string;
  description?: string;
}

// === Slim version for lists/search (only what's needed for cards) ===
export interface PlayerSlim {
  id: string;
  full_name: string;
  avatar_url: string;
  gender?: string | null;
  is_guest?: boolean | null;
}

// === For leaderboard views ===
export interface PlayerRanked extends PlayerRow {
  // Any computed fields for ranking
}

export interface Partner {
  name: string;
  id?: string;
  matchesTogether?: number;
  winRate?: number;
}

export interface PlayerProfileType {
  id: string;
  fullName: string;
  nickname?: string;
  avatar: string;
  department: string;
  joinedYear: number;
  playingLevel: string;
  dominantHand: string;
  playingStyle: string;
  gender?: string;
  favoriteShot: string;
  favoriteIdol: string;
  favoriteFormat: string;
  quote?: string;
  currentRacket: string;
  racketDetails: { name: string; string: string; tension: string }[];
  tournamentHistory: string[];
  achievements: string[];
  winLossRecord: string;

  is_retired?: boolean;

  // New optional fields
  nationality?: string;
  homeState?: string;
  height?: string;
  yearsPlaying?: number;
  coach?: string;
  bio?: string;
  currentRanking?: number;
  highestRanking?: number;
  stats?: PlayerStats;
  recentForm?: ("W" | "L")[];
  recentMatches?: any[];
  frequentPartners?: Partner[];
  careerHighlights?: CareerHighlight[];
  shoes?: string;
  shoesList?: { name: string; primary: boolean }[];
  apparel?: string;
  social?: { instagram?: string; email?: string };
  userId?: string;
  following?: string[];
  followers?: string[];
  elo_rating?: number;
  singles_elo?: number;
  doubles_elo?: number;
  mixed_elo?: number;
  isApproved?: boolean;
  role?: 'master_admin' | 'admin' | 'umpire' | 'player';
  buddies?: string[];
  buddyRequests?: string[];
  singles_record?: string;
  doubles_record?: string;
  mixed_record?: string;
}
