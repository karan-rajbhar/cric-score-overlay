"use client";

import { useEffect, useState } from "react";
import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/firebase/client";
import { getTotalPendingCount } from "~/lib/offline-queue";

/** Usernames already read this session (the header and the menu share one read). */
const usernames = new Map<string, string>();

/** The signed-in user's @username (from their profile; the token may lack it). */
export function useUsername(): string | null {
  const { user } = useAuth();
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id || usernames.has(user.id)) return;
    let mounted = true;
    void createClient()
      .from("users")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.username) return;
        usernames.set(user.id, data.username);
        if (mounted) setFetched(data.username);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  if (!user) return null;
  return (
    usernames.get(user.id) ??
    fetched ??
    (user.user_metadata?.username as string | undefined) ??
    null
  );
}

/**
 * Sign out, after a warning when scoring actions have not reached the
 * server (they stay on the device).
 */
export function useSignOut(): {
  signOut: () => Promise<void>;
  pending: boolean;
} {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const run = async () => {
    if (pending) return;
    const unsent = getTotalPendingCount();
    if (
      unsent > 0 &&
      !window.confirm(
        `${unsent} scoring ${unsent === 1 ? "change has" : "changes have"} not reached the server yet. Reconnect and open the match to send ${unsent === 1 ? "it" : "them"} first. Sign out anyway? ${unsent === 1 ? "It stays" : "They stay"} on this device.`,
      )
    ) {
      return;
    }
    try {
      setPending(true);
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      window.location.reload();
    }
  };
  return { signOut: run, pending };
}
