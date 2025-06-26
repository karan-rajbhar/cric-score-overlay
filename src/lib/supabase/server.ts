/**
 * SERVER-SIDE SUPABASE UTILITIES
 * 
 * These utilities can only be used in server components, API routes, and server actions.
 * They have access to server-side environment variables and cookies.
 */

import 'server-only'; // This ensures this file is never bundled client-side
import { createServerClient as createSupabaseServerClient, createBrowserClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "~/env.js";

/**
 * Creates a Supabase client with cookie management for server components
 * 
 * @returns Supabase server client with cookie handling
 */
export const createServerClient = () => {
  const cookieStore = cookies();

  return createSupabaseServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};

/**
 * Admin client with service role key (server-side only)
 * 
 * WARNING: This bypasses Row Level Security. Use with extreme caution.
 * Only use when you need full database access for admin operations.
 * 
 * @returns Supabase admin client
 */
export const createAdminClient = () => {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
};

/**
 * Legacy export for backward compatibility
 * @deprecated Use createServerClient() instead
 */
export const createServerSupabaseClient = createServerClient;

/**
 * Legacy export for backward compatibility
 * @deprecated Use createAdminClient() instead
 */
export const supabaseAdmin = createAdminClient(); 