"use client";

import React, { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { inviteClubMember } from "~/app/clubs/actions";
import { InviteShare, clubInviteMessage } from "~/components/invite-share";
import { useAuth } from "~/lib/auth";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

interface InviteMemberDialogProps {
  clubId: string;
  clubName: string;
}

/**
 * Invites someone to the club by their Google email. No email is sent: the
 * admin shares the sign-in message (WhatsApp or copy). Someone already on
 * CricScore joins straight away; anyone else becomes a member when they
 * first sign in with that email.
 */
export function InviteMemberDialog({ clubId, clubName }: InviteMemberDialogProps) {
  const { user } = useAuth();
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [shareText, setShareText] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setShareText(null);
    setPending(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setPending(true);
    let res: Awaited<ReturnType<typeof inviteClubMember>>;
    try {
      res = await inviteClubMember(clubId, email);
    } catch {
      setResult({ ok: false, text: NETWORK_ERROR_MESSAGE });
      return;
    } finally {
      setPending(false);
    }
    if ("error" in res) {
      setResult({ ok: false, text: res.error });
      return;
    }
    setResult({ ok: true, text: res.message });
    if (res.shareEmail) {
      const name =
        typeof user?.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined;
      setShareText(
        clubInviteMessage(name, res.shareEmail, { id: clubId, name: clubName }),
      );
    }
    setEmail("");
    // The members list and the pending invites change.
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-1.5">
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">Invite to {clubName}</DialogTitle>
          <DialogDescription>
            They sign in with the Google account for this email and join the
            club as a member. You send them the invite message yourself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={inputId}>Google email</Label>
            <Input
              id={inputId}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
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
          <Button
            type="submit"
            disabled={pending || !email.trim()}
            className="w-full"
          >
            {pending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {pending ? "Saving…" : "Create invite"}
          </Button>
        </form>
        {shareText && <InviteShare id={`${inputId}-message`} text={shareText} />}
      </DialogContent>
    </Dialog>
  );
}
