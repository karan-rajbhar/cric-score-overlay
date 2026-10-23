"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { InviteShare, clubInviteMessage } from "~/components/invite-share";
import { revokeClubInvite } from "~/app/clubs/actions";
import { useAuth } from "~/lib/auth";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

export interface PendingClubInvite {
  id: string;
  email: string;
  created_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function InviteRow({
  invite,
  club,
}: {
  invite: PendingClubInvite;
  club: { id: string; name: string };
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [showMessage, setShowMessage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inviter =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : undefined;

  const withdraw = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await revokeClubInvite(club.id, invite.id);
        if (res.error) {
          setError(res.error);
          return;
        }
        router.refresh();
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
      }
    });
  };

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {invite.email}
          </p>
          <p className="text-xs text-muted-foreground">
            Invited {formatDate(invite.created_at)}, not signed in yet
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={showMessage}
            onClick={() => setShowMessage((v) => !v)}
          >
            {showMessage ? "Hide message" : "Send message again"}
          </Button>
          {confirming ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={withdraw}
              >
                {pending ? "Withdrawing…" : "Confirm withdraw"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Keep invite
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              Withdraw
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {showMessage && (
        <InviteShare
          id={`club-invite-${invite.id}`}
          text={clubInviteMessage(inviter, invite.email, club)}
        />
      )}
    </li>
  );
}

/** A club's invites still waiting for a first sign-in (admins only). */
export function ClubPendingInvites({
  invites,
  club,
}: {
  invites: PendingClubInvite[];
  club: { id: string; name: string };
}) {
  if (invites.length === 0) return null;
  return (
    <section aria-labelledby="club-pending-invites" className="space-y-2">
      <h3
        id="club-pending-invites"
        className="px-1 text-base font-semibold text-foreground"
      >
        Invited, not signed in yet
      </h3>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {invites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} club={club} />
        ))}
      </ul>
    </section>
  );
}
