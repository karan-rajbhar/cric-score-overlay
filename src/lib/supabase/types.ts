export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ball_by_ball: {
        Row: {
          ball_number: number;
          batsman_id: string;
          bowler_id: string;
          commentary: string | null;
          created_at: string | null;
          dismissal_type: string | null;
          extra_type: string | null;
          extras: number | null;
          fielder_id: string | null;
          id: string;
          innings_id: string | null;
          is_wicket: boolean | null;
          match_id: string | null;
          non_striker_id: string;
          over_number: number;
          runs_scored: number | null;
          seq: number;
          shot_zone: string | null;
        };
        Insert: {
          ball_number: number;
          batsman_id: string;
          bowler_id: string;
          commentary?: string | null;
          created_at?: string | null;
          dismissal_type?: string | null;
          extra_type?: string | null;
          extras?: number | null;
          fielder_id?: string | null;
          id?: string;
          innings_id?: string | null;
          is_wicket?: boolean | null;
          match_id?: string | null;
          non_striker_id: string;
          over_number: number;
          runs_scored?: number | null;
          seq?: number;
          shot_zone?: string | null;
        };
        Update: {
          ball_number?: number;
          batsman_id?: string;
          bowler_id?: string;
          commentary?: string | null;
          created_at?: string | null;
          dismissal_type?: string | null;
          extra_type?: string | null;
          extras?: number | null;
          fielder_id?: string | null;
          id?: string;
          innings_id?: string | null;
          is_wicket?: boolean | null;
          match_id?: string | null;
          non_striker_id?: string;
          over_number?: number;
          runs_scored?: number | null;
          seq?: number;
          shot_zone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ball_by_ball_batsman_id_fkey";
            columns: ["batsman_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ball_by_ball_bowler_id_fkey";
            columns: ["bowler_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ball_by_ball_fielder_id_fkey";
            columns: ["fielder_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ball_by_ball_innings_id_fkey";
            columns: ["innings_id"];
            isOneToOne: false;
            referencedRelation: "innings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ball_by_ball_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "ball_by_ball_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ball_by_ball_non_striker_id_fkey";
            columns: ["non_striker_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      batting_performances: {
        Row: {
          balls_faced: number | null;
          batting_position: number;
          bowler_id: string | null;
          created_at: string | null;
          dismissal_type: string | null;
          fielder_id: string | null;
          fours: number | null;
          id: string;
          innings_id: string | null;
          is_current_batsman: boolean | null;
          is_out: boolean | null;
          is_striker: boolean | null;
          match_id: string | null;
          minutes_batted: number | null;
          runs_scored: number | null;
          sixes: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          balls_faced?: number | null;
          batting_position: number;
          bowler_id?: string | null;
          created_at?: string | null;
          dismissal_type?: string | null;
          fielder_id?: string | null;
          fours?: number | null;
          id?: string;
          innings_id?: string | null;
          is_current_batsman?: boolean | null;
          is_out?: boolean | null;
          is_striker?: boolean | null;
          match_id?: string | null;
          minutes_batted?: number | null;
          runs_scored?: number | null;
          sixes?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          balls_faced?: number | null;
          batting_position?: number;
          bowler_id?: string | null;
          created_at?: string | null;
          dismissal_type?: string | null;
          fielder_id?: string | null;
          fours?: number | null;
          id?: string;
          innings_id?: string | null;
          is_current_batsman?: boolean | null;
          is_out?: boolean | null;
          is_striker?: boolean | null;
          match_id?: string | null;
          minutes_batted?: number | null;
          runs_scored?: number | null;
          sixes?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "batting_performances_bowler_id_fkey";
            columns: ["bowler_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batting_performances_fielder_id_fkey";
            columns: ["fielder_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batting_performances_innings_id_fkey";
            columns: ["innings_id"];
            isOneToOne: false;
            referencedRelation: "innings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batting_performances_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "batting_performances_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "batting_performances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      bowling_performances: {
        Row: {
          balls_bowled: number | null;
          created_at: string | null;
          id: string;
          innings_id: string | null;
          is_current_bowler: boolean | null;
          maidens: number | null;
          match_id: string | null;
          no_balls: number | null;
          overs_bowled: number | null;
          runs_conceded: number | null;
          updated_at: string | null;
          user_id: string;
          wickets_taken: number | null;
          wides: number | null;
        };
        Insert: {
          balls_bowled?: number | null;
          created_at?: string | null;
          id?: string;
          innings_id?: string | null;
          is_current_bowler?: boolean | null;
          maidens?: number | null;
          match_id?: string | null;
          no_balls?: number | null;
          overs_bowled?: number | null;
          runs_conceded?: number | null;
          updated_at?: string | null;
          user_id: string;
          wickets_taken?: number | null;
          wides?: number | null;
        };
        Update: {
          balls_bowled?: number | null;
          created_at?: string | null;
          id?: string;
          innings_id?: string | null;
          is_current_bowler?: boolean | null;
          maidens?: number | null;
          match_id?: string | null;
          no_balls?: number | null;
          overs_bowled?: number | null;
          runs_conceded?: number | null;
          updated_at?: string | null;
          user_id?: string;
          wickets_taken?: number | null;
          wides?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bowling_performances_innings_id_fkey";
            columns: ["innings_id"];
            isOneToOne: false;
            referencedRelation: "innings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bowling_performances_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "bowling_performances_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bowling_performances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      club_hall_of_fame: {
        Row: {
          category: string;
          club_id: string;
          created_by: string | null;
          description: string | null;
          id: string;
          inducted_at: string | null;
          player_id: string;
          record_metric: string | null;
          season_or_year: string | null;
          title: string;
        };
        Insert: {
          category: string;
          club_id: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          inducted_at?: string | null;
          player_id: string;
          record_metric?: string | null;
          season_or_year?: string | null;
          title: string;
        };
        Update: {
          category?: string;
          club_id?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          inducted_at?: string | null;
          player_id?: string;
          record_metric?: string | null;
          season_or_year?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_hall_of_fame_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_hall_of_fame_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_hall_of_fame_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      club_invitations: {
        Row: {
          club_id: string | null;
          created_at: string | null;
          email: string | null;
          expires_at: string | null;
          id: string;
          invited_by: string | null;
          phone: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          club_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          invited_by?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          club_id?: string | null;
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          invited_by?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_invitations_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_invitations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      club_memberships: {
        Row: {
          club_id: string | null;
          id: string;
          joined_at: string | null;
          role: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          club_id?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          club_id?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      club_seasons: {
        Row: {
          club_id: string;
          created_at: string | null;
          end_date: string | null;
          id: string;
          is_current: boolean | null;
          name: string;
          start_date: string | null;
          updated_at: string | null;
        };
        Insert: {
          club_id: string;
          created_at?: string | null;
          end_date?: string | null;
          id?: string;
          is_current?: boolean | null;
          name: string;
          start_date?: string | null;
          updated_at?: string | null;
        };
        Update: {
          club_id?: string;
          created_at?: string | null;
          end_date?: string | null;
          id?: string;
          is_current?: boolean | null;
          name?: string;
          start_date?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "club_seasons_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          banner_url: string | null;
          club_type: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string | null;
          description: string | null;
          founded_year: number | null;
          id: string;
          is_public: boolean | null;
          location: string | null;
          logo_url: string | null;
          name: string;
          owner_id: string;
          short_name: string | null;
          social_links: Json | null;
          updated_at: string | null;
          website_url: string | null;
        };
        Insert: {
          banner_url?: string | null;
          club_type?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          founded_year?: number | null;
          id?: string;
          is_public?: boolean | null;
          location?: string | null;
          logo_url?: string | null;
          name: string;
          owner_id: string;
          short_name?: string | null;
          social_links?: Json | null;
          updated_at?: string | null;
          website_url?: string | null;
        };
        Update: {
          banner_url?: string | null;
          club_type?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string | null;
          description?: string | null;
          founded_year?: number | null;
          id?: string;
          is_public?: boolean | null;
          location?: string | null;
          logo_url?: string | null;
          name?: string;
          owner_id?: string;
          short_name?: string | null;
          social_links?: Json | null;
          updated_at?: string | null;
          website_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      fall_of_wickets: {
        Row: {
          batsman_out_id: string;
          bowler_id: string | null;
          created_at: string | null;
          dismissal_type: string;
          fielder_id: string | null;
          id: string;
          innings_id: string | null;
          match_id: string | null;
          overs_at_fall: number;
          runs_at_fall: number;
          wicket_number: number;
        };
        Insert: {
          batsman_out_id: string;
          bowler_id?: string | null;
          created_at?: string | null;
          dismissal_type: string;
          fielder_id?: string | null;
          id?: string;
          innings_id?: string | null;
          match_id?: string | null;
          overs_at_fall: number;
          runs_at_fall: number;
          wicket_number: number;
        };
        Update: {
          batsman_out_id?: string;
          bowler_id?: string | null;
          created_at?: string | null;
          dismissal_type?: string;
          fielder_id?: string | null;
          id?: string;
          innings_id?: string | null;
          match_id?: string | null;
          overs_at_fall?: number;
          runs_at_fall?: number;
          wicket_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "fall_of_wickets_batsman_out_id_fkey";
            columns: ["batsman_out_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fall_of_wickets_bowler_id_fkey";
            columns: ["bowler_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fall_of_wickets_fielder_id_fkey";
            columns: ["fielder_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fall_of_wickets_innings_id_fkey";
            columns: ["innings_id"];
            isOneToOne: false;
            referencedRelation: "innings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fall_of_wickets_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "fall_of_wickets_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      innings: {
        Row: {
          created_at: string | null;
          extras_byes: number | null;
          extras_leg_byes: number | null;
          extras_no_balls: number | null;
          extras_penalties: number | null;
          extras_total: number | null;
          extras_wides: number | null;
          id: string;
          innings_number: number;
          is_completed: boolean | null;
          match_id: string | null;
          target_runs: number | null;
          team_id: string;
          total_balls: number | null;
          total_overs: number | null;
          total_runs: number | null;
          total_wickets: number | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          extras_byes?: number | null;
          extras_leg_byes?: number | null;
          extras_no_balls?: number | null;
          extras_penalties?: number | null;
          extras_total?: number | null;
          extras_wides?: number | null;
          id?: string;
          innings_number: number;
          is_completed?: boolean | null;
          match_id?: string | null;
          target_runs?: number | null;
          team_id: string;
          total_balls?: number | null;
          total_overs?: number | null;
          total_runs?: number | null;
          total_wickets?: number | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          extras_byes?: number | null;
          extras_leg_byes?: number | null;
          extras_no_balls?: number | null;
          extras_penalties?: number | null;
          extras_total?: number | null;
          extras_wides?: number | null;
          id?: string;
          innings_number?: number;
          is_completed?: boolean | null;
          match_id?: string | null;
          target_runs?: number | null;
          team_id?: string;
          total_balls?: number | null;
          total_overs?: number | null;
          total_runs?: number | null;
          total_wickets?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "innings_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "innings_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "innings_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      match_claims: {
        Row: {
          additional_notes: string | null;
          balls_faced: number | null;
          catches: number | null;
          created_at: string | null;
          fours: number | null;
          id: string;
          match_date: string;
          match_title: string;
          opponent_team: string | null;
          overs_bowled: number | null;
          run_outs: number | null;
          runs_conceded: number | null;
          runs_scored: number | null;
          sixes: number | null;
          status: string | null;
          stumpings: number | null;
          updated_at: string | null;
          user_id: string;
          venue: string | null;
          verification_notes: string | null;
          verified_at: string | null;
          verified_by: string | null;
          wickets_taken: number | null;
        };
        Insert: {
          additional_notes?: string | null;
          balls_faced?: number | null;
          catches?: number | null;
          created_at?: string | null;
          fours?: number | null;
          id?: string;
          match_date: string;
          match_title: string;
          opponent_team?: string | null;
          overs_bowled?: number | null;
          run_outs?: number | null;
          runs_conceded?: number | null;
          runs_scored?: number | null;
          sixes?: number | null;
          status?: string | null;
          stumpings?: number | null;
          updated_at?: string | null;
          user_id: string;
          venue?: string | null;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          wickets_taken?: number | null;
        };
        Update: {
          additional_notes?: string | null;
          balls_faced?: number | null;
          catches?: number | null;
          created_at?: string | null;
          fours?: number | null;
          id?: string;
          match_date?: string;
          match_title?: string;
          opponent_team?: string | null;
          overs_bowled?: number | null;
          run_outs?: number | null;
          runs_conceded?: number | null;
          runs_scored?: number | null;
          sixes?: number | null;
          status?: string | null;
          stumpings?: number | null;
          updated_at?: string | null;
          user_id?: string;
          venue?: string | null;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          wickets_taken?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_claims_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      match_events: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          event_data: Json | null;
          event_type: string;
          id: string;
          match_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          event_data?: Json | null;
          event_type: string;
          id?: string;
          match_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          event_data?: Json | null;
          event_type?: string;
          id?: string;
          match_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "match_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "match_events_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "match_events_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          actual_end_time: string | null;
          actual_start_time: string | null;
          club_id: string | null;
          created_at: string | null;
          created_by: string;
          current_ball: number | null;
          current_innings: number | null;
          current_over: number | null;
          golden_ball: boolean | null;
          id: string;
          last_man_stands: boolean | null;
          match_admins: string[] | null;
          match_format: string | null;
          overs_per_innings: number | null;
          pitch_conditions: string | null;
          player_of_the_match_id: string | null;
          result_description: string | null;
          result_type: string | null;
          scheduled_at: string | null;
          scorer_name: string | null;
          season_id: string | null;
          status: string | null;
          team1_id: string;
          team2_id: string;
          third_umpire_name: string | null;
          title: string;
          toss_decision: string | null;
          toss_winner_team_id: string | null;
          tournament_id: string | null;
          umpire1_name: string | null;
          umpire2_name: string | null;
          updated_at: string | null;
          venue: string | null;
          weather_conditions: string | null;
          wickets_per_innings: number | null;
          win_margin: number | null;
          win_margin_type: string | null;
          winning_team_id: string | null;
        };
        Insert: {
          actual_end_time?: string | null;
          actual_start_time?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          created_by: string;
          current_ball?: number | null;
          current_innings?: number | null;
          current_over?: number | null;
          golden_ball?: boolean | null;
          id?: string;
          last_man_stands?: boolean | null;
          match_admins?: string[] | null;
          match_format?: string | null;
          overs_per_innings?: number | null;
          pitch_conditions?: string | null;
          player_of_the_match_id?: string | null;
          result_description?: string | null;
          result_type?: string | null;
          scheduled_at?: string | null;
          scorer_name?: string | null;
          season_id?: string | null;
          status?: string | null;
          team1_id: string;
          team2_id: string;
          third_umpire_name?: string | null;
          title: string;
          toss_decision?: string | null;
          toss_winner_team_id?: string | null;
          tournament_id?: string | null;
          umpire1_name?: string | null;
          umpire2_name?: string | null;
          updated_at?: string | null;
          venue?: string | null;
          weather_conditions?: string | null;
          wickets_per_innings?: number | null;
          win_margin?: number | null;
          win_margin_type?: string | null;
          winning_team_id?: string | null;
        };
        Update: {
          actual_end_time?: string | null;
          actual_start_time?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          current_ball?: number | null;
          current_innings?: number | null;
          current_over?: number | null;
          golden_ball?: boolean | null;
          id?: string;
          last_man_stands?: boolean | null;
          match_admins?: string[] | null;
          match_format?: string | null;
          overs_per_innings?: number | null;
          pitch_conditions?: string | null;
          player_of_the_match_id?: string | null;
          result_description?: string | null;
          result_type?: string | null;
          scheduled_at?: string | null;
          scorer_name?: string | null;
          season_id?: string | null;
          status?: string | null;
          team1_id?: string;
          team2_id?: string;
          third_umpire_name?: string | null;
          title?: string;
          toss_decision?: string | null;
          toss_winner_team_id?: string | null;
          tournament_id?: string | null;
          umpire1_name?: string | null;
          umpire2_name?: string | null;
          updated_at?: string | null;
          venue?: string | null;
          weather_conditions?: string | null;
          wickets_per_innings?: number | null;
          win_margin?: number | null;
          win_margin_type?: string | null;
          winning_team_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "matches_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_player_of_the_match_id_fkey";
            columns: ["player_of_the_match_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "club_seasons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_team1_id_fkey";
            columns: ["team1_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_team2_id_fkey";
            columns: ["team2_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_toss_winner_team_id_fkey";
            columns: ["toss_winner_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_winning_team_id_fkey";
            columns: ["winning_team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string | null;
          data: Json | null;
          id: string;
          is_read: boolean | null;
          message: string;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          is_read?: boolean | null;
          message: string;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          data?: Json | null;
          id?: string;
          is_read?: boolean | null;
          message?: string;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      partnerships: {
        Row: {
          balls: number | null;
          batsman1_id: string;
          batsman2_id: string;
          created_at: string | null;
          end_over: number | null;
          id: string;
          innings_id: string | null;
          is_current: boolean | null;
          match_id: string | null;
          runs: number | null;
          start_over: number | null;
          updated_at: string | null;
          wicket_number: number | null;
        };
        Insert: {
          balls?: number | null;
          batsman1_id: string;
          batsman2_id: string;
          created_at?: string | null;
          end_over?: number | null;
          id?: string;
          innings_id?: string | null;
          is_current?: boolean | null;
          match_id?: string | null;
          runs?: number | null;
          start_over?: number | null;
          updated_at?: string | null;
          wicket_number?: number | null;
        };
        Update: {
          balls?: number | null;
          batsman1_id?: string;
          batsman2_id?: string;
          created_at?: string | null;
          end_over?: number | null;
          id?: string;
          innings_id?: string | null;
          is_current?: boolean | null;
          match_id?: string | null;
          runs?: number | null;
          start_over?: number | null;
          updated_at?: string | null;
          wicket_number?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "partnerships_batsman1_id_fkey";
            columns: ["batsman1_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partnerships_batsman2_id_fkey";
            columns: ["batsman2_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partnerships_innings_id_fkey";
            columns: ["innings_id"];
            isOneToOne: false;
            referencedRelation: "innings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partnerships_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "partnerships_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      player_career_stats: {
        Row: {
          batting_average: number | null;
          best_bowling_figures: string | null;
          bowling_average: number | null;
          centuries: number | null;
          economy_rate: number | null;
          five_wicket_hauls: number | null;
          half_centuries: number | null;
          highest_score: number | null;
          id: string;
          last_updated: string | null;
          not_outs: number | null;
          strike_rate: number | null;
          total_balls_bowled: number | null;
          total_balls_faced: number | null;
          total_catches: number | null;
          total_fours: number | null;
          total_innings_batted: number | null;
          total_innings_bowled: number | null;
          total_matches: number | null;
          total_overs_bowled: number | null;
          total_run_outs: number | null;
          total_runs: number | null;
          total_runs_conceded: number | null;
          total_sixes: number | null;
          total_stumpings: number | null;
          total_wickets: number | null;
          user_id: string | null;
        };
        Insert: {
          batting_average?: number | null;
          best_bowling_figures?: string | null;
          bowling_average?: number | null;
          centuries?: number | null;
          economy_rate?: number | null;
          five_wicket_hauls?: number | null;
          half_centuries?: number | null;
          highest_score?: number | null;
          id?: string;
          last_updated?: string | null;
          not_outs?: number | null;
          strike_rate?: number | null;
          total_balls_bowled?: number | null;
          total_balls_faced?: number | null;
          total_catches?: number | null;
          total_fours?: number | null;
          total_innings_batted?: number | null;
          total_innings_bowled?: number | null;
          total_matches?: number | null;
          total_overs_bowled?: number | null;
          total_run_outs?: number | null;
          total_runs?: number | null;
          total_runs_conceded?: number | null;
          total_sixes?: number | null;
          total_stumpings?: number | null;
          total_wickets?: number | null;
          user_id?: string | null;
        };
        Update: {
          batting_average?: number | null;
          best_bowling_figures?: string | null;
          bowling_average?: number | null;
          centuries?: number | null;
          economy_rate?: number | null;
          five_wicket_hauls?: number | null;
          half_centuries?: number | null;
          highest_score?: number | null;
          id?: string;
          last_updated?: string | null;
          not_outs?: number | null;
          strike_rate?: number | null;
          total_balls_bowled?: number | null;
          total_balls_faced?: number | null;
          total_catches?: number | null;
          total_fours?: number | null;
          total_innings_batted?: number | null;
          total_innings_bowled?: number | null;
          total_matches?: number | null;
          total_overs_bowled?: number | null;
          total_run_outs?: number | null;
          total_runs?: number | null;
          total_runs_conceded?: number | null;
          total_sixes?: number | null;
          total_stumpings?: number | null;
          total_wickets?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "player_career_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      team_players: {
        Row: {
          added_by: string | null;
          batting_order: number | null;
          created_at: string | null;
          id: string;
          is_playing_xi: boolean | null;
          jersey_number: number | null;
          role_in_team: string | null;
          team_id: string | null;
          user_id: string | null;
        };
        Insert: {
          added_by?: string | null;
          batting_order?: number | null;
          created_at?: string | null;
          id?: string;
          is_playing_xi?: boolean | null;
          jersey_number?: number | null;
          role_in_team?: string | null;
          team_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          added_by?: string | null;
          batting_order?: number | null;
          created_at?: string | null;
          id?: string;
          is_playing_xi?: boolean | null;
          jersey_number?: number | null;
          role_in_team?: string | null;
          team_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "team_players_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_players_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_players_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          captain_id: string | null;
          club_id: string | null;
          created_at: string | null;
          created_by: string;
          description: string | null;
          id: string;
          is_template: boolean | null;
          logo_url: string | null;
          name: string;
          short_name: string | null;
          team_type: string | null;
          updated_at: string | null;
          vice_captain_id: string | null;
        };
        Insert: {
          captain_id?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          created_by: string;
          description?: string | null;
          id?: string;
          is_template?: boolean | null;
          logo_url?: string | null;
          name: string;
          short_name?: string | null;
          team_type?: string | null;
          updated_at?: string | null;
          vice_captain_id?: string | null;
        };
        Update: {
          captain_id?: string | null;
          club_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          description?: string | null;
          id?: string;
          is_template?: boolean | null;
          logo_url?: string | null;
          name?: string;
          short_name?: string | null;
          team_type?: string | null;
          updated_at?: string | null;
          vice_captain_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey";
            columns: ["captain_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_vice_captain_id_fkey";
            columns: ["vice_captain_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      tournament_registrations: {
        Row: {
          id: string;
          payment_status: string | null;
          registered_at: string | null;
          registered_by: string;
          registration_fee: number | null;
          status: string | null;
          team_id: string | null;
          tournament_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          payment_status?: string | null;
          registered_at?: string | null;
          registered_by: string;
          registration_fee?: number | null;
          status?: string | null;
          team_id?: string | null;
          tournament_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          payment_status?: string | null;
          registered_at?: string | null;
          registered_by?: string;
          registration_fee?: number | null;
          status?: string | null;
          team_id?: string | null;
          tournament_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_registered_by_fkey";
            columns: ["registered_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_registrations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      tournament_standings: {
        Row: {
          adjustment_reason: string | null;
          id: string;
          losses: number | null;
          matches_played: number | null;
          net_run_rate: number | null;
          no_results: number | null;
          overs_bowled: number | null;
          overs_faced: number | null;
          points: number | null;
          points_adjustment: number | null;
          qualification_status: string | null;
          runs_conceded: number | null;
          runs_scored: number | null;
          team_id: string | null;
          ties: number | null;
          tournament_id: string | null;
          updated_at: string | null;
          wins: number | null;
        };
        Insert: {
          adjustment_reason?: string | null;
          id?: string;
          losses?: number | null;
          matches_played?: number | null;
          net_run_rate?: number | null;
          no_results?: number | null;
          overs_bowled?: number | null;
          overs_faced?: number | null;
          points?: number | null;
          points_adjustment?: number | null;
          qualification_status?: string | null;
          runs_conceded?: number | null;
          runs_scored?: number | null;
          team_id?: string | null;
          ties?: number | null;
          tournament_id?: string | null;
          updated_at?: string | null;
          wins?: number | null;
        };
        Update: {
          adjustment_reason?: string | null;
          id?: string;
          losses?: number | null;
          matches_played?: number | null;
          net_run_rate?: number | null;
          no_results?: number | null;
          overs_bowled?: number | null;
          overs_faced?: number | null;
          points?: number | null;
          points_adjustment?: number | null;
          qualification_status?: string | null;
          runs_conceded?: number | null;
          runs_scored?: number | null;
          team_id?: string | null;
          ties?: number | null;
          tournament_id?: string | null;
          updated_at?: string | null;
          wins?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "tournament_standings_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournament_standings_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      tournaments: {
        Row: {
          club_id: string | null;
          created_at: string | null;
          created_by: string;
          custom_overs: number | null;
          description: string | null;
          end_date: string | null;
          entry_fee: number | null;
          golden_ball: boolean | null;
          id: string;
          last_man_stands: boolean | null;
          match_format: string | null;
          max_teams: number | null;
          name: string;
          prize_pool: number | null;
          registration_deadline: string | null;
          rules: string | null;
          season_id: string | null;
          start_date: string | null;
          status: string | null;
          tournament_format: string | null;
          updated_at: string | null;
          venue: string | null;
          wickets_per_innings: number | null;
        };
        Insert: {
          club_id?: string | null;
          created_at?: string | null;
          created_by: string;
          custom_overs?: number | null;
          description?: string | null;
          end_date?: string | null;
          entry_fee?: number | null;
          golden_ball?: boolean | null;
          id?: string;
          last_man_stands?: boolean | null;
          match_format?: string | null;
          max_teams?: number | null;
          name: string;
          prize_pool?: number | null;
          registration_deadline?: string | null;
          rules?: string | null;
          season_id?: string | null;
          start_date?: string | null;
          status?: string | null;
          tournament_format?: string | null;
          updated_at?: string | null;
          venue?: string | null;
          wickets_per_innings?: number | null;
        };
        Update: {
          club_id?: string | null;
          created_at?: string | null;
          created_by?: string;
          custom_overs?: number | null;
          description?: string | null;
          end_date?: string | null;
          entry_fee?: number | null;
          golden_ball?: boolean | null;
          id?: string;
          last_man_stands?: boolean | null;
          match_format?: string | null;
          max_teams?: number | null;
          name?: string;
          prize_pool?: number | null;
          registration_deadline?: string | null;
          rules?: string | null;
          season_id?: string | null;
          start_date?: string | null;
          status?: string | null;
          tournament_format?: string | null;
          updated_at?: string | null;
          venue?: string | null;
          wickets_per_innings?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "tournaments_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "club_seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      user_achievements: {
        Row: {
          achieved_at: string | null;
          achievement_data: Json | null;
          achievement_type: string;
          id: string;
          match_id: string | null;
          user_id: string | null;
        };
        Insert: {
          achieved_at?: string | null;
          achievement_data?: Json | null;
          achievement_type: string;
          id?: string;
          match_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          achieved_at?: string | null;
          achievement_data?: Json | null;
          achievement_type?: string;
          id?: string;
          match_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_achievements_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "user_achievements_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean | null;
          location: string | null;
          phone: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean | null;
          location?: string | null;
          phone?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean | null;
          location?: string | null;
          phone?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      live_match_state: {
        Row: {
          balls_remaining: number | null;
          batting_team_name: string | null;
          batting_team_short_name: string | null;
          bowler_balls: number | null;
          bowler_runs: number | null;
          bowler_wickets: number | null;
          bowling_team_name: string | null;
          bowling_team_short_name: string | null;
          current_ball: number | null;
          current_bowler_name: string | null;
          current_innings: number | null;
          current_over: number | null;
          current_run_rate: number | null;
          extras_total: number | null;
          innings_completed: boolean | null;
          innings_number: number | null;
          match_format: string | null;
          match_id: string | null;
          non_striker_balls: number | null;
          non_striker_name: string | null;
          non_striker_runs: number | null;
          overs_per_innings: number | null;
          partnership_balls: number | null;
          partnership_runs: number | null;
          required_run_rate: number | null;
          result_description: string | null;
          result_type: string | null;
          runs_needed: number | null;
          status: string | null;
          striker_balls: number | null;
          striker_name: string | null;
          striker_runs: number | null;
          target_runs: number | null;
          team1_name: string | null;
          team1_short_name: string | null;
          team2_name: string | null;
          team2_short_name: string | null;
          this_over_balls: string | null;
          title: string | null;
          total_balls: number | null;
          total_overs: number | null;
          total_runs: number | null;
          total_wickets: number | null;
          venue: string | null;
          winning_team_name: string | null;
        };
        Relationships: [];
      };
      match_over_summaries: {
        Row: {
          bowler_id: string | null;
          extras_off_bat_and_bowler: number | null;
          innings_id: string | null;
          legal_deliveries: number | null;
          match_id: string | null;
          no_balls: number | null;
          over_number: number | null;
          runs: number | null;
          wickets: number | null;
          wides: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ball_by_ball_innings_id_fkey";
            columns: ["innings_id"];
            isOneToOne: false;
            referencedRelation: "innings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ball_by_ball_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "live_match_state";
            referencedColumns: ["match_id"];
          },
          {
            foreignKeyName: "ball_by_ball_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _advance_after_innings: {
        Args: { p_completed_innings_id: string; p_match_id: string };
        Returns: undefined;
      };
      create_team_player: {
        Args: {
          p_full_name: string;
          p_jersey_number?: number;
          p_team_id: string;
        };
        Returns: Json;
      };
      end_innings: { Args: { p_match_id: string }; Returns: Json };
      ensure_own_profile: { Args: never; Returns: Json };
      is_club_admin: {
        Args: { p_club_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_club_member: {
        Args: { p_club_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_match_admin: {
        Args: { p_match_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_team_member: {
        Args: { p_team_id: string; p_user_id?: string };
        Returns: boolean;
      };
      match_events_insert: {
        Args: { p_event_data?: Json; p_event_type: string; p_match_id: string };
        Returns: undefined;
      };
      recalculate_tournament_standings: {
        Args: { p_tournament_id: string };
        Returns: undefined;
      };
      recompute_innings: { Args: { p_innings_id: string }; Returns: undefined };
      record_ball: {
        Args: {
          p_batsman_id: string;
          p_bowler_id: string;
          p_commentary?: string;
          p_dismissal_type?: string;
          p_extra_type?: string;
          p_extras?: number;
          p_fielder_id?: string;
          p_is_wicket?: boolean;
          p_match_id: string;
          p_non_striker_id: string;
          p_runs_scored?: number;
        };
        Returns: Json;
      };
      record_state: { Args: { p_match_id: string }; Returns: Json };
      set_current_batsmen: {
        Args: {
          p_match_id: string;
          p_non_striker_id: string;
          p_striker_id: string;
        };
        Returns: Json;
      };
      set_current_bowler: {
        Args: { p_bowler_id: string; p_match_id: string };
        Returns: Json;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      undo_last_ball: { Args: { p_match_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
