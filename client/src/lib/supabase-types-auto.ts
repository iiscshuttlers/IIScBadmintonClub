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
      analytics_events: {
        Row: {
          created_at: string
          event: string
          id: string
          player_id: string | null
          props: Json
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          player_id?: string | null
          props?: Json
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          player_id?: string | null
          props?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_predictions: {
        Row: {
          category: string
          picks: Json
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          picks?: Json
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          picks?: Json
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bracket_predictions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_predictions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          achievement: string | null
          category: string
          code: string
          event_date: string | null
          id: string
          issued_at: string
          placement: string
          recipient: string
          tournament_id: string
          tournament_name: string
          user_id: string | null
        }
        Insert: {
          achievement?: string | null
          category: string
          code: string
          event_date?: string | null
          id?: string
          issued_at?: string
          placement: string
          recipient: string
          tournament_id: string
          tournament_name: string
          user_id?: string | null
        }
        Update: {
          achievement?: string | null
          category?: string
          code?: string
          event_date?: string | null
          id?: string
          issued_at?: string
          placement?: string
          recipient?: string
          tournament_id?: string
          tournament_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
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
        Relationships: []
      }
      court_calls: {
        Row: {
          called_at: string
          called_by: string | null
          id: string
          match_id: string
        }
        Insert: {
          called_at?: string
          called_by?: string | null
          id?: string
          match_id: string
        }
        Update: {
          called_at?: string
          called_by?: string | null
          id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_calls_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_calls_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_calls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_calls_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      court_queue_alerts: {
        Row: {
          match_id: string
          position: number
          sent_at: string
          user_id: string
        }
        Insert: {
          match_id: string
          position: number
          sent_at?: string
          user_id: string
        }
        Update: {
          match_id?: string
          position?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_queue_alerts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "court_queue_alerts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      delivered_targeted_alerts: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          event_version: number
          id: string
          match_id: string
          status: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_type: string
          event_version?: number
          id?: string
          match_id: string
          status?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          event_version?: number
          id?: string
          match_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivered_targeted_alerts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivered_targeted_alerts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
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
      gallery_album_subscriptions: {
        Row: {
          album: string
          created_at: string
          subscribed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          album: string
          created_at?: string
          subscribed: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          album?: string
          created_at?: string
          subscribed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lineup_deadline_alerts: {
        Row: {
          sent_at: string
          side: string
          threshold: number
          tie_id: string
        }
        Insert: {
          sent_at?: string
          side: string
          threshold: number
          tie_id: string
        }
        Update: {
          sent_at?: string
          side?: string
          threshold?: number
          tie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineup_deadline_alerts_tie_id_fkey"
            columns: ["tie_id"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
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
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_reminders_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
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
      player_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          player_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          player_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_aliases: {
        Row: {
          merged_at: string
          merged_by: string | null
          old_player_id: string
          operation_id: string | null
          player_id: string
          reason: string | null
          summary: Json | null
        }
        Insert: {
          merged_at?: string
          merged_by?: string | null
          old_player_id: string
          operation_id?: string | null
          player_id: string
          reason?: string | null
          summary?: Json | null
        }
        Update: {
          merged_at?: string
          merged_by?: string | null
          old_player_id?: string
          operation_id?: string | null
          player_id?: string
          reason?: string | null
          summary?: Json | null
        }
        Relationships: []
      }
      player_availability: {
        Row: {
          available_until: string
          note: string | null
          player_id: string
          updated_at: string
        }
        Insert: {
          available_until: string
          note?: string | null
          player_id: string
          updated_at?: string
        }
        Update: {
          available_until?: string
          note?: string | null
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_availability_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      player_claim_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          evidence: string
          guest_id: string
          id: number
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence: string
          guest_id: string
          id?: number
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          evidence?: string
          guest_id?: string
          id?: number
          requester_id?: string
          status?: string
        }
        Relationships: []
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
      player_identity_merge_moves: {
        Row: {
          column_name: string
          id: number
          operation_id: string
          row_key: Json
          table_name: string
        }
        Insert: {
          column_name: string
          id?: never
          operation_id: string
          row_key: Json
          table_name: string
        }
        Update: {
          column_name?: string
          id?: never
          operation_id?: string
          row_key?: Json
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_identity_merge_moves_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "player_identity_merge_operations"
            referencedColumns: ["operation_id"]
          },
        ]
      }
      player_identity_merge_operations: {
        Row: {
          guest_id: string
          guest_snapshot: Json
          merged_at: string
          merged_by: string
          operation_id: string
          redirected_aliases: string[]
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          summary: Json
          target_id: string
        }
        Insert: {
          guest_id: string
          guest_snapshot: Json
          merged_at?: string
          merged_by: string
          operation_id: string
          redirected_aliases?: string[]
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          summary?: Json
          target_id: string
        }
        Update: {
          guest_id?: string
          guest_snapshot?: Json
          merged_at?: string
          merged_by?: string
          operation_id?: string
          redirected_aliases?: string[]
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          summary?: Json
          target_id?: string
        }
        Relationships: []
      }
      player_merge_label_changes: {
        Row: {
          column_name: string
          created_at: string
          id: number
          match_id: string
          new_label: string
          old_label: string
          old_player_id: string
        }
        Insert: {
          column_name: string
          created_at?: string
          id?: number
          match_id: string
          new_label: string
          old_label: string
          old_player_id: string
        }
        Update: {
          column_name?: string
          created_at?: string
          id?: number
          match_id?: string
          new_label?: string
          old_label?: string
          old_player_id?: string
        }
        Relationships: []
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
          pref_notify_gallery: boolean
          pref_notify_point: boolean
          pref_notify_serve: boolean
          pref_notify_smash: boolean
          pref_notify_victory: boolean
          pref_notify_whistle: boolean
          pref_receive_email: boolean
          pref_receive_push: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
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
          status: string
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
          pref_notify_gallery?: boolean
          pref_notify_point?: boolean
          pref_notify_serve?: boolean
          pref_notify_smash?: boolean
          pref_notify_victory?: boolean
          pref_notify_whistle?: boolean
          pref_receive_email?: boolean
          pref_receive_push?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
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
          status?: string
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
          pref_notify_gallery?: boolean
          pref_notify_point?: boolean
          pref_notify_serve?: boolean
          pref_notify_smash?: boolean
          pref_notify_victory?: boolean
          pref_notify_whistle?: boolean
          pref_receive_email?: boolean
          pref_receive_push?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
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
          status?: string
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
      ranking_snapshots: {
        Row: {
          created_at: string
          list: string
          player_id: string
          rank: number
          rating: number
          snapshot_date: string
        }
        Insert: {
          created_at?: string
          list: string
          player_id: string
          rank: number
          rating: number
          snapshot_date: string
        }
        Update: {
          created_at?: string
          list?: string
          player_id?: string
          rank?: number
          rating?: number
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
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
      scheduled_notifications: {
        Row: {
          audience: string
          body: string
          channels: string[]
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          link: string | null
          recipient_ids: string[]
          scheduled_at: string
          sent_at: string | null
          status: string
          title: string
          tournament_id: string | null
        }
        Insert: {
          audience?: string
          body: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          link?: string | null
          recipient_ids?: string[]
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          title: string
          tournament_id?: string | null
        }
        Update: {
          audience?: string
          body?: string
          channels?: string[]
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          link?: string | null
          recipient_ids?: string[]
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          title?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_notifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
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
      tie_lineup_audits: {
        Row: {
          action_type: string
          authorized_by: string | null
          both_captains_agreed: boolean
          created_at: string | null
          id: string
          original_player_id: string | null
          reason: string | null
          referee_id: string
          replacement_player_id: string | null
          rubber_order: number | null
          tie_id: string
        }
        Insert: {
          action_type: string
          authorized_by?: string | null
          both_captains_agreed?: boolean
          created_at?: string | null
          id?: string
          original_player_id?: string | null
          reason?: string | null
          referee_id: string
          replacement_player_id?: string | null
          rubber_order?: number | null
          tie_id: string
        }
        Update: {
          action_type?: string
          authorized_by?: string | null
          both_captains_agreed?: boolean
          created_at?: string | null
          id?: string
          original_player_id?: string | null
          reason?: string | null
          referee_id?: string
          replacement_player_id?: string | null
          rubber_order?: number | null
          tie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tie_lineup_audits_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_original_player_id_fkey"
            columns: ["original_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_original_player_id_fkey"
            columns: ["original_player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_replacement_player_id_fkey"
            columns: ["replacement_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_replacement_player_id_fkey"
            columns: ["replacement_player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineup_audits_tie_id_fkey"
            columns: ["tie_id"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
            referencedColumns: ["id"]
          },
        ]
      }
      tie_lineup_watchers: {
        Row: {
          created_at: string | null
          id: string
          tie_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tie_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tie_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tie_lineup_watchers_tie_id_fkey"
            columns: ["tie_id"]
            isOneToOne: false
            referencedRelation: "tournament_ties"
            referencedColumns: ["id"]
          },
        ]
      }
      tie_lineups: {
        Row: {
          id: string
          is_decider: boolean
          is_revealed: boolean | null
          player1_id: string
          player2_id: string | null
          proposed_playing_order: number | null
          revealed_at: string | null
          revealed_by: string | null
          rubber_order: number
          side: string
          submitted_by: string
          tie_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          is_decider?: boolean
          is_revealed?: boolean | null
          player1_id: string
          player2_id?: string | null
          proposed_playing_order?: number | null
          revealed_at?: string | null
          revealed_by?: string | null
          rubber_order: number
          side: string
          submitted_by: string
          tie_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          is_decider?: boolean
          is_revealed?: boolean | null
          player1_id?: string
          player2_id?: string | null
          proposed_playing_order?: number | null
          revealed_at?: string | null
          revealed_by?: string | null
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
            foreignKeyName: "tie_lineups_revealed_by_fkey"
            columns: ["revealed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tie_lineups_revealed_by_fkey"
            columns: ["revealed_by"]
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
      tournament_audit_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string
          id: number
          operation_id: string | null
          reason: string | null
          source: string
          tournament_id: string
          undoes_event_id: number | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id: string
          id?: number
          operation_id?: string | null
          reason?: string | null
          source: string
          tournament_id: string
          undoes_event_id?: number | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: number
          operation_id?: string | null
          reason?: string | null
          source?: string
          tournament_id?: string
          undoes_event_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_audit_events_undoes_event_id_fkey"
            columns: ["undoes_event_id"]
            isOneToOne: false
            referencedRelation: "tournament_audit_events"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_feedback: {
        Row: {
          comment: string | null
          created_at: string
          rating: number
          tags: string[]
          tournament_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          rating: number
          tags?: string[]
          tournament_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          rating?: number
          tags?: string[]
          tournament_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_feedback_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_match_point_logs: {
        Row: {
          final: boolean
          match_id: string
          point_count: number
          points: Json
          recorded_by: string | null
          revision: number
          superseded_by_correction: boolean
          updated_at: string
        }
        Insert: {
          final?: boolean
          match_id: string
          point_count?: number
          points?: Json
          recorded_by?: string | null
          revision?: number
          superseded_by_correction?: boolean
          updated_at?: string
        }
        Update: {
          final?: boolean
          match_id?: string
          point_count?: number
          points?: Json
          recorded_by?: string | null
          revision?: number
          superseded_by_correction?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_point_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_point_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "tournament_matches"
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
          is_decider_tiebreaker: boolean
          locked: boolean | null
          match_code: string
          match_number: number
          player1_id: string | null
          player2_id: string | null
          player3_id: string | null
          player4_id: string | null
          playing_order: number | null
          points_to_win: number | null
          reminder_sent: boolean | null
          result_operation_id: string | null
          result_revision: number
          revealed_at: string | null
          revealed_by: string | null
          round: number
          round_name: string
          rubber_label: string | null
          rubber_order: number | null
          schedule_overridden_by: string | null
          schedule_override_at: string | null
          schedule_override_reason: string | null
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
          is_decider_tiebreaker?: boolean
          locked?: boolean | null
          match_code: string
          match_number: number
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          player4_id?: string | null
          playing_order?: number | null
          points_to_win?: number | null
          reminder_sent?: boolean | null
          result_operation_id?: string | null
          result_revision?: number
          revealed_at?: string | null
          revealed_by?: string | null
          round: number
          round_name: string
          rubber_label?: string | null
          rubber_order?: number | null
          schedule_overridden_by?: string | null
          schedule_override_at?: string | null
          schedule_override_reason?: string | null
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
          is_decider_tiebreaker?: boolean
          locked?: boolean | null
          match_code?: string
          match_number?: number
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          player4_id?: string | null
          playing_order?: number | null
          points_to_win?: number | null
          reminder_sent?: boolean | null
          result_operation_id?: string | null
          result_revision?: number
          revealed_at?: string | null
          revealed_by?: string | null
          round?: number
          round_name?: string
          rubber_label?: string | null
          rubber_order?: number | null
          schedule_overridden_by?: string | null
          schedule_override_at?: string | null
          schedule_override_reason?: string | null
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
            foreignKeyName: "tournament_matches_revealed_by_fkey"
            columns: ["revealed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_revealed_by_fkey"
            columns: ["revealed_by"]
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
      tournament_officials: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: string
          tournament_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: string
          tournament_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: string
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_officials_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_officials_user_id_fkey"
            columns: ["user_id"]
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
          email: string | null
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
          email?: string | null
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
          email?: string | null
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
      tournament_registrations: {
        Row: {
          categories: string[]
          created_at: string
          email: string | null
          full_name: string
          id: string
          message: string | null
          partner_names: string | null
          phone: string | null
          player_id: string
          receipt_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tournament_id: string
          transaction_id: string | null
        }
        Insert: {
          categories?: string[]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          message?: string | null
          partner_names?: string | null
          phone?: string | null
          player_id: string
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tournament_id: string
          transaction_id?: string | null
        }
        Update: {
          categories?: string[]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          message?: string | null
          partner_names?: string | null
          phone?: string | null
          player_id?: string
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tournament_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
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
          invite_token: string | null
          invite_token_enabled: boolean
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
          invite_token?: string | null
          invite_token_enabled?: boolean
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
          invite_token?: string | null
          invite_token_enabled?: boolean
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
          decider_status: string | null
          has_decider_rubber: boolean
          id: string
          lineup_deadline: string | null
          lineup_locked_a: boolean
          lineup_locked_b: boolean
          loser_advances_to_slot: string | null
          loser_advances_to_tie: string | null
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
          decider_status?: string | null
          has_decider_rubber?: boolean
          id?: string
          lineup_deadline?: string | null
          lineup_locked_a?: boolean
          lineup_locked_b?: boolean
          loser_advances_to_slot?: string | null
          loser_advances_to_tie?: string | null
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
          decider_status?: string | null
          has_decider_rubber?: boolean
          id?: string
          lineup_deadline?: string | null
          lineup_locked_a?: boolean
          lineup_locked_b?: boolean
          loser_advances_to_slot?: string | null
          loser_advances_to_tie?: string | null
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
          estimated_match_minutes: number
          form_close_date: string | null
          form_status: string | null
          form_url: string | null
          format_family: string
          id: string
          ignore_gender_rules: boolean
          max_rubbers_per_player: number | null
          min_rest_minutes: number
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
          unavailable_court_periods: Json
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
          estimated_match_minutes?: number
          form_close_date?: string | null
          form_status?: string | null
          form_url?: string | null
          format_family?: string
          id?: string
          ignore_gender_rules?: boolean
          max_rubbers_per_player?: number | null
          min_rest_minutes?: number
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
          unavailable_court_periods?: Json
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
          estimated_match_minutes?: number
          form_close_date?: string | null
          form_status?: string | null
          form_url?: string | null
          format_family?: string
          id?: string
          ignore_gender_rules?: boolean
          max_rubbers_per_player?: number | null
          min_rest_minutes?: number
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
          unavailable_court_periods?: Json
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
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "umpire_assignments_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
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
            referencedRelation: "player_matches_unified"
            referencedColumns: ["id"]
          },
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
          is_muted: boolean
          notify_before_mins: number | null
          notify_match_call: boolean
          notify_result: boolean
          notify_schedule_change: boolean
          player_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_muted?: boolean
          notify_before_mins?: number | null
          notify_match_call?: boolean
          notify_result?: boolean
          notify_schedule_change?: boolean
          player_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_muted?: boolean
          notify_before_mins?: number | null
          notify_match_call?: boolean
          notify_result?: boolean
          notify_schedule_change?: boolean
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
      user_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_player_id: string
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_player_id: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_player_id?: string
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reports_reported_player_id_fkey"
            columns: ["reported_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reported_player_id_fkey"
            columns: ["reported_player_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "search_players_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tournament_subscriptions: {
        Row: {
          created_at: string
          id: string
          is_muted: boolean
          notify_match_call: boolean
          notify_result: boolean
          notify_schedule_change: boolean
          tournament_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_muted?: boolean
          notify_match_call?: boolean
          notify_result?: boolean
          notify_schedule_change?: boolean
          tournament_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_muted?: boolean
          notify_match_call?: boolean
          notify_result?: boolean
          notify_schedule_change?: boolean
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tournament_subscriptions_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      player_matches_unified: {
        Row: {
          category: string | null
          counts_for_elo: boolean | null
          created_at: string | null
          date: string | null
          ended_at: string | null
          id: string | null
          is_friendly: boolean | null
          player1_id: string | null
          player2_id: string | null
          player3_id: string | null
          player4_id: string | null
          scheduled_at: string | null
          score: string | null
          status: string | null
          winner_id: string | null
          winner_side: number | null
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
          points_against: number | null
          points_diff: number | null
          points_for: number | null
          pool: string | null
          rubbers_against: number | null
          rubbers_diff: number | null
          rubbers_for: number | null
          sets_against: number | null
          sets_diff: number | null
          sets_for: number | null
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
      _change_tournament_match_result: {
        Args: {
          p_action: string
          p_expected_revision: number
          p_match_id: string
          p_operation_id: string
          p_reason: string
          p_score: string
          p_scored_by: string
          p_sets: string[]
          p_undoes_event_id: number
          p_winner_side: number
        }
        Returns: Json
      }
      _claim_find_lost: {
        Args: {
          p_claimed_as: string
          p_contact: string
          p_msg: string
          p_post: string
        }
        Returns: undefined
      }
      _is_site_admin: { Args: never; Returns: boolean }
      _player_merge_impact: {
        Args: { p_guest: string; p_real: string }
        Returns: Json
      }
      _player_reference_columns: {
        Args: never
        Returns: {
          column_name: string
          table_name: string
        }[]
      }
      _record_tournament_audit_event: {
        Args: {
          p_action: string
          p_after: Json
          p_before: Json
          p_entity: string
          p_entity_id: string
          p_operation_id: string
          p_reason: string
          p_source: string
          p_tournament_id: string
          p_undoes_event_id: number
        }
        Returns: number
      }
      _swap_label_name: {
        Args: { p_from: string; p_label: string; p_to: string }
        Returns: string
      }
      _tournament_contacts_enabled: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      _unclaim_find_lost: { Args: { p_post: string }; Returns: undefined }
      add_decider_rubber_to_tie: {
        Args: {
          p_best_of_sets?: number
          p_category?: string
          p_label?: string
          p_points_to_win?: number
          p_tie_id: string
        }
        Returns: Json
      }
      admin_approve_players:
        | { Args: { p_ids: string[] }; Returns: undefined }
        | {
            Args: { p_approved?: boolean; p_ids: string[] }
            Returns: undefined
          }
      admin_cron_health: {
        Args: never
        Returns: {
          active: boolean
          failures_24h: number
          jobname: string
          last_duration_sec: number
          last_end: string
          last_message: string
          last_start: string
          last_status: string
          runs_24h: number
          schedule: string
        }[]
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
      admin_fill_player_contact: {
        Args: { p_contact: string; p_player_id: string }
        Returns: boolean
      }
      admin_get_player_private: {
        Args: { p_ids: string[] }
        Returns: {
          contact_number: string
          email: string
          id: string
          iisc_email: string
          sr_number: string
        }[]
      }
      admin_notification_delivery: {
        Args: { days_back?: number }
        Returns: {
          count: number
          status: string
        }[]
      }
      admin_search_players_by_email: {
        Args: { p_query: string }
        Returns: {
          email: string
          full_name: string
          id: string
          iisc_email: string
          is_guest: boolean
        }[]
      }
      admin_update_tournament_match: {
        Args: {
          p_match_id: string
          p_operation_id: string
          p_patch: Json
          p_reason: string
        }
        Returns: Json
      }
      advance_tournament_winner: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      analytics_event_counts: {
        Args: { days_back?: number }
        Returns: {
          count: number
          event: string
        }[]
      }
      apply_tournament_match_correction: {
        Args: {
          p_expected_revision: number
          p_match_id: string
          p_operation_id: string
          p_reason: string
          p_score: string
          p_scored_by?: string
          p_sets: string[]
          p_winner_side: number
        }
        Returns: Json
      }
      archive_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      bracket_category_locked: {
        Args: { p_category: string; p_tournament: string }
        Returns: boolean
      }
      bracket_leaderboard: {
        Args: { p_category: string; p_tournament: string }
        Returns: {
          full_name: string
          picks: Json
          user_id: string
        }[]
      }
      bracket_started_codes: {
        Args: { p_category: string; p_tournament: string }
        Returns: string[]
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
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
              claim_msg: string
              claimer_id: string
              claimer_name: string
              post_uuid: string
            }
            Returns: undefined
          }
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
      claim_guest_player: {
        Args: { p_guest_id: string; p_real_player_id: string }
        Returns: undefined
      }
      compact_point_log: { Args: { p_log: Json }; Returns: Json }
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
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
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
          status: string
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
      create_guest_player_with_email: {
        Args: { p_email: string; p_full_name: string }
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
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
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
          status: string
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
      current_club_ranks: {
        Args: never
        Returns: {
          list: string
          player_id: string
          rank: number
          rating: number
        }[]
      }
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] }
      dblink_cancel_query: { Args: { "": string }; Returns: string }
      dblink_close: { Args: { "": string }; Returns: string }
      dblink_connect: { Args: { "": string }; Returns: string }
      dblink_connect_u: { Args: { "": string }; Returns: string }
      dblink_current_query: { Args: never; Returns: string }
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      dblink_error_message: { Args: { "": string }; Returns: string }
      dblink_exec: { Args: { "": string }; Returns: string }
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] }
        Returns: undefined
      }
      dblink_get_connections: { Args: never; Returns: string[] }
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] }
      dblink_get_pkey: {
        Args: { "": string }
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][]
        SetofOptions: {
          from: "*"
          to: "dblink_pkey_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dblink_get_result: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      dblink_is_busy: { Args: { "": string }; Returns: number }
      decide_player_claim: {
        Args: {
          p_approve: boolean
          p_note: string
          p_operation_id: string
          p_request_id: number
        }
        Returns: Json
      }
      delete_guest_player: { Args: { p_guest_id: string }; Returns: undefined }
      delete_player_match_session: {
        Args: { p_match_id: string; p_match_source: string }
        Returns: undefined
      }
      dispatch_authoritative_match_alert: {
        Args: {
          p_body: string
          p_event_type: string
          p_match_id: string
          p_title: string
          p_version?: number
        }
        Returns: Json
      }
      emergency_modify_lineup:
        | {
            Args: {
              p_new_player_id: string
              p_pos: number
              p_reason: string
              p_rubber_order: number
              p_side: string
              p_tie_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_both_captains_agreed?: boolean
              p_new_player_id: string
              p_pos: number
              p_reason: string
              p_rubber_order: number
              p_side: string
              p_tie_id: string
            }
            Returns: boolean
          }
      find_player_by_email: {
        Args: { p_email: string }
        Returns: {
          avatar_url: string
          full_name: string
          gender: string
          id: string
          is_guest: boolean
        }[]
      }
      fulfill_marketplace_request: {
        Args: { claimer_id: string; claimer_name: string; listing_uuid: string }
        Returns: undefined
      }
      generate_certificate_code: { Args: never; Returns: string }
      generate_new_team_invite_token: {
        Args: { p_team_id: string }
        Returns: string
      }
      get_find_lost_claim_contacts: {
        Args: { p_ids: string[] }
        Returns: {
          claim_contact: string
          id: string
        }[]
      }
      get_k_factor: {
        Args: { p_config: Json; p_matches: number }
        Returns: number
      }
      get_match_dominance: { Args: { p_sets: string[] }; Returns: number }
      get_match_points_won: {
        Args: { p_score: string; p_side: number }
        Returns: number
      }
      get_match_sets_won: {
        Args: { p_score: string; p_side: number }
        Returns: number
      }
      get_my_player_private: {
        Args: never
        Returns: {
          contact_number: string
          email: string
          id: string
          iisc_email: string
          sr_number: string
        }[]
      }
      get_participant_emails: {
        Args: { p_tournament_id: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_set_multiplier: { Args: { p_sets: string[] }; Returns: number }
      get_team_by_invite_token: { Args: { p_token: string }; Returns: Json }
      get_team_invite_token: { Args: { p_team_id: string }; Returns: string }
      get_tournament_contacts: {
        Args: { p_player_ids: string[]; p_tournament_id: string }
        Returns: {
          contact_number: string
          full_name: string
          id: string
        }[]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      invite_team_member: {
        Args: { p_player_id: string; p_team_id: string }
        Returns: string
      }
      is_admin_or_master: { Args: never; Returns: boolean }
      is_admin_or_umpire: { Args: never; Returns: boolean }
      is_in_quiet_hours: {
        Args: { p_current_time?: string; p_end: string; p_start: string }
        Returns: boolean
      }
      is_my_player_id: { Args: { p_player_id: string }; Returns: boolean }
      is_team_captain: { Args: { t_team_id: string }; Returns: boolean }
      is_team_staff: { Args: { t_team_id: string }; Returns: boolean }
      is_tournament_manager: { Args: { t_id: string }; Returns: boolean }
      is_tournament_official: {
        Args: { p_role?: string; t_id: string }
        Returns: boolean
      }
      issue_certificate: {
        Args: {
          p_achievement?: string
          p_category: string
          p_event_date?: string
          p_placement: string
          p_recipient: string
          p_tournament_id: string
          p_tournament_name?: string
        }
        Returns: {
          code: string
          id: string
        }[]
      }
      join_team_by_token: { Args: { p_token: string }; Returns: Json }
      link_label_to_player: {
        Args: { p_label: string; p_partner_id?: string; p_player_id: string }
        Returns: number
      }
      list_reversible_player_merges: {
        Args: never
        Returns: {
          guest_id: string
          guest_name: string
          merged_at: string
          operation_id: string
          summary: Json
          target_id: string
          target_name: string
        }[]
      }
      lock_tie_lineup: {
        Args: { p_side: string; p_tie_id: string }
        Returns: boolean
      }
      merge_guest_player: {
        Args: { guest_id: string; real_id: string }
        Returns: undefined
      }
      merge_player_identity: {
        Args: {
          p_guest_id: string
          p_operation_id: string
          p_real_id: string
          p_reason: string
        }
        Returns: Json
      }
      override_tournament_schedule: {
        Args: {
          p_conflict_type?: string
          p_conflicting_id?: string
          p_court: string
          p_match_id: string
          p_reason: string
          p_scheduled_at: string
          p_tournament_id: string
        }
        Returns: Json
      }
      pick_team_label: {
        Args: { p_rebuilt: string; p_stored: string }
        Returns: string
      }
      played_in_tournament: {
        Args: { p_tournament: string; p_uid: string }
        Returns: boolean
      }
      player_email_in_use: { Args: { p_email: string }; Returns: string }
      populate_playoff_qualifiers_from_standings: {
        Args: { p_tournament_id: string }
        Returns: number
      }
      preview_player_merge: {
        Args: { p_guest_id: string; p_real_id: string }
        Returns: Json
      }
      preview_tournament_match_correction: {
        Args: { p_match_id: string; p_winner_side?: number }
        Returns: Json
      }
      process_tournament_bracket_progression: {
        Args: { p_match_id: string; p_winner_id: string }
        Returns: undefined
      }
      push_match_alert:
        | { Args: { p_message: string }; Returns: undefined }
        | { Args: { p_message: string; p_title?: string }; Returns: undefined }
      ranking_movement: {
        Args: { p_list?: string }
        Returns: {
          delta: number
          peak_rank: number
          player_id: string
          previous_rank: number
          rank: number
          since: string
          status: string
        }[]
      }
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
      record_tournament_walkover: {
        Args: {
          p_match_id: string
          p_scored_by?: string
          p_winner_side: number
        }
        Returns: undefined
      }
      record_win_pct: { Args: { p_record: string }; Returns: number }
      remove_live_match_by_id: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      remove_team_member: { Args: { p_member_id: string }; Returns: boolean }
      request_player_claim: {
        Args: { p_evidence: string; p_guest_id: string }
        Returns: Json
      }
      resolve_my_player_id: { Args: never; Returns: string }
      respond_team_invite: {
        Args: { p_accept: boolean; p_member_id: string }
        Returns: boolean
      }
      reveal_decider_rubber: { Args: { p_tie_id: string }; Returns: Json }
      reveal_tie_lineup: {
        Args: { p_rubber_order?: number; p_tie_id: string }
        Returns: boolean
      }
      reverse_player_identity_merge: {
        Args: { p_operation_id: string; p_reason: string }
        Returns: Json
      }
      send_ping_notification: {
        Args: { p_sender_name: string; p_target_id: string }
        Returns: undefined
      }
      set_player_role: {
        Args: { p_id: string; p_role: string }
        Returns: undefined
      }
      set_tie_playing_order: {
        Args: { p_playing_orders: Json; p_reason?: string; p_tie_id: string }
        Returns: boolean
      }
      set_tie_result: {
        Args: { p_note: string; p_tie_id: string; p_winner_team_id: string }
        Returns: boolean
      }
      set_tournament_match_times: {
        Args: { p_ended_at: string; p_match_id: string; p_started_at: string }
        Returns: undefined
      }
      set_tournament_round_rule: {
        Args: {
          p_best_of_sets: number
          p_category: string
          p_golden_point: number
          p_points_to_win: number
          p_round: number
          p_round_name: string | null
          p_tournament_id: string
        }
        Returns: undefined
      }
      start_tournament_match_checked: {
        Args: {
          p_expected_court?: string
          p_expected_scheduled_at?: string
          p_match_id: string
        }
        Returns: Json
      }
      submit_decider_lineup: {
        Args: {
          p_player1_id: string
          p_player2_id?: string
          p_side: string
          p_tie_id: string
        }
        Returns: Json
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
      submit_tournament_match_v2: {
        Args: {
          p_expected_revision: number
          p_match_id: string
          p_operation_id: string
          p_score: string
          p_sets: string[]
          p_umpire_id: string
          p_winner_side: number
        }
        Returns: Json
      }
      take_ranking_snapshot: { Args: { p_date?: string }; Returns: number }
      text_to_bytea: { Args: { data: string }; Returns: string }
      transition_tournament_lifecycle: {
        Args: { p_action: string; p_tournament_id: string }
        Returns: Json
      }
      unclaim_find_lost_item:
        | { Args: { post_uuid: string; user_id: string }; Returns: undefined }
        | { Args: { post_uuid: string; user_id: string }; Returns: undefined }
      undo_tournament_match: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      undo_tournament_match_correction: {
        Args: {
          p_event_id: number
          p_expected_revision: number
          p_operation_id: string
          p_reason: string
        }
        Returns: Json
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
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      verify_tournament_readiness: {
        Args: { p_action: string; p_tournament_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null
        colname: string | null
      }
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
