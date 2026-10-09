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
      match_reminders: {
        Row: {
          created_at: string | null
          id: string
          match_id: string
          remind_before_mins: number
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id: string
          remind_before_mins: number
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string
          remind_before_mins?: number
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_reminders_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
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
          video_url: string | null
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
          video_url?: string | null
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
          video_url?: string | null
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
      notification_queue: {
        Row: {
          body: string
          created_at: string | null
          id: string
          player_id: string | null
          sent: boolean | null
          sent_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          player_id?: string | null
          sent?: boolean | null
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          player_id?: string | null
          sent?: boolean | null
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
          {
            foreignKeyName: "notification_queue_player_id_fkey"
            columns: ["player_id"]
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
          default_match_reminder_mins: number | null
          deleted_at: string | null
          department: string | null
          dominant_hand: string | null
          doubles_elo: number | null
          doubles_matches_played: number | null
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
          is_guest: boolean
          is_looking_to_play: boolean | null
          is_retired: boolean | null
          joined_year: number | null
          mixed_elo: number | null
          mixed_matches_played: number | null
          mixed_record: string | null
          nationality: string | null
          nickname: string | null
          playing_level: string | null
          playing_style: string | null
          pref_notify_buddy_status: boolean | null
          pref_notify_point: boolean
          pref_notify_serve: boolean
          pref_notify_smash: boolean
          pref_notify_victory: boolean
          pref_notify_whistle: boolean
          pref_receive_email: boolean
          pref_receive_push: boolean
          quote: string | null
          racket_details: Json | null
          recent_form: string[] | null
          recent_matches: Json | null
          role: string | null
          shoes: string | null
          singles_elo: number | null
          singles_matches_played: number | null
          singles_record: string | null
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
          default_match_reminder_mins?: number | null
          deleted_at?: string | null
          department?: string | null
          dominant_hand?: string | null
          doubles_elo?: number | null
          doubles_matches_played?: number | null
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
          is_guest?: boolean
          is_looking_to_play?: boolean | null
          is_retired?: boolean | null
          joined_year?: number | null
          mixed_elo?: number | null
          mixed_matches_played?: number | null
          mixed_record?: string | null
          nationality?: string | null
          nickname?: string | null
          playing_level?: string | null
          playing_style?: string | null
          pref_notify_buddy_status?: boolean | null
          pref_notify_point?: boolean
          pref_notify_serve?: boolean
          pref_notify_smash?: boolean
          pref_notify_victory?: boolean
          pref_notify_whistle?: boolean
          pref_receive_email?: boolean
          pref_receive_push?: boolean
          quote?: string | null
          racket_details?: Json | null
          recent_form?: string[] | null
          recent_matches?: Json | null
          role?: string | null
          shoes?: string | null
          singles_elo?: number | null
          singles_matches_played?: number | null
          singles_record?: string | null
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
          default_match_reminder_mins?: number | null
          deleted_at?: string | null
          department?: string | null
          dominant_hand?: string | null
          doubles_elo?: number | null
          doubles_matches_played?: number | null
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
          is_guest?: boolean
          is_looking_to_play?: boolean | null
          is_retired?: boolean | null
          joined_year?: number | null
          mixed_elo?: number | null
          mixed_matches_played?: number | null
          mixed_record?: string | null
          nationality?: string | null
          nickname?: string | null
          playing_level?: string | null
          playing_style?: string | null
          pref_notify_buddy_status?: boolean | null
          pref_notify_point?: boolean
          pref_notify_serve?: boolean
          pref_notify_smash?: boolean
          pref_notify_victory?: boolean
          pref_notify_whistle?: boolean
          pref_receive_email?: boolean
          pref_receive_push?: boolean
          quote?: string | null
          racket_details?: Json | null
          recent_form?: string[] | null
          recent_matches?: Json | null
          role?: string | null
          shoes?: string | null
          singles_elo?: number | null
          singles_matches_played?: number | null
          singles_record?: string | null
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
      tie_lineups: {
        Row: {
          id: string
          player1_id: string
          player2_id: string | null
          rubber_order: number
          side: string
          submitted_by: string
          tie_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          player1_id: string
          player2_id?: string | null
          rubber_order: number
          side: string
          submitted_by: string
          tie_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          player1_id?: string
          player2_id?: string | null
          rubber_order?: number
          side?: string
          submitted_by?: string
          tie_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tie_lineups_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_tie_id_fkey"
            columns: ["tie_id"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
            referencedColumns: ["id"]
          },
        ]
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
          rubber_label: string | null
          rubber_order: number | null
          scheduled_at: string | null
          score: string | null
          scored_at: string | null
          scored_by: string | null
          sets_history: string[] | null
          started_at: string | null
          status: string
          team1_label: string | null
          team2_label: string | null
          tie_id: string | null
          tournament_id: string
          umpired_by: string | null
          video_url: string | null
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
          rubber_label?: string | null
          rubber_order?: number | null
          scheduled_at?: string | null
          score?: string | null
          scored_at?: string | null
          scored_by?: string | null
          sets_history?: string[] | null
          started_at?: string | null
          status?: string
          team1_label?: string | null
          team2_label?: string | null
          tie_id?: string | null
          tournament_id: string
          umpired_by?: string | null
          video_url?: string | null
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
          rubber_label?: string | null
          rubber_order?: number | null
          scheduled_at?: string | null
          score?: string | null
          scored_at?: string | null
          scored_by?: string | null
          sets_history?: string[] | null
          started_at?: string | null
          status?: string
          team1_label?: string | null
          team2_label?: string | null
          tie_id?: string | null
          tournament_id?: string
          umpired_by?: string | null
          video_url?: string | null
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
            foreignKeyName: "tournament_matches_tie_id_fkey"
            columns: ["tie_id"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
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
          entry_round: number | null
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
          entry_round?: number | null
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
          entry_round?: number | null
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
      tournament_team_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          player_id: string
          responded_at: string | null
          role: string
          status: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          player_id: string
          responded_at?: string | null
          role?: string
          status?: string
          team_id: string
          tournament_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          player_id?: string
          responded_at?: string | null
          role?: string
          status?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_team_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tournament_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_team_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_teams: {
        Row: {
          captain_id: string
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          pool: string | null
          seed: number | null
          short_name: string
          status: string
          tournament_id: string
        }
        Insert: {
          captain_id: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          pool?: string | null
          seed?: number | null
          short_name: string
          status?: string
          tournament_id: string
        }
        Update: {
          captain_id?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          pool?: string | null
          seed?: number | null
          short_name?: string
          status?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_ties: {
        Row: {
          advances_to_slot: string | null
          advances_to_tie: string | null
          created_at: string | null
          id: string
          lineup_deadline: string | null
          lineup_locked_a: boolean
          lineup_locked_b: boolean
          loser_advances_to_slot: string | null
          loser_advances_to_tie: string | null
          needs_admin_decision: boolean
          result_type: string
          round_name: string | null
          round_number: number | null
          scheduled_at: string | null
          score_team_a: number
          score_team_b: number
          stage: string | null
          state: string
          team_a_id: string | null
          team_b_id: string | null
          tie_code: string
          tournament_id: string
          updated_at: string | null
          winner_team_id: string | null
        }
        Insert: {
          advances_to_slot?: string | null
          advances_to_tie?: string | null
          created_at?: string | null
          id?: string
          lineup_deadline?: string | null
          lineup_locked_a?: boolean
          lineup_locked_b?: boolean
          loser_advances_to_slot?: string | null
          loser_advances_to_tie?: string | null
          needs_admin_decision?: boolean
          result_type?: string
          round_name?: string | null
          round_number?: number | null
          scheduled_at?: string | null
          score_team_a?: number
          score_team_b?: number
          stage?: string | null
          state?: string
          team_a_id?: string | null
          team_b_id?: string | null
          tie_code: string
          tournament_id: string
          updated_at?: string | null
          winner_team_id?: string | null
        }
        Update: {
          advances_to_slot?: string | null
          advances_to_tie?: string | null
          created_at?: string | null
          id?: string
          lineup_deadline?: string | null
          lineup_locked_a?: boolean
          lineup_locked_b?: boolean
          loser_advances_to_slot?: string | null
          loser_advances_to_tie?: string | null
          needs_admin_decision?: boolean
          result_type?: string
          round_name?: string | null
          round_number?: number | null
          scheduled_at?: string | null
          score_team_a?: number
          score_team_b?: number
          stage?: string | null
          state?: string
          team_a_id?: string | null
          team_b_id?: string | null
          tie_code?: string
          tournament_id?: string
          updated_at?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_ties_advances_to_tie_fkey"
            columns: ["advances_to_tie"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_loser_advances_to_tie_fkey"
            columns: ["loser_advances_to_tie"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "tournament_team_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tournament_ties_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "tournament_team_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tournament_ties_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_ties_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_team_standings"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "tournament_ties_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "tournament_teams"
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
          counts_for_elo: boolean
          created_at: string
          created_by: string | null
          description: string | null
          eligibility: string | null
          end_date: string | null
          form_close_date: string | null
          form_status: string | null
          form_url: string | null
          format_family: string
          id: string
          ignore_gender_rules: boolean
          max_rubbers_per_player: number | null
          name: string
          play_dead_rubbers: boolean
          require_app_registration: boolean
          show_brackets: boolean | null
          show_participants: boolean | null
          start_date: string | null
          status: string
          team_roster_max: number | null
          team_roster_min: number | null
          team_self_registration: boolean
          tie_format_config: Json | null
          tie_points_draw: number | null
          tie_points_win: number | null
          tournament_type: string
          venue: string | null
          year: number
        }
        Insert: {
          archived_at?: string | null
          auto_reminders_enabled?: boolean | null
          bracket_format?: string
          categories?: string[] | null
          counts_for_elo?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string | null
          end_date?: string | null
          form_close_date?: string | null
          form_status?: string | null
          form_url?: string | null
          format_family?: string
          id?: string
          ignore_gender_rules?: boolean
          max_rubbers_per_player?: number | null
          name: string
          play_dead_rubbers?: boolean
          require_app_registration?: boolean
          show_brackets?: boolean | null
          show_participants?: boolean | null
          start_date?: string | null
          status?: string
          team_roster_max?: number | null
          team_roster_min?: number | null
          team_self_registration?: boolean
          tie_format_config?: Json | null
          tie_points_draw?: number | null
          tie_points_win?: number | null
          tournament_type?: string
          venue?: string | null
          year: number
        }
        Update: {
          archived_at?: string | null
          auto_reminders_enabled?: boolean | null
          bracket_format?: string
          categories?: string[] | null
          counts_for_elo?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          eligibility?: string | null
          end_date?: string | null
          form_close_date?: string | null
          form_status?: string | null
          form_url?: string | null
          format_family?: string
          id?: string
          ignore_gender_rules?: boolean
          max_rubbers_per_player?: number | null
          name?: string
          play_dead_rubbers?: boolean
          require_app_registration?: boolean
          show_brackets?: boolean | null
          show_participants?: boolean | null
          start_date?: string | null
          status?: string
          team_roster_max?: number | null
          team_roster_min?: number | null
          team_self_registration?: boolean
          tie_format_config?: Json | null
          tie_points_draw?: number | null
          tie_points_win?: number | null
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
      tournament_team_standings: {
        Row: {
          drawn: number | null
          lost: number | null
          played: number | null
          pool: string | null
          rubbers_against: number | null
          rubbers_for: number | null
          team_id: string | null
          team_name: string | null
          tie_points: number | null
          tournament_id: string | null
          won: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
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
      admin_assign_umpires: {
        Args: {
          p_end_time?: string
          p_start_time?: string
          p_tournament_match_id?: string
          p_user_ids: string[]
        }
        Returns: number
      }
      admin_delete_umpire_assignment: {
        Args: { p_id: string }
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
      auto_claim_duplicate_profile: { Args: never; Returns: boolean }
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
      can_umpire_match: {
        Args: { p_match_id: string; p_uid: string }
        Returns: boolean
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
          default_match_reminder_mins: number | null
          deleted_at: string | null
          department: string | null
          dominant_hand: string | null
          doubles_elo: number | null
          doubles_matches_played: number | null
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
          is_guest: boolean
          is_looking_to_play: boolean | null
          is_retired: boolean | null
          joined_year: number | null
          mixed_elo: number | null
          mixed_matches_played: number | null
          mixed_record: string | null
          nationality: string | null
          nickname: string | null
          playing_level: string | null
          playing_style: string | null
          pref_notify_buddy_status: boolean | null
          pref_notify_point: boolean
          pref_notify_serve: boolean
          pref_notify_smash: boolean
          pref_notify_victory: boolean
          pref_notify_whistle: boolean
          pref_receive_email: boolean
          pref_receive_push: boolean
          quote: string | null
          racket_details: Json | null
          recent_form: string[] | null
          recent_matches: Json | null
          role: string | null
          shoes: string | null
          singles_elo: number | null
          singles_matches_played: number | null
          singles_record: string | null
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
      create_team: {
        Args: {
          p_captain_id: string
          p_logo_url: string
          p_name: string
          p_short_name: string
          p_tournament_id: string
        }
        Returns: string
      }
      create_tie: {
        Args: {
          p_advances_to_slot: string
          p_advances_to_tie: string
          p_stage: string
          p_team_a_id: string
          p_team_b_id: string
          p_tie_code: string
          p_tournament_id: string
        }
        Returns: string
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
      invite_team_member: {
        Args: { p_player_id: string; p_team_id: string }
        Returns: string
      }
      is_active_team_member: { Args: { t_team_id: string }; Returns: boolean }
      is_authorized_for_analytics: {
        Args: {
          p_auth_uid: string
          p_match_id: string
          p_match_source: string
          p_target_player: string
        }
        Returns: boolean
      }
      is_team_captain: { Args: { t_team_id: string }; Returns: boolean }
      is_team_staff: { Args: { t_team_id: string }; Returns: boolean }
      is_tournament_manager: { Args: { t_id: string }; Returns: boolean }
      link_label_to_player: {
        Args: { p_label: string; p_partner_id?: string; p_player_id: string }
        Returns: number
      }
      lock_tie_lineup: {
        Args: { p_side: string; p_tie_id: string }
        Returns: boolean
      }
      pick_team_label: {
        Args: { p_rebuilt: string; p_stored: string }
        Returns: string
      }
      process_tournament_bracket_progression: {
        Args: { p_match_id: string; p_winner_id: string }
        Returns: undefined
      }
      push_match_alert:
        | { Args: { p_message: string }; Returns: undefined }
        | { Args: { p_message: string; p_title?: string }; Returns: undefined }
      recalculate_all_elo: { Args: never; Returns: undefined }
      recalculate_all_win_loss_records: { Args: never; Returns: undefined }
      recalculate_category_records: {
        Args: { player_uuid: string }
        Returns: undefined
      }
      recalculate_player_all_records: {
        Args: { player_uuid: string }
        Returns: undefined
      }
      recalculate_player_win_loss_records: {
        Args: { p_player_id: string }
        Returns: undefined
      }
      recalculate_tournament_elo: { Args: never; Returns: undefined }
      record_tournament_walkover: {
        Args: {
          p_match_id: string
          p_scored_by?: string
          p_winner_side: number
        }
        Returns: undefined
      }
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
      remove_team_member: { Args: { p_member_id: string }; Returns: boolean }
      respond_team_invite: {
        Args: { p_accept: boolean; p_member_id: string }
        Returns: boolean
      }
      save_tie_lineup: {
        Args: { p_assignments: Json; p_side: string; p_tie_id: string }
        Returns: boolean
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
      set_tie_result: {
        Args: { p_note: string; p_tie_id: string; p_winner_team_id: string }
        Returns: boolean
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
      umpire_submit_match: {
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
      undo_tournament_match: {
        Args: { p_match_id: string }
        Returns: undefined
      }
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
      validate_tie_format: { Args: { config: Json }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
