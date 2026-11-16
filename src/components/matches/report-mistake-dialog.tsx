"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "~/components/ds/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getMatchScorers } from "~/app/matches/mutations";

/** "Karan and Ravi", "Karan, Ravi and Amol". */
export function namesList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The message a member sends the scorers: what is wrong, and where. */
export function mistakeMessage(title: string, url: string): string {
  return `Something looks wrong in the scorecard of ${title} on CricScore: `
    + `(say which ball or player) ${url}`;
}

/**
 * "Something wrong?" on a finished match, for those who cannot correct it:
 * only its scorers can (Fix a mistake), so it names them and gives a
 * WhatsApp message with the scorecard's link to send them. Their contact
 * details stay private: the scorer is picked in WhatsApp. The scorers are
 * read when it opens.
 */
export function ReportMistakeDialog({
  open,
  onOpenChange,
  match,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: { id: string; title: string | null };
}) {
  const [scorers, setScorers] = useState<string[] | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    getMatchScorers(match.id)
      .then((res) => {
        if (!live) return;
        const people = res.data
          ? [res.data.createdBy, ...res.data.matchAdmins]
              .filter((u): u is NonNullable<typeof u> => Boolean(u))
              .map((u) => u.full_name)
          : [];
        setScorers(people);
      })
      .catch(() => {
        if (live) setScorers([]);
      });
    return () => {
      live = false;
    };
  }, [open, match.id]);

  const title = match.title ?? "this match";
  const url =
    typeof window === "undefined"
      ? `/matches/${match.id}?tab=scorecard`
      : `${window.location.origin}/matches/${match.id}?tab=scorecard`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">Something wrong?</DialogTitle>
          <DialogDescription>
            {scorers === null
              ? "Only this match's scorers can correct its scorecard."
              : scorers.length > 0
                ? `Only this match's scorers can correct its scorecard: ${namesList(scorers)}. Tell them what is wrong and they can fix it, figures and statistics included.`
                : "Only this match's scorers can correct its scorecard. Tell them what is wrong and they can fix it, figures and statistics included."}
          </DialogDescription>
        </DialogHeader>
        <Button asChild className="w-full">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(mistakeMessage(title, url))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            Message a scorer on WhatsApp
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
