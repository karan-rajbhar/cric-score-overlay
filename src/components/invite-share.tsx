"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

/**
 * Sign-in link for an invite. Keeps `@` readable while still escaping `+`;
 * `next` sends them somewhere specific after signing in.
 */
export function inviteLink(email: string, next?: string): string {
  const param = encodeURIComponent(email).replace("%40", "@");
  const after = next ? `&next=${encodeURIComponent(next)}` : "";
  return `${window.location.origin}/auth/login?invite=${param}${after}`;
}

export function inviteMessage(
  inviter: string | undefined,
  email: string,
  scoreMatchId?: string,
): string {
  const who = inviter?.trim() || "Someone";
  const what = scoreMatchId
    ? "to help score a match on CricScore 🏏"
    : "to CricScore 🏏";
  const next = scoreMatchId ? `/matches/${scoreMatchId}/score` : undefined;
  return (
    `${who} invited you ${what}\n` +
    `Open ${inviteLink(email, next)} and sign in with Google using ${email}.`
  );
}

/** Read-only invite message with Share on WhatsApp and Copy actions. */
export function InviteShare({
  text,
  id = "invite-message",
}: {
  text: string;
  /** Textarea id; pass a unique one when several are on the page. */
  id?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <Label htmlFor={id}>Invite message</Label>
      <Textarea
        id={id}
        readOnly
        rows={4}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        className="resize-none text-sm"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="flex-1 gap-1.5">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            Share on WhatsApp
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleCopy}
          className="flex-1 gap-1.5"
        >
          {copied ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <Copy className="h-4 w-4 shrink-0" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {copyFailed && (
        <p role="status" className="text-sm text-destructive">
          Copy failed. Select the text instead.
        </p>
      )}
    </div>
  );
}
