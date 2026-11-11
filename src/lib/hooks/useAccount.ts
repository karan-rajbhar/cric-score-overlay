"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useConfirm } from "~/components/ui/confirm-dialog";
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
 * server (they stay on the device). The warning is the app's own dialog
 * (N37): render `dialog` where the sign-out button is.
 */
export function useSignOut(): {
  signOut: () => Promise<void>;
  pending: boolean;
  dialog: ReactNode;
} {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [ask, dialog] = useConfirm();
  const run = async () => {
    if (pending) return;
    const unsent = getTotalPendingCount();
    if (unsent > 0) {
      // After a menu that held the button has let go of the focus.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const one = unsent === 1;
      const ok = await ask({
        title: `${unsent} scoring ${one ? "change has" : "changes have"} not been sent`,
        description: `${one ? "It stays" : "They stay"} on this device. Reconnect and open the match to send ${one ? "it" : "them"} before you sign out.`,
        cancelLabel: "Stay signed in",
        confirmLabel: "Sign out anyway",
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      setPending(true);
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      window.location.reload();
    }
  };
  return { signOut: run, pending, dialog };
}
