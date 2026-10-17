"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailPlus } from "lucide-react";
import type { SentInvite } from "~/app/invitations/data";
import { revokeInvite } from "~/app/invitations/actions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { InviteShare, inviteMessage } from "~/components/invite-share";

const STATUS_LABEL: Record<SentInvite["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InviteRow({
  invite,
  inviterName,
}: {
  invite: SentInvite;
  inviterName?: string;
}) {
  const router = useRouter();
  const [showMessage, setShowMessage] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const firstMatch = invite.scorer_matches[0]?.id;

  const handleRevoke = () => {
    setError(null);
    startTransition(async () => {
      const res = await revokeInvite(invite.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      setShowMessage(false);
      router.refresh();
    });
  };

  return (
    <li className="space-y-3 p-4 [content-visibility:auto] [contain-intrinsic-size:auto_96px]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {invite.email}
          </p>
          <p className="text-xs text-muted-foreground">
            Invited {formatDate(invite.created_at)}
            {invite.status === "accepted" && invite.accepted_by && (
              <>
                {" · Joined as "}
                <Link
                  href={`/players/${invite.accepted_by.username ? `@${invite.accepted_by.username}` : invite.accepted_by.id}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {invite.accepted_by.full_name ?? "their profile"}
                </Link>
              </>
            )}
            {invite.status === "revoked" &&
              ` · Revoked ${formatDate(invite.updated_at)}`}
          </p>
          {invite.scorer_matches.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Scorer for{" "}
              {invite.scorer_matches.map((m, i) => (
                <span key={m.id}>
                  {i > 0 && ", "}
                  <Link
                    href={`/matches/${m.id}`}
                    className="text-foreground underline-offset-2 hover:underline"
                  >
                    {m.title ?? "a deleted match"}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
        <Badge
          variant={invite.status === "pending" ? "secondary" : "outline"}
          className="w-fit shrink-0"
        >
          {STATUS_LABEL[invite.status] ?? invite.status}
        </Badge>
      </div>

      {invite.status === "pending" && (
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
                onClick={handleRevoke}
              >
                {pending ? "Revoking…" : "Confirm revoke"}
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
              Revoke
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {invite.status === "pending" && showMessage && (
        <InviteShare
          id={`invite-message-${invite.id}`}
          text={inviteMessage(inviterName, invite.email, firstMatch)}
        />
      )}
    </li>
  );
}

/** Invites the signed-in user sent, with resend and revoke for pending ones. */
export function SentInvitesList({
  invites,
  inviterName,
}: {
  invites: SentInvite[];
  inviterName?: string;
}) {
  if (invites.length === 0) {
    return (
      <EmptyState
        icon={MailPlus}
        title="No invites yet"
        description="Invite a teammate or co-scorer. They sign in with the Google account for the email you enter."
      />
    );
  }
  return (
    <ul
      aria-label="Invites you sent"
      className="divide-y divide-border rounded-xl border border-border bg-card"
    >
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} inviterName={inviterName} />
      ))}
    </ul>
  );
}
