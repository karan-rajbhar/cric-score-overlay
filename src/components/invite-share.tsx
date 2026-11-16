"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cardDate, timeOfDay } from "~/lib/dates";

/**
 * Sign-in link for an invite. Keeps `@` readable while still escaping `+`;
 * `next` sends them somewhere specific after signing in.
 */
export function inviteLink(email: string, next?: string): string {
  const param = encodeURIComponent(email).replace("%40", "@");
  const after = next ? `&next=${encodeURIComponent(next)}` : "";
  return `${window.location.origin}/auth/login?invite=${param}${after}`;
}

/** The match a scorer is invited to, as the message names it. */
export interface InviteMatch {
  id: string;
  title?: string | null;
  scheduled_at?: string | null;
  venue?: string | null;
}

/** "Sun 22 Nov, 10:00 · Kamothe ground": when and where, if known. */
export function inviteMatchWhen(match: InviteMatch): string {
  const day = cardDate(match.scheduled_at);
  const time = timeOfDay(match.scheduled_at);
  return [day && time ? `${day}, ${time}` : day, match.venue?.trim()]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The sign-in message for an app invite; for a scorer, it names the match
 * (its title, day, time and ground), so the message says what it is for.
 */
export function inviteMessage(
  inviter: string | undefined,
  email: string,
  scoreMatch?: string | InviteMatch,
): string {
  const who = inviter?.trim() || "Someone";
  const match =
    typeof scoreMatch === "string" ? { id: scoreMatch } : scoreMatch;
  const title = match?.title?.trim();
  const what = match
    ? title
      ? `to help score ${title} on CricScore`
      : "to help score a match on CricScore"
    : "to CricScore";
  const when = match ? inviteMatchWhen(match) : "";
  const next = match ? `/matches/${match.id}/score` : undefined;
  return (
    `${who} invited you ${what}\n` +
    (when ? `${when}\n` : "") +
    `Open ${inviteLink(email, next)} and sign in with Google using ${email}.`
  );
}

/** The sign-in message for a club invite: they land on the club's page. */
export function clubInviteMessage(
  inviter: string | undefined,
  email: string,
  club: { id: string; name: string },
): string {
  const who = inviter?.trim() || "Someone";
  return (
    `${who} invited you to join ${club.name} on CricScore\n` +
    `Open ${inviteLink(email, `/clubs/${club.id}`)} and sign in with Google using ${email}.`
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
        className="resize-none"
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
