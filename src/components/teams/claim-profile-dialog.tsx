"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { InviteShare, inviteLink } from "~/components/invite-share";
import { setPlayerClaimEmail } from "~/app/teams/actions";
import { useAuth } from "~/lib/auth";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

/** The sign-in message for someone claiming their player profile. */
export function claimMessage(
  inviter: string | undefined,
  email: string,
  team: { id: string; name: string },
): string {
  const who = inviter?.trim() || "Someone";
  return (
    `${who} added you to ${team.name} on CricScore\n` +
    `Open ${inviteLink(email, `/teams/${team.id}?tab=squad`)} and sign in with Google using ${email}: your player profile and its matches become yours.`
  );
}

/**
 * "Invite to claim": the admin enters a squad player's real Google email.
 * When that person signs in with it, this profile (and every match it has
 * played) becomes their account. No email is sent: the admin shares the
 * message. With `invitedAs` (a masked address) the admin can change the
 * email or remove it.
 */
export function ClaimProfileDialog({
  open,
  onOpenChange,
  team,
  player,
  invitedAs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: { id: string; name: string };
  player: { id: string; name: string };
  /** Masked address of a pending invite ("k…@gmail.com"). */
  invitedAs?: string | null;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [shareText, setShareText] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setBusy(null);
    setResult(null);
    setShareText(null);
  };

  const send = async (value: string | null) => {
    setBusy(value === null ? "remove" : "save");
    setResult(null);
    setShareText(null);
    let res: Awaited<ReturnType<typeof setPlayerClaimEmail>>;
    try {
      res = await setPlayerClaimEmail(team.id, player.id, value);
    } catch {
      setResult({ ok: false, text: NETWORK_ERROR_MESSAGE });
      return;
    } finally {
      setBusy(null);
    }
    if (res.error !== null) {
      setResult({ ok: false, text: res.error });
      return;
    }
    if (res.shareEmail) {
      const name =
        typeof user?.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined;
      setResult({
        ok: true,
        text: `Saved. ${player.name} can now sign in with it. Send them the message below.`,
      });
      setShareText(claimMessage(name, res.shareEmail, team));
      setEmail("");
    } else {
      setResult({ ok: true, text: "Email removed. Nobody can claim the profile now." });
    }
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle className="text-balance">
            Invite {player.name} to claim this profile
          </DialogTitle>
          <DialogDescription>
            When they sign in with Google using this email, the profile and
            every match it has played become theirs. No email is sent: you
            share the message yourself.
          </DialogDescription>
        </DialogHeader>
        {invitedAs && (
          <p className="text-sm text-muted-foreground">
            Invite sent to {invitedAs}, not signed in yet. Enter an email to
            change it, or remove it.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) void send(email);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor={inputId}>Their Google email</Label>
            <Input
              id={inputId}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {result && (
            <p
              role="status"
              className={
                result.ok
                  ? "text-sm text-muted-foreground"
                  : "text-sm text-destructive"
              }
            >
              {result.text}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Button
              type="submit"
              disabled={busy !== null || !email.trim()}
              className="sm:flex-1"
            >
              {busy === "save" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {invitedAs ? "Change email" : "Save and get the message"}
            </Button>
            {invitedAs && (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void send(null)}
                className="text-destructive sm:flex-1"
              >
                {busy === "remove" && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Remove email
              </Button>
            )}
          </div>
        </form>
        {shareText && (
          <InviteShare id={`${inputId}-message`} text={shareText} />
        )}
      </DialogContent>
    </Dialog>
  );
}
