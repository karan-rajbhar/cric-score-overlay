"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import type { FollowKind } from "~/lib/follows/store";
import { useFollow } from "~/lib/follows/use-follows";
import { usePush } from "~/lib/push/use-push";
import { IOS_PUSH_NOTE, PUSH_EXPLANATION } from "./copy";

/** What following shows the user, by kind. */
const FOLLOW_NOTE: Record<FollowKind, string> = {
  team: "Their matches show under Following on your home screen.",
  player: "Their teams' matches show under Following on your home screen.",
  match: "It shows under Following on your home screen.",
  tournament: "Its matches show under Following on your home screen.",
};

/**
 * Follow / Following for a team, player, match or tournament. Signed out it
 * links to sign in. After following it offers notifications once, where
 * this device supports them.
 */
export function FollowButton({
  kind,
  id,
  name,
}: {
  kind: FollowKind;
  id: string;
  /** "Metropolitan Strikers": for the button's label and the toast. */
  name: string;
}) {
  const pathname = usePathname();
  const { signedIn, loading, following, pending, toggle } = useFollow(kind, id);
  const push = usePush();

  if (!signedIn) {
    return (
      <Button variant="outline" size="sm" asChild className="gap-1.5">
        <Link href={`/auth/login?redirect=${encodeURIComponent(pathname ?? "/")}`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Follow
        </Link>
      </Button>
    );
  }

  const offerPush = () => {
    if (push.availability === "available" && push.enabled === false) {
      return {
        description: `${FOLLOW_NOTE[kind]} ${PUSH_EXPLANATION}`,
        action: {
          label: "Turn on",
          onClick: () => {
            void push.enable().then((res) => {
              if (res.ok) toast.success("Notifications are on");
              else if (res.error) toast.error(res.error);
            });
          },
        },
      };
    }
    if (push.availability === "needs-install") {
      return { description: `${FOLLOW_NOTE[kind]} ${IOS_PUSH_NOTE}` };
    }
    return { description: FOLLOW_NOTE[kind] };
  };

  const onClick = async () => {
    const res = await toggle();
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.following) toast.success(`Following ${name}`, offerPush());
    else toast.success(`Stopped following ${name}`);
  };

  return (
    <Button
      variant={following ? "secondary" : "outline"}
      size="sm"
      className="gap-1.5"
      aria-pressed={following}
      aria-label={following ? `Following ${name}` : `Follow ${name}`}
      disabled={loading || pending}
      onClick={() => void onClick()}
    >
      {following ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Plus className="h-4 w-4" aria-hidden="true" />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
