export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_history: {
        Row: {
          action_type: string
          admin_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          label: string
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          label: string
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_email: string
          created_at: string
          details: Json | null
          id: number
        }
        Insert: {
          action: string
          admin_email: string
          created_at?: string
          details?: Json | null
          id?: number
        }
        Update: {
          action?: string
          admin_email?: string
          created_at?: string
          details?: Json | null
          id?: number
        }
        Relationships: []
      }
      buddy_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buddy_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buddy_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          challenged_id: string | null
          challenger_id: string | null
          created_at: string | null
          format: string
          id: string
          message: string | null
          scheduled_time: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          challenged_id?: string | null
          challenger_id?: string | null
          created_at?: string | null
          format: string
          id?: string
          message?: string | null
          scheduled_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          challenged_id?: string | null
          challenger_id?: string | null
          created_at?: string | null
          format?: string
          id?: string
          message?: string | null
          scheduled_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_challenged_id_fkey"
            columns: ["challenged_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_challenged_id_fkey"
            columns: ["challenged_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      club_courts: {
        Row: {
          court_number: number
          current_match_id: string | null
          id: string
          last_updated: string | null
          status: string
        }
        Insert: {
          court_number: number
          current_match_id?: string | null
          id?: string
          last_updated?: string | null
          status?: string
        }
        Update: {
          court_number?: number
          current_match_id?: string | null
          id?: string
          last_updated?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_courts_current_match_id_fkey"
            columns: ["current_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      court_visits: {
        Row: {
          day_of_week: number
          hour: number
          id: string
          user_id: string
          visited_at: string
        }
        Insert: {
          day_of_week: number
          hour: number
          id?: string
          user_id: string
          visited_at?: string
        }
        Update: {
          day_of_week?: number
          hour?: number
          id?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: []
      }
      doubles_teams: {
        Row: {
          category: string
          created_at: string | null
          elo_rating: number
          id: string
          matches_played: number
          matches_won: number
          player1_id: string
          player2_id: string
          team_name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          elo_rating?: number
          id?: string
          matches_played?: number
          matches_won?: number
          player1_id: string
          player2_id: string
          team_name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          elo_rating?: number
          id?: string
          matches_played?: number
          matches_won?: number
          player1_id?: string
          player2_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubles_teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doubles_teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      elo_calculation_logs: {
        Row: {
          actual_score: number | null
          category: string | null
          created_at: string | null
          elo_change: number | null
          expected_score: number | null
          id: string
          match_uuid: string | null
          new_elo: number | null
          player_id: string | null
          previous_elo: number | null
        }
        Insert: {
          actual_score?: number | null
          category?: string | null
          created_at?: string | null
          elo_change?: number | null
          expected_score?: number | null
          id?: string
          match_uuid?: string | null
          new_elo?: number | null
          player_id?: string | null
          previous_elo?: number | null
        }
        Update: {
          actual_score?: number | null
          category?: string | null
          created_at?: string | null
          elo_change?: number | null
          expected_score?: number | null
          id?: string
          match_uuid?: string | null
          new_elo?: number | null
          player_id?: string | null
          previous_elo?: number | null
        }
        Relationships: []
      }
      find_lost_posts: {
        Row: {
          author_id: string
          claim_contact: string | null
          claim_contact_info: string | null
          claim_message: string | null
          claim_msg: string | null
          claimed_at: string | null
          claimed_by_id: string | null
          claimed_by_name: string | null
          contact: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          image_urls: Json | null
          location: string | null
          remarks: string | null
          resolved: boolean | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          claim_contact?: string | null
          claim_contact_info?: string | null
          claim_message?: string | null
          claim_msg?: string | null
          claimed_at?: string | null
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          location?: string | null
          remarks?: string | null
          resolved?: boolean | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          claim_contact?: string | null
          claim_contact_info?: string | null
          claim_message?: string | null
          claim_msg?: string | null
          claimed_at?: string | null
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          location?: string | null
          remarks?: string | null
          resolved?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "find_lost_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "find_lost_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "find_lost_posts_claimed_by_id_fkey"
            columns: ["claimed_by_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "find_lost_posts_claimed_by_id_fkey"
            columns: ["claimed_by_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      live_match_votes: {
        Row: {
          created_at: string | null
          id: string
          live_match_id: string
          pick: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          live_match_id: string
          pick: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          live_match_id?: string
          pick?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_match_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_match_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          condition: string
          created_at: string
          description: string
          fulfilled_by_id: string | null
          fulfilled_by_name: string | null
          id: string
          image_url: string | null
          listing_type: string
          price: number
          seller_id: string
          status: string
          title: string
        }
        Insert: {
          category: string
          condition: string
          created_at?: string
          description: string
          fulfilled_by_id?: string | null
          fulfilled_by_name?: string | null
          id?: string
          image_url?: string | null
          listing_type?: string
          price: number
          seller_id: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          description?: string
          fulfilled_by_id?: string | null
          fulfilled_by_name?: string | null
          id?: string
          image_url?: string | null
          listing_type?: string
          price?: number
          seller_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_fulfilled_by_id_fkey"
            columns: ["fulfilled_by_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_fulfilled_by_id_fkey"
            columns: ["fulfilled_by_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_health_data: {
        Row: {
          calories_burned: number | null
          created_at: string | null
          hr_avg: number | null
          hr_max: number | null
          hr_min: number | null
          hr_recovery: number | null
          hr_resting: number | null
          hr_samples: Json | null
          hr_zone_1_pct: number | null
          hr_zone_2_pct: number | null
          hr_zone_3_pct: number | null
          hr_zone_4_pct: number | null
          hr_zone_5_pct: number | null
          hrv_avg: number | null
          id: string
          match_id: string
          match_source: string
          player_id: string | null
          spo2_avg: number | null
          spo2_min: number | null
          steps: number | null
        }
        Insert: {
          calories_burned?: number | null
          created_at?: string | null
          hr_avg?: number | null
          hr_max?: number | null
          hr_min?: number | null
          hr_recovery?: number | null
          hr_resting?: number | null
          hr_samples?: Json | null
          hr_zone_1_pct?: number | null
          hr_zone_2_pct?: number | null
          hr_zone_3_pct?: number | null
          hr_zone_4_pct?: number | null
          hr_zone_5_pct?: number | null
          hrv_avg?: number | null
          id?: string
          match_id: string
          match_source: string
          player_id?: string | null
          spo2_avg?: number | null
          spo2_min?: number | null
          steps?: number | null
        }
        Update: {
          calories_burned?: number | null
          created_at?: string | null
          hr_avg?: number | null
          hr_max?: number | null
          hr_min?: number | null
          hr_recovery?: number | null
          hr_resting?: number | null
          hr_samples?: Json | null
          hr_zone_1_pct?: number | null
          hr_zone_2_pct?: number | null
          hr_zone_3_pct?: number | null
          hr_zone_4_pct?: number | null
          hr_zone_5_pct?: number | null
          hrv_avg?: number | null
          id?: string
          match_id?: string
          match_source?: string
          player_id?: string | null
          spo2_avg?: number | null
          spo2_min?: number | null
          steps?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_health_data_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_health_data_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_motion_stats: {
        Row: {
          avg_magnitude: number | null
          created_at: string | null
          id: string
          idle_pct: number | null
          match_id: string
          match_source: string
          max_magnitude: number | null
          recorded_by: string | null
          running_pct: number | null
          sample_count: number
          smash_sprint_pct: number | null
          walking_pct: number | null
        }
        Insert: {
          avg_magnitude?: number | null
          created_at?: string | null
          id?: string
          idle_pct?: number | null
          match_id: string
          match_source: string
          max_magnitude?: number | null
          recorded_by?: string | null
          running_pct?: number | null
          sample_count?: number
          smash_sprint_pct?: number | null
          walking_pct?: number | null
        }
        Update: {
          avg_magnitude?: number | null
          created_at?: string | null
          id?: string
          idle_pct?: number | null
          match_id?: string
          match_source?: string
          max_magnitude?: number | null
          recorded_by?: string | null
          running_pct?: number | null
          sample_count?: number
          smash_sprint_pct?: number | null
          walking_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_motion_stats_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_motion_stats_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_player_paths: {
        Row: {
          avg_speed_mps: number | null
          calibration_id: string | null
          created_at: string | null
          distance_covered_m: number | null
          id: string
          match_id: string
          match_source: string
          peak_speed_mps: number | null
          player_label: string | null
          points: Json
          processed_by: string | null
          rally_number: number
          sample_count: number
          side: string
        }
        Insert: {
          avg_speed_mps?: number | null
          calibration_id?: string | null
          created_at?: string | null
          distance_covered_m?: number | null
          id?: string
          match_id: string
          match_source: string
          peak_speed_mps?: number | null
          player_label?: string | null
          points: Json
          processed_by?: string | null
          rally_number: number
          sample_count?: number
          side: string
        }
        Update: {
          avg_speed_mps?: number | null
          calibration_id?: string | null
          created_at?: string | null
          distance_covered_m?: number | null
          id?: string
          match_id?: string
          match_source?: string
          peak_speed_mps?: number | null
          player_label?: string | null
          points?: Json
          processed_by?: string | null
          rally_number?: number
          sample_count?: number
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_player_paths_calibration_id_fkey"
            columns: ["calibration_id"]
            isOneToOne: false
            referencedRelation: "match_video_calibration"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_paths_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_player_paths_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rally_stats: {
        Row: {
          avg_intensity: number | null
          created_at: string | null
          direction_changes: number | null
          duration_ms: number
          game_num: number | null
          id: string
          match_id: string
          match_source: string
          peak_intensity: number | null
          player_id: string | null
          rally_number: number
          recorded_by: string | null
          scoring_team: number | null
          shot_count: number
          smash_count: number
          started_at: string | null
          t1_score: number | null
          t2_score: number | null
        }
        Insert: {
          avg_intensity?: number | null
          created_at?: string | null
          direction_changes?: number | null
          duration_ms: number
          game_num?: number | null
          id?: string
          match_id: string
          match_source: string
          peak_intensity?: number | null
          player_id?: string | null
          rally_number: number
          recorded_by?: string | null
          scoring_team?: number | null
          shot_count?: number
          smash_count?: number
          started_at?: string | null
          t1_score?: number | null
          t2_score?: number | null
        }
        Update: {
          avg_intensity?: number | null
          created_at?: string | null
          direction_changes?: number | null
          duration_ms?: number
          game_num?: number | null
          id?: string
          match_id?: string
          match_source?: string
          peak_intensity?: number | null
          player_id?: string | null
          rally_number?: number
          recorded_by?: string | null
          scoring_team?: number | null
          shot_count?: number
          smash_count?: number
          started_at?: string | null
          t1_score?: number | null
          t2_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_rally_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rally_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rally_stats_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_rally_stats_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_sensor_analytics: {
        Row: {
          accel_avg: number | null
          accel_peak: number | null
          accel_std: number | null
          avg_shot_interval_ms: number | null
          avg_swing_speed: number | null
          clear_count: number | null
          created_at: string | null
          direction_changes: number | null
          drive_count: number | null
          fastest_shot_interval_ms: number | null
          fatigue_index: number | null
          first_half_intensity: number | null
          forward_back_pct: number | null
          gyro_avg: number | null
          gyro_peak: number | null
          gyro_std: number | null
          id: string
          lateral_pct: number | null
          match_id: string
          match_source: string
          max_swing_speed: number | null
          net_shot_count: number | null
          player_id: string | null
          second_half_intensity: number | null
          smash_count: number | null
          total_swings: number | null
          vertical_pct: number | null
        }
        Insert: {
          accel_avg?: number | null
          accel_peak?: number | null
          accel_std?: number | null
          avg_shot_interval_ms?: number | null
          avg_swing_speed?: number | null
          clear_count?: number | null
          created_at?: string | null
          direction_changes?: number | null
          drive_count?: number | null
          fastest_shot_interval_ms?: number | null
          fatigue_index?: number | null
          first_half_intensity?: number | null
          forward_back_pct?: number | null
          gyro_avg?: number | null
          gyro_peak?: number | null
          gyro_std?: number | null
          id?: string
          lateral_pct?: number | null
          match_id: string
          match_source: string
          max_swing_speed?: number | null
          net_shot_count?: number | null
          player_id?: string | null
          second_half_intensity?: number | null
          smash_count?: number | null
          total_swings?: number | null
          vertical_pct?: number | null
        }
        Update: {
          accel_avg?: number | null
          accel_peak?: number | null
          accel_std?: number | null
          avg_shot_interval_ms?: number | null
          avg_swing_speed?: number | null
          clear_count?: number | null
          created_at?: string | null
          direction_changes?: number | null
          drive_count?: number | null
          fastest_shot_interval_ms?: number | null
          fatigue_index?: number | null
          first_half_intensity?: number | null
          forward_back_pct?: number | null
          gyro_avg?: number | null
          gyro_peak?: number | null
          gyro_std?: number | null
          id?: string
          lateral_pct?: number | null
          match_id?: string
          match_source?: string
          max_swing_speed?: number | null
          net_shot_count?: number | null
          player_id?: string | null
          second_half_intensity?: number | null
          smash_count?: number | null
          total_swings?: number | null
          vertical_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_sensor_analytics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_sensor_analytics_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_stroke_analytics: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          match_id: string
          match_source: string
          peak_acceleration: number
          processed_by: string | null
          rally_number: number
          stroke_type: string
        }
        Insert: {
          confidence: number
          created_at?: string | null
          id?: string
          match_id: string
          match_source: string
          peak_acceleration: number
          processed_by?: string | null
          rally_number: number
          stroke_type: string
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          match_id?: string
          match_source?: string
          peak_acceleration?: number
          processed_by?: string | null
          rally_number?: number
          stroke_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_stroke_analytics_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_stroke_analytics_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      match_video_calibration: {
        Row: {
          court_length_m: number
          court_width_m: number
          created_at: string | null
          created_by: string | null
          dst_points: Json
          homography_matrix: Json
          id: string
          match_id: string
          match_source: string
          src_points: Json
          sync_anchor_rally_number: number
          sync_anchor_wallclock: string
          sync_video_time_ms: number
          video_frame_height: number
          video_frame_width: number
        }
        Insert: {
          court_length_m?: number
          court_width_m?: number
          created_at?: string | null
          created_by?: string | null
          dst_points: Json
          homography_matrix: Json
          id?: string
          match_id: string
          match_source: string
          src_points: Json
          sync_anchor_rally_number: number
          sync_anchor_wallclock: string
          sync_video_time_ms: number
          video_frame_height: number
          video_frame_width: number
        }
        Update: {
          court_length_m?: number
          court_width_m?: number
          created_at?: string | null
          created_by?: string | null
          dst_points?: Json
          homography_matrix?: Json
          id?: string
          match_id?: string
          match_source?: string
          src_points?: Json
          sync_anchor_rally_number?: number
          sync_anchor_wallclock?: string
          sync_video_time_ms?: number
          video_frame_height?: number
          video_frame_width?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_video_calibration_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_video_calibration_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          category: string
          confirmed_by: string[]
          created_at: string
          date: string
          elo_change_p1: number | null
          elo_change_p2: number | null
          elo_change_p3: number | null
          elo_change_p4: number | null
          ended_at: string | null
          id: string
          is_friendly: boolean | null
          kudos_count: number | null
          kudos_users: string[] | null
          player1_id: string | null
          player2_id: string | null
          round: string
          score: string
          sets_history: string[] | null
          started_at: string | null
          status: string | null
          submitted_by: string | null
          team1_partner_id: string | null
          team2_partner_id: string | null
          tournament_id: string | null
          winner_id: string | null
        }
        Insert: {
          category: string
          confirmed_by?: string[]
          created_at?: string
          date: string
          elo_change_p1?: number | null
          elo_change_p2?: number | null
          elo_change_p3?: number | null
          elo_change_p4?: number | null
          ended_at?: string | null
          id?: string
          is_friendly?: boolean | null
          kudos_count?: number | null
          kudos_users?: string[] | null
          player1_id?: string | null
          player2_id?: string | null
          round: string
          score: string
          sets_history?: string[] | null
          started_at?: string | null
          status?: string | null
          submitted_by?: string | null
          team1_partner_id?: string | null
          team2_partner_id?: string | null
          tournament_id?: string | null
          winner_id?: string | null
        }
        Update: {
          category?: string
          confirmed_by?: string[]
          created_at?: string
          date?: string
          elo_change_p1?: number | null
          elo_change_p2?: number | null
          elo_change_p3?: number | null
          elo_change_p4?: number | null
          ended_at?: string | null
          id?: string
          is_friendly?: boolean | null
          kudos_count?: number | null
          kudos_users?: string[] | null
          player1_id?: string | null
          player2_id?: string | null
          round?: string
          score?: string
          sets_history?: string[] | null
          started_at?: string | null
          status?: string | null
          submitted_by?: string | null
          team1_partner_id?: string | null
          team2_partner_id?: string | null
          tournament_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team1_partner_id_fkey"
            columns: ["team1_partner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team1_partner_id_fkey"
            columns: ["team1_partner_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_partner_id_fkey"
            columns: ["team2_partner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team2_partner_id_fkey"
            columns: ["team2_partner_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_endorsements: {
        Row: {
          category: string
          created_at: string
          endorsed_player_id: string
          endorser_id: string
          id: string
          trait: string
        }
        Insert: {
          category: string
          created_at?: string
          endorsed_player_id: string
          endorser_id: string
          id?: string
          trait: string
        }
        Update: {
          category?: string
          created_at?: string
          endorsed_player_id?: string
          endorser_id?: string
          id?: string
          trait?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_endorsements_endorsed_player_id_fkey"
            columns: ["endorsed_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_endorsements_endorsed_player_id_fkey"
            columns: ["endorsed_player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_sleep_data: {
        Row: {
          awake_minutes: number | null
          created_at: string | null
          deep_minutes: number | null
          id: string
          light_minutes: number | null
          player_id: string | null
          rem_minutes: number | null
          sleep_date: string
          total_minutes: number | null
        }
        Insert: {
          awake_minutes?: number | null
          created_at?: string | null
          deep_minutes?: number | null
          id?: string
          light_minutes?: number | null
          player_id?: string | null
          rem_minutes?: number | null
          sleep_date: string
          total_minutes?: number | null
        }
        Update: {
          awake_minutes?: number | null
          created_at?: string | null
          deep_minutes?: number | null
          id?: string
          light_minutes?: number | null
          player_id?: string | null
          rem_minutes?: number | null
          sleep_date?: string
          total_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_sleep_data_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_sleep_data_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          achievements: string[] | null
          apparel: string | null
          avatar_url: string | null
          bio: string | null
          buddies: string[] | null
          career_highlights: Json | null
          coach: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          current_racket: string | null
          current_ranking: number | null
          deleted_at: string | null
          department: string | null
          dominant_hand: string | null
          doubles_elo: number | null
          doubles_matches_played: number | null
          elo_rating: number | null
          email: string | null
          favorite_format: string | null
          favorite_idol: string | null
          favorite_shot: string | null
          followers: string[] | null
          following: string[] | null
          frequent_partners: Json | null
          full_name: string
          gender: string | null
          height: string | null
          highest_ranking: number | null
          home_state: string | null
          id: string
          iisc_email: string | null
          instagram: string | null
          is_approved: boolean | null
          is_guest: boolean
          is_looking_to_play: boolean | null
          is_retired: boolean | null
          joined_year: number | null
          mixed_elo: number | null
          mixed_matches_played: number | null
          nationality: string | null
          nickname: string | null
          playing_level: string | null
          playing_style: string | null
          pref_notify_buddy_status: boolean | null
          quote: string | null
          racket_details: Json | null
          recent_form: string[] | null
          recent_matches: Json | null
          role: string | null
          shoes: string | null
          singles_elo: number | null
          singles_matches_played: number | null
          sr_number: string | null
          started_playing_year: number | null
          stats: Json | null
          total_friendly_matches: number | null
          tournament_doubles_elo: number | null
          tournament_elo: number | null
          tournament_history: string[] | null
          tournament_mixed_elo: number | null
          tournament_singles_elo: number | null
          win_loss_record: string | null
        }
        Insert: {
          achievements?: string[] | null
          apparel?: string | null
          avatar_url?: string | null
          bio?: string | null
          buddies?: string[] | null
          career_highlights?: Json | null
          coach?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          current_racket?: string | null
          current_ranking?: number | null
          deleted_at?: string | null
          department?: string | null
          dominant_hand?: string | null
          doubles_elo?: number | null
          doubles_matches_played?: number | null
          elo_rating?: number | null
          email?: string | null
          favorite_format?: string | null
          favorite_idol?: string | null
          favorite_shot?: string | null
          followers?: string[] | null
          following?: string[] | null
          frequent_partners?: Json | null
          full_name: string
          gender?: string | null
          height?: string | null
          highest_ranking?: number | null
          home_state?: string | null
          id: string
          iisc_email?: string | null
          instagram?: string | null
          is_approved?: boolean | null
          is_guest?: boolean
          is_looking_to_play?: boolean | null
          is_retired?: boolean | null
          joined_year?: number | null
          mixed_elo?: number | null
          mixed_matches_played?: number | null
          nationality?: string | null
          nickname?: string | null
          playing_level?: string | null
          playing_style?: string | null
          pref_notify_buddy_status?: boolean | null
          quote?: string | null
          racket_details?: Json | null
          recent_form?: string[] | null
          recent_matches?: Json | null
          role?: string | null
          shoes?: string | null
          singles_elo?: number | null
          singles_matches_played?: number | null
          sr_number?: string | null
          started_playing_year?: number | null
          stats?: Json | null
          total_friendly_matches?: number | null
          tournament_doubles_elo?: number | null
          tournament_elo?: number | null
          tournament_history?: string[] | null
          tournament_mixed_elo?: number | null
          tournament_singles_elo?: number | null
          win_loss_record?: string | null
        }
        Update: {
          achievements?: string[] | null
          apparel?: string | null
          avatar_url?: string | null
          bio?: string | null
          buddies?: string[] | null
          career_highlights?: Json | null
          coach?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          current_racket?: string | null
          current_ranking?: number | null
          deleted_at?: string | null
          department?: string | null
          dominant_hand?: string | null
          doubles_elo?: number | null
          doubles_matches_played?: number | null
          elo_rating?: number | null
          email?: string | null
          favorite_format?: string | null
          favorite_idol?: string | null
          favorite_shot?: string | null
          followers?: string[] | null
          following?: string[] | null
          frequent_partners?: Json | null
          full_name?: string
          gender?: string | null
          height?: string | null
          highest_ranking?: number | null
          home_state?: string | null
          id?: string
          iisc_email?: string | null
          instagram?: string | null
          is_approved?: boolean | null
          is_guest?: boolean
          is_looking_to_play?: boolean | null
          is_retired?: boolean | null
          joined_year?: number | null
          mixed_elo?: number | null
          mixed_matches_played?: number | null
          nationality?: string | null
          nickname?: string | null
          playing_level?: string | null
          playing_style?: string | null
          pref_notify_buddy_status?: boolean | null
          quote?: string | null
          racket_details?: Json | null
          recent_form?: string[] | null
          recent_matches?: Json | null
          role?: string | null
          shoes?: string | null
          singles_elo?: number | null
          singles_matches_played?: number | null
          sr_number?: string | null
          started_playing_year?: number | null
          stats?: Json | null
          total_friendly_matches?: number | null
          tournament_doubles_elo?: number | null
          tournament_elo?: number | null
          tournament_history?: string[] | null
          tournament_mixed_elo?: number | null
          tournament_singles_elo?: number | null
          win_loss_record?: string | null
        }
        Relationships: []
      }
      recycle_bin: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          expires_at: string
          id: string
          label: string | null
          record_data: Json
          record_id: string
          table_name: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          record_data: Json
          record_id: string
          table_name: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          expires_at?: string
          id?: string
          label?: string | null
          record_data?: Json
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      sent_fan_notifications: {
        Row: {
          created_at: string | null
          match_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          match_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_fan_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      site_data: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          advances_to_match: string | null
          advances_to_match_loser: string | null
          advances_to_position: number | null
          advances_to_position_loser: number | null
          best_of_sets: number | null
          category: string
          court_number: string | null
          created_at: string | null
          ended_at: string | null
          golden_point: number | null
          id: string
          locked: boolean | null
          match_code: string
          match_number: number
          player1_id: string | null
          player2_id: string | null
          player3_id: string | null
          player4_id: string | null
          points_to_win: number | null
          reminder_sent: boolean | null
          round: number
          round_name: string
          scheduled_at: string | null
          score: string | null
          scored_at: string | null
          scored_by: string | null
          sets_history: string[] | null
          started_at: string | null
          status: string
          team1_label: string | null
          team2_label: string | null
          tournament_id: string
          umpired_by: string | null
          winner_id: string | null
          winner_side: number | null
        }
        Insert: {
          advances_to_match?: string | null
          advances_to_match_loser?: string | null
          advances_to_position?: number | null
          advances_to_position_loser?: number | null
          best_of_sets?: number | null
          category: string
          court_number?: string | null
          created_at?: string | null
          ended_at?: string | null
          golden_point?: number | null
          id?: string
          locked?: boolean | null
          match_code: string
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          player4_id?: string | null
          points_to_win?: number | null
          reminder_sent?: boolean | null
          round: number
          round_name: string
          scheduled_at?: string | null
          score?: string | null
          scored_at?: string | null
          scored_by?: string | null
          sets_history?: string[] | null
          started_at?: string | null
          status?: string
          team1_label?: string | null
          team2_label?: string | null
          tournament_id: string
          umpired_by?: string | null
          winner_id?: string | null
          winner_side?: number | null
        }
        Update: {
          advances_to_match?: string | null
          advances_to_match_loser?: string | null
          advances_to_position?: number | null
          advances_to_position_loser?: number | null
          best_of_sets?: number | null
          category?: string
          court_number?: string | null
          created_at?: string | null
          ended_at?: string | null
          golden_point?: number | null
          id?: string
          locked?: boolean | null
          match_code?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          player4_id?: string | null
          points_to_win?: number | null
          reminder_sent?: boolean | null
          round?: number
          round_name?: string
          scheduled_at?: string | null
          score?: string | null
          scored_at?: string | null
          scored_by?: string | null
          sets_history?: string[] | null
          started_at?: string | null
          status?: string
          team1_label?: string | null
          team2_label?: string | null
          tournament_id?: string
          umpired_by?: string | null
          winner_id?: string | null
          winner_side?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_umpired_by_fkey"
            columns: ["umpired_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_umpired_by_fkey"
            columns: ["umpired_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          category: string
          created_at: string | null
          display_name: string | null
          id: string
          partner_id: string | null
          player_id: string | null
          seed: number | null
          tournament_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          partner_id?: string | null
          player_id?: string | null
          seed?: number | null
          tournament_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          partner_id?: string | null
          player_id?: string | null
          seed?: number | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_round_rules: {
        Row: {
          best_of_sets: number
          category: string
          golden_point: number
          id: string
          points_to_win: number
          round: number
          round_name: string | null
          tournament_id: string
        }
        Insert: {
          best_of_sets?: number
          category: string
          golden_point?: number
          id?: string
          points_to_win?: number
          round: number
          round_name?: string | null
          tournament_id: string
        }
        Update: {
          best_of_sets?: number
          category?: string
          golden_point?: number
          id?: string
          points_to_win?: number
          round?: number
          round_name?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_round_rules_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          archived_at: string | null
          auto_reminders_enabled: boolean | null
          bracket_format: string
          categories: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: string | null
          end_date: string | null
          form_close_date: string | null
          form_status: string | null
          form_url: string | null
          id: string
          name: string
          require_app_registration: boolean
          start_date: string | null
          status: string
          tournament_type: string
          venue: string | null
          year: number
        }
        Insert: {
          archived_at?: string | null
          auto_reminders_enabled?: boolean | null
          bracket_format?: string
          categories?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string | null
          end_date?: string | null
          form_close_date?: string | null
          form_status?: string | null
          form_url?: string | null
          id?: string
          name: string
          require_app_registration?: boolean
          start_date?: string | null
          status?: string
          tournament_type?: string
          venue?: string | null
          year: number
        }
        Update: {
          archived_at?: string | null
          auto_reminders_enabled?: boolean | null
          bracket_format?: string
          categories?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string | null
          end_date?: string | null
          form_close_date?: string | null
          form_status?: string | null
          form_url?: string | null
          id?: string
          name?: string
          require_app_registration?: boolean
          start_date?: string | null
          status?: string
          tournament_type?: string
          venue?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      umpire_assignments: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_time: string | null
          id: string
          match_id: string | null
          start_time: string | null
          tournament_match_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          id?: string
          match_id?: string | null
          start_time?: string | null
          tournament_match_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_time?: string | null
          id?: string
          match_id?: string | null
          start_time?: string | null
          tournament_match_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "umpire_assignments_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          message: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          message: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_match_notifications: {
        Row: {
          created_at: string | null
          id: string
          match_id: string | null
          notify_before_mins: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          notify_before_mins?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          notify_before_mins?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_match_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_player_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          notify_before_mins: number | null
          player_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notify_before_mins?: number | null
          player_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notify_before_mins?: number | null
          player_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_player_subscriptions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_player_subscriptions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string | null
          token: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_presence_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          player_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          player_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_presence_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_presence_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      search_players_view: {
        Row: {
          avatar_url: string | null
          department: string | null
          full_name: string | null
          id: string | null
          overall_rank: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_buddy_request: {
        Args: { p_target_id: string }
        Returns: undefined
      }
      accept_friendly_match: {
        Args: { confirmer_id: string; match_uuid: string }
        Returns: Json
      }
      admin_approve_players:
        | { Args: { p_ids: string[] }; Returns: undefined }
        | {
            Args: { p_approved?: boolean; p_ids: string[] }
            Returns: undefined
          }
      admin_edit_tournament_match: {
        Args: {
          p_match_id: string
          p_score: string
          p_scored_by?: string
          p_sets: string[]
          p_winner_side: number
        }
        Returns: undefined
      }
      admin_move_player_in_bracket: {
        Args: {
          p_label: string
          p_match_id: string
          p_partner_id: string
          p_player_id: string
          p_slot: number
        }
        Returns: undefined
      }
      advance_tournament_winner: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      approve_player:
        | { Args: { admin_email: string; player_id: string }; Returns: boolean }
        | { Args: { admin_id: string; player_id: string }; Returns: undefined }
      archive_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      calculate_overall_elo: {
        Args: {
          p_doubles_elo: number
          p_doubles_matches: number
          p_mixed_elo: number
          p_mixed_matches: number
          p_singles_elo: number
          p_singles_matches: number
        }
        Returns: number
      }
      cancel_buddy_request: {
        Args: { p_target_id: string }
        Returns: undefined
      }
      check_email_exists: { Args: { lookup_email: string }; Returns: boolean }
      claim_find_lost_item:
        | {
            Args: {
              claim_contact_info: string
              claim_msg: string
              claimer_id: string
              claimer_name: string
              post_uuid: string
            }
            Returns: undefined
          }
        | {
            Args: {
              claimer_id: string
              claimer_name: string
              post_uuid: string
            }
            Returns: undefined
          }
        | {
            Args: {
              claim_msg?: string
              claimer_id: string
              claimer_name: string
              post_uuid: string
            }
            Returns: undefined
          }
        | {
            Args: {
              claim_contact_info?: string
              claim_msg?: string
              claimer_id: string
              claimer_name: string
              post_uuid: string
            }
            Returns: undefined
          }
      claim_guest_player: {
        Args: { p_guest_id: string; p_real_player_id: string }
        Returns: undefined
      }
      cleanup_stale_push_tokens: { Args: never; Returns: undefined }
      confirm_friendly_match: {
        Args: { confirmer_id: string; match_uuid: string }
        Returns: Json
      }
      create_guest_player: {
        Args: { p_full_name: string; p_gender?: string }
        Returns: {
          achievements: string[] | null
          apparel: string | null
          avatar_url: string | null
          bio: string | null
          buddies: string[] | null
          career_highlights: Json | null
          coach: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          current_racket: string | null
          current_ranking: number | null
          deleted_at: string | null
          department: string | null
          dominant_hand: string | null
          doubles_elo: number | null
          doubles_matches_played: number | null
          elo_rating: number | null
          email: string | null
          favorite_format: string | null
          favorite_idol: string | null
          favorite_shot: string | null
          followers: string[] | null
          following: string[] | null
          frequent_partners: Json | null
          full_name: string
          gender: string | null
          height: string | null
          highest_ranking: number | null
          home_state: string | null
          id: string
          iisc_email: string | null
          instagram: string | null
          is_approved: boolean | null
          is_guest: boolean
          is_looking_to_play: boolean | null
          is_retired: boolean | null
          joined_year: number | null
          mixed_elo: number | null
          mixed_matches_played: number | null
          nationality: string | null
          nickname: string | null
          playing_level: string | null
          playing_style: string | null
          pref_notify_buddy_status: boolean | null
          quote: string | null
          racket_details: Json | null
          recent_form: string[] | null
          recent_matches: Json | null
          role: string | null
          shoes: string | null
          singles_elo: number | null
          singles_matches_played: number | null
          sr_number: string | null
          started_playing_year: number | null
          stats: Json | null
          total_friendly_matches: number | null
          tournament_doubles_elo: number | null
          tournament_elo: number | null
          tournament_history: string[] | null
          tournament_mixed_elo: number | null
          tournament_singles_elo: number | null
          win_loss_record: string | null
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      debug_recalc: { Args: never; Returns: undefined }
      delete_guest_player: { Args: { p_guest_id: string }; Returns: undefined }
      delete_player_match_session: {
        Args: { p_match_id: string; p_match_source: string }
        Returns: undefined
      }
      fulfill_marketplace_request: {
        Args: { claimer_id: string; claimer_name: string; listing_uuid: string }
        Returns: undefined
      }
      get_court_popularity: {
        Args: never
        Returns: {
          day_of_week: number
          hour: number
          visit_count: number
        }[]
      }
      get_expected_score: {
        Args: { p_opponent_elo: number; p_team_elo: number }
        Returns: number
      }
      get_k_factor: {
        Args: { p_config: Json; p_matches: number }
        Returns: number
      }
      get_match_dominance: { Args: { p_sets: string[] }; Returns: number }
      get_set_multiplier: { Args: { p_sets: string[] }; Returns: number }
      get_venue_active_count: { Args: never; Returns: number }
      get_venue_hourly_pattern: {
        Args: { days_back?: number }
        Returns: {
          avg_checkins: number
          hour_of_day: number
        }[]
      }
      increment_match_score: {
        Args: { match_id: string; p1_increment: number; p2_increment: number }
        Returns: undefined
      }
      is_authorized_for_analytics: {
        Args: {
          p_auth_uid: string
          p_match_id: string
          p_match_source: string
          p_target_player: string
        }
        Returns: boolean
      }
      process_tournament_bracket_progression: {
        Args: { p_match_id: string; p_winner_id: string }
        Returns: undefined
      }
      push_match_alert: { Args: { p_message: string }; Returns: undefined }
      recalculate_all_elo: { Args: never; Returns: undefined }
      recalculate_category_records: {
        Args: { player_uuid: string }
        Returns: undefined
      }
      recalculate_player_all_records: {
        Args: { player_uuid: string }
        Returns: undefined
      }
      recalculate_tournament_elo: { Args: never; Returns: undefined }
      reject_friendly_match:
        | {
            Args: { match_uuid: string; rejecter_id: string }
            Returns: boolean
          }
        | {
            Args: { match_uuid: string; rejecter_id: string }
            Returns: boolean
          }
      remove_buddy: { Args: { p_target_id: string }; Returns: undefined }
      remove_live_match_by_id: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      send_buddy_request: { Args: { p_target_id: string }; Returns: undefined }
      send_ping_notification: {
        Args: { p_sender_name: string; p_target_id: string }
        Returns: undefined
      }
      set_player_role: {
        Args: { p_id: string; p_role: string }
        Returns: undefined
      }
      set_tournament_match_times: {
        Args: { p_ended_at: string; p_match_id: string; p_started_at: string }
        Returns: undefined
      }
      soft_delete_player:
        | { Args: { admin_email: string; player_id: string }; Returns: boolean }
        | { Args: { target_player_id: string }; Returns: undefined }
      submit_friendly_match:
        | {
            Args: {
              match_score: string
              match_winner_id: string
              opponent_id: string
              opponent_partner_id?: string
              submitter_id: string
              submitter_partner_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              is_cross_gender_singles?: boolean
              is_hybrid?: boolean
              is_mixed_category_doubles?: boolean
              match_score: string
              match_winner_id: string
              opponent_id: string
              opponent_partner_id?: string
              submitter_id: string
              submitter_partner_id?: string
            }
            Returns: string
          }
      submit_tournament_match: {
        Args: {
          p_match_id: string
          p_score: string
          p_sets: string[]
          p_umpire_id: string
          p_winner_side: number
        }
        Returns: undefined
      }
      toggle_buddy: { Args: { p_target_id: string }; Returns: undefined }
      toggle_follow: { Args: { p_target_id: string }; Returns: undefined }
      toggle_match_kudos: { Args: { p_match_id: string }; Returns: undefined }
      transfer_umpire_duty: {
        Args: { p_match_id: string; p_new_umpire_id: string }
        Returns: undefined
      }
      umpire_submit_match:
        | {
            Args: {
              ended_at?: string
              is_friendly: boolean
              match_category: string
              match_round: string
              match_score: string
              player1_id: string
              player2_id: string
              sets_history?: string[]
              started_at?: string
              team1_partner_id: string
              team2_partner_id: string
              umpire_id: string
              winner_id: string
            }
            Returns: string
          }
        | {
            Args: {
              is_friendly: boolean
              match_category: string
              match_round: string
              match_score: string
              player1_id: string
              player2_id: string
              team1_partner_id: string
              team2_partner_id: string
              umpire_id: string
              winner_id: string
            }
            Returns: string
          }
      umpire_update_match:
        | {
            Args: {
              match_category: string
              match_score: string
              match_uuid: string
              sets_history: string[]
              winner_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              match_category: string
              match_score: string
              match_uuid: string
              sets_history: string[]
              winner_id: string
            }
            Returns: undefined
          }
      unclaim_find_lost_item:
        | { Args: { post_uuid: string; user_id: string }; Returns: undefined }
        | { Args: { post_uuid: string; user_id: string }; Returns: undefined }
      upsert_live_match_by_id: {
        Args: { match_state: Json; p_match_id: string }
        Returns: undefined
      }
      upsert_player_endorsement: {
        Args: {
          p_category: string
          p_endorsed_player_id: string
          p_endorser_id: string
          p_trait: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
