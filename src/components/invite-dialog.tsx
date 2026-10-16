"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { inviteToApp } from "~/app/invitations/actions";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { InviteShare, inviteMessage } from "~/components/invite-share";

/**
 * CricScore is invite-only; any signed-in user can invite an email. No email
 * is sent: the inviter shares the generated message (e.g. on WhatsApp).
 * Pass `trigger` for a custom button, or `open`/`onOpenChange` to control it
 * from a menu item (render it outside the menu so closing the menu does not
 * unmount it).
 */
export function InviteDialog({
  className,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  className?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [shareText, setShareText] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setShareText(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    reset();
    const res = await inviteToApp(email);
    setPending(false);
    if ("error" in res) {
      setResult({ ok: false, text: res.error ?? "Could not save invite" });
      return;
    }
    setResult({ ok: true, text: res.message });
    if (res.shareEmail) {
      const name =
        typeof user?.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined;
      setShareText(inviteMessage(name, res.shareEmail));
      setEmail("");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!controlled) setUncontrolledOpen(next);
        onOpenChange?.(next);
        if (!next) reset();
      }}
    >
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline" className={className}>
              <UserPlus className="h-4 w-4 shrink-0" />
              Invite
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">Invite someone</DialogTitle>
          <DialogDescription>
            They sign in with the Google account for this email. You send them
            the invite message yourself.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Google email</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              autoComplete="off"
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
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Create invite"}
          </Button>
        </form>
        {shareText && <InviteShare text={shareText} />}
      </DialogContent>
    </Dialog>
  );
}
