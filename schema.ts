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
            foreignKeyName: "buddy_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_progress: {
        Row: {
          challenge_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          player_id: string
          progress: number
        }
        Insert: {
          challenge_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          player_id: string
          progress?: number
        }
        Update: {
          challenge_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          player_id?: string
          progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_progress_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
            foreignKeyName: "challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "players"
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
          claimed_by_id: string | null
          claimed_by_name: string | null
          contact: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          resolved: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          author_id: string
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          resolved?: boolean
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          claimed_by_id?: string | null
          claimed_by_name?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          resolved?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "find_lost_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      live_matches: {
        Row: {
          id: string
          player1_id: string
          player2_id: string
          score_p1: number
          score_p2: number
          scorer_id: string
          set_number: number
          sets_p1: number
          sets_p2: number
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          id?: string
          player1_id: string
          player2_id: string
          score_p1?: number
          score_p2?: number
          scorer_id: string
          set_number?: number
          sets_p1?: number
          sets_p2?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player1_id?: string
          player2_id?: string
          score_p1?: number
          score_p2?: number
          scorer_id?: string
          set_number?: number
          sets_p1?: number
          sets_p2?: number
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_matches_scorer_id_fkey"
            columns: ["scorer_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          correct: boolean | null
          created_at: string
          id: string
          match_id: string
          player_id: string
          points_earned: number
          points_wagered: number
          predicted_winner_id: string
        }
        Insert: {
          correct?: boolean | null
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          points_earned?: number
          points_wagered?: number
          predicted_winner_id: string
        }
        Update: {
          correct?: boolean | null
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          points_earned?: number
          points_wagered?: number
          predicted_winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_predictions_predicted_winner_id_fkey"
            columns: ["predicted_winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          category: string
          created_at: string
          date: string
          elo_change_p1: number | null
          elo_change_p2: number | null
          elo_change_p3: number | null
          elo_change_p4: number | null
          id: string
          is_friendly: boolean | null
          kudos_count: number | null
          kudos_users: string[] | null
          nudge_sent_at: string | null
          player1_id: string | null
          player2_id: string | null
          round: string
          score: string
          status: string | null
          submitted_by: string | null
          team1_partner_id: string | null
          team2_partner_id: string | null
          tournament_id: string | null
          winner_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          date: string
          elo_change_p1?: number | null
          elo_change_p2?: number | null
          elo_change_p3?: number | null
          elo_change_p4?: number | null
          id?: string
          is_friendly?: boolean | null
          kudos_count?: number | null
          kudos_users?: string[] | null
          nudge_sent_at?: string | null
          player1_id?: string | null
          player2_id?: string | null
          round: string
          score: string
          status?: string | null
          submitted_by?: string | null
          team1_partner_id?: string | null
          team2_partner_id?: string | null
          tournament_id?: string | null
          winner_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          elo_change_p1?: number | null
          elo_change_p2?: number | null
          elo_change_p3?: number | null
          elo_change_p4?: number | null
          id?: string
          is_friendly?: boolean | null
          kudos_count?: number | null
          kudos_users?: string[] | null
          nudge_sent_at?: string | null
          player1_id?: string | null
          player2_id?: string | null
          round?: string
          score?: string
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
            foreignKeyName: "matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
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
            foreignKeyName: "matches_team1_partner_id_fkey"
            columns: ["team1_partner_id"]
            isOneToOne: false
            referencedRelation: "players"
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
        ]
      }
      notification_queue: {
        Row: {
          body: string
          created_at: string
          id: string
          player_id: string
          sent: boolean
          sent_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          player_id: string
          sent?: boolean
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          player_id?: string
          sent?: boolean
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
        ]
      }
      players: {
        Row: {
          achievements: string[] | null
          apparel: string | null
          avatar_url: string | null
          bio: string | null
          buddies: string[] | null
          buddy_requests: string[] | null
          career_highlights: Json | null
          coach: string | null
          contact_number: string | null
          created_at: string
          current_racket: string | null
          current_ranking: number | null
          deleted_at: string | null
          department: string | null
          dominant_hand: string | null
          doubles_elo: number | null
          doubles_record: string | null
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
          is_looking_to_play: boolean | null
          joined_year: number | null
          mixed_elo: number | null
          mixed_record: string | null
          nationality: string | null
          nickname: string | null
          playing_level: string | null
          playing_style: string | null
          quote: string | null
          racket_details: Json | null
          recent_form: string[] | null
          recent_matches: Json | null
          shoes: string | null
          singles_elo: number | null
          singles_record: string | null
          sr_number: string | null
          stats: Json | null
          status: string | null
          total_friendly_matches: number | null
          tournament_history: string[] | null
          user_id: string | null
          win_loss_record: string | null
          years_playing: number | null
        }
        Insert: {
          achievements?: string[] | null
          apparel?: string | null
          avatar_url?: string | null
          bio?: string | null
          buddies?: string[] | null
          buddy_requests?: string[] | null
          career_highlights?: Json | null
          coach?: string | null
          contact_number?: string | null
          created_at?: string
          current_racket?: string | null
          current_ranking?: number | null
          deleted_at?: string | null
          department?: string | null
          dominant_hand?: string | null
          doubles_elo?: number | null
          doubles_record?: string | null
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
          is_looking_to_play?: boolean | null
          joined_year?: number | null
          mixed_elo?: number | null
          mixed_record?: string | null
          nationality?: string | null
          nickname?: string | null
          playing_level?: string | null
          playing_style?: string | null
          quote?: string | null
          racket_details?: Json | null
          recent_form?: string[] | null
          recent_matches?: Json | null
          shoes?: string | null
          singles_elo?: number | null
          singles_record?: string | null
          sr_number?: string | null
          stats?: Json | null
          status?: string | null
          total_friendly_matches?: number | null
          tournament_history?: string[] | null
          user_id?: string | null
          win_loss_record?: string | null
          years_playing?: number | null
        }
        Update: {
          achievements?: string[] | null
          apparel?: string | null
          avatar_url?: string | null
          bio?: string | null
          buddies?: string[] | null
          buddy_requests?: string[] | null
          career_highlights?: Json | null
          coach?: string | null
          contact_number?: string | null
          created_at?: string
          current_racket?: string | null
          current_ranking?: number | null
          deleted_at?: string | null
          department?: string | null
          dominant_hand?: string | null
          doubles_elo?: number | null
          doubles_record?: string | null
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
          is_looking_to_play?: boolean | null
          joined_year?: number | null
          mixed_elo?: number | null
          mixed_record?: string | null
          nationality?: string | null
          nickname?: string | null
          playing_level?: string | null
          playing_style?: string | null
          quote?: string | null
          racket_details?: Json | null
          recent_form?: string[] | null
          recent_matches?: Json | null
          shoes?: string | null
          singles_elo?: number | null
          singles_record?: string | null
          sr_number?: string | null
          stats?: Json | null
          status?: string | null
          total_friendly_matches?: number | null
          tournament_history?: string[] | null
          user_id?: string | null
          win_loss_record?: string | null
          years_playing?: number | null
        }
        Relationships: []
      }
      prediction_points: {
        Row: {
          correct: number
          id: string
          player_id: string
          predictions: number
          total_points: number
          updated_at: string
        }
        Insert: {
          correct?: number
          id?: string
          player_id: string
          predictions?: number
          total_points?: number
          updated_at?: string
        }
        Update: {
          correct?: number
          id?: string
          player_id?: string
          predictions?: number
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_points_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          platform: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          platform?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          platform?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
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
      tournament_registrations: {
        Row: {
          categories: string[]
          created_at: string | null
          email: string
          full_name: string
          id: string
          partner_names: Json | null
          player_id: string | null
          receipt_path: string
          status: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          categories: string[]
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          partner_names?: Json | null
          player_id?: string | null
          receipt_path: string
          status?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          categories?: string[]
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          partner_names?: Json | null
          player_id?: string | null
          receipt_path?: string
          status?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          year: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          year?: number
        }
        Relationships: []
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
        ]
      }
      weekly_challenges: {
        Row: {
          created_at: string
          description: string
          id: string
          points: number
          target: number
          title: string
          type: string
          week_start: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          points?: number
          target: number
          title: string
          type: string
          week_start: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          points?: number
          target?: number
          title?: string
          type?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_buddy_request: {
        Args: { accepter_player_id: string; sender_player_id: string }
        Returns: undefined
      }
      approve_player: {
        Args: { admin_email: string; player_id: string }
        Returns: boolean
      }
      check_email_exists: { Args: { lookup_email: string }; Returns: boolean }
      claim_find_lost_item: {
        Args: { claimer_id: string; claimer_name: string; post_uuid: string }
        Returns: undefined
      }
      confirm_friendly_match: {
        Args: { confirmer_id: string; match_uuid: string }
        Returns: Json
      }
      recalculate_all_elo: { Args: never; Returns: undefined }
      reject_friendly_match: {
        Args: { match_uuid: string; rejecter_id: string }
        Returns: boolean
      }
      restrict_to_iisc_domain: { Args: { event: Json }; Returns: Json }
      soft_delete_player: {
        Args: { admin_email: string; player_id: string }
        Returns: boolean
      }
      submit_friendly_match:
        | {
            Args: {
              match_score: string
              match_winner_id: string
              opponent_id: string
              submitter_id: string
            }
            Returns: string
          }
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
      toggle_buddy: { Args: { p_target_id: string }; Returns: undefined }
      toggle_buddy_request: {
        Args: {
          is_sending: boolean
          sender_player_id: string
          target_player_id: string
        }
        Returns: undefined
      }
      toggle_follow: { Args: { p_target_id: string }; Returns: undefined }
      toggle_match_kudos: { Args: { p_match_id: string }; Returns: undefined }
      umpire_submit_match: {
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
      umpire_update_match: {
        Args: {
          match_category: string
          match_score: string
          match_uuid: string
          sets_history: string[]
          winner_id: string
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
