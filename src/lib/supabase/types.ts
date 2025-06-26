/**
 * SUPABASE TYPE DEFINITIONS
 * 
 * This file contains type definitions for Supabase.
 * These types are safe to import in both client and server code.
 */

import type { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js';

/**
 * Database type definition
 * 
 * Update this interface to match your Supabase database schema.
 * You can generate this automatically using the Supabase CLI:
 * `supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public`
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          team1: string;
          team2: string;
          status: 'upcoming' | 'live' | 'completed';
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team1: string;
          team2: string;
          status?: 'upcoming' | 'live' | 'completed';
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team1?: string;
          team2?: string;
          status?: 'upcoming' | 'live' | 'completed';
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      // Add your database views here
    };
    Functions: {
      // Add your database functions here
    };
    Enums: {
      // Add your database enums here
    };
  };
}

/**
 * Typed Supabase client
 */
export type SupabaseClient = BaseSupabaseClient<Database>;

/**
 * User type from Supabase auth
 */
export type { User } from '@supabase/supabase-js'; 