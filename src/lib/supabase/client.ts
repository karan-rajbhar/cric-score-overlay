/**
 * CLIENT-SIDE SUPABASE UTILITIES
 *
 * These utilities are safe to use in client components.
 * They only use public environment variables and browser-safe APIs.
 */

import "client-only"; // This ensures this file is never used server-side
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";
import { env } from "~/env.js";

let clientInstance:
  | ReturnType<typeof createBrowserClient<Database>>
  | undefined;

/**
 * Resolves the Supabase URL for client components.
 * On local desktop (localhost/127.0.0.1), uses direct Supabase URL.
 * When accessed from mobile devices, tunnels, or LAN IPs, routes through
 * Next.js reverse proxy (/api/supabase) to avoid mixed-content (HTTPS->HTTP)
 * and unreachable 127.0.0.1 errors on mobile devices.
 */
function getClientSupabaseUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${window.location.origin}/api/supabase`;
    }
  }
  return env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Creates a Supabase client for use in client components
 *
 * @returns Supabase client instance
 */
export const createClient = () => {
  const supabaseUrl = getClientSupabaseUrl();

  if (typeof window === "undefined") {
    return createBrowserClient<Database>(
      supabaseUrl,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(
      supabaseUrl,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  return clientInstance;
};

/**
 * Legacy client for backward compatibility
 * Proxied dynamically to always use the active browser client
 * @deprecated Use createClient() instead for better error handling
 */
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const client = createClient();
    return (client as unknown as Record<string, unknown>)[prop as string];
  },
});
