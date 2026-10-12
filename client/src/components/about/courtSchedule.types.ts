// Shared types for the Court Schedule / booking UI.

export type Holiday = {
  date: string;
  name: string;
};

export interface CourtReservation {
  id: string;
  tournament_name: string;
  department?: string;
  date: string; // YYYY-MM-DD
  courts: string[]; // ["1", "2", "3"]
  start_time: string; // "09:00"
  end_time: string; // "13:00"
  created_at?: string;
}

export interface ScheduledMatch {
  id: string;
  tournament_id: string;
  match_code: string;
  category: string;
  court_number: string | null;
  scheduled_at: string | null;
  status: string;
  team1_label: string | null;
  team2_label: string | null;
  tournament_name?: string;
}

export interface BookingDisplayItem {
  id: string;
  title: string;
  subtitle?: string;
  department?: string;
  courts?: string[];
  date?: string;
  startTimeStr: string;
  endTimeStr: string;
  leftPercent: number;
  widthPercent: number;
  isManual?: boolean;
}
