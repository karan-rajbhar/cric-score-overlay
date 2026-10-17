"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { deleteMatch } from "~/app/matches/mutations";
import {
  afterDeleteHref,
  confirmsMatchDelete,
  deleteConfirmName,
} from "~/lib/match-delete";

export interface DeleteMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: {
    id: string;
    title: string | null;
    tournament_id?: string | null;
    club_id?: string | null;
  };
}

/**
 * Confirmation for deleting a match: the user types the match name, then
 * the server action deletes it and we leave for the parent list.
 */
export function DeleteMatchDialog({
  open,
  onOpenChange,
  match,
}: DeleteMatchDialogProps) {
  const router = useRouter();
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const name = deleteConfirmName(match.title);
  const confirmed = confirmsMatchDelete(typed, match.title);

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setTyped("");
      setError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteMatch(match.id, typed);
      if (!res.success) {
        setError(res.error ?? "Could not delete the match");
        return;
      }
      toast.success("Match deleted");
      onOpenChange(false);
      router.replace(res.redirectTo ?? afterDeleteHref(match));
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-balance text-lg font-semibold">
              Delete match
            </DialogTitle>
            <DialogDescription>
              Deletes this match, its scorecard and ball-by-ball log, and
              removes it from players&apos; stats, leaderboards and standings.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor={inputId} className="text-sm font-medium">
              Type the match name to confirm
            </Label>
            <p className="break-words rounded-md bg-muted px-2.5 py-1.5 text-sm font-medium">
              {name}
            </p>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${inputId}-error` : undefined}
            />
            {error && (
              <p
                id={`${inputId}-error`}
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!confirmed || pending}
            >
              {pending ? "Deleting..." : "Delete match"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
