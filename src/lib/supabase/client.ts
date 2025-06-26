/**
 * CLIENT-SIDE SUPABASE UTILITIES
 * 
 * These utilities are safe to use in client components.
 * They only use public environment variables and browser-safe APIs.
 */

import 'client-only'; // This ensures this file is never used server-side
import { createBrowserClient } from "@supabase/ssr";
import { env } from "~/env.js";

/**
 * Creates a Supabase client for use in client components
 * 
 * @returns Supabase client instance
 */
export const createClient = () => {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Legacy client for backward compatibility
 * @deprecated Use createClient() instead for better error handling
 */
export const supabase = createClient(); 