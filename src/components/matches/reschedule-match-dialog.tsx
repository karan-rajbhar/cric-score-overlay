"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { rescheduleMatch } from "~/app/matches/reschedule";
import { toLocalDateTimeInput } from "~/lib/local-datetime";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

export interface RescheduleMatch {
  id: string;
  scheduled_at?: string | null;
  venue?: string | null;
  umpire1_name?: string | null;
  umpire2_name?: string | null;
}

/**
 * Moves a match that has not started: date and time, venue, umpires. Pass
 * `open` / `onOpenChange` to open it from a menu item (render it outside
 * the menu), or let it render its own "Reschedule" button.
 */
export function RescheduleMatchDialog({
  match,
  open: controlledOpen,
  onOpenChange,
}: {
  match: RescheduleMatch;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const ids = {
    when: useId(),
    venue: useId(),
    umpire1: useId(),
    umpire2: useId(),
    error: useId(),
  };
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : uncontrolledOpen;
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState("");
  const [umpire1, setUmpire1] = useState("");
  const [umpire2, setUmpire2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setOpen = (next: boolean) => {
    if (pending) return;
    if (!controlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  // Each opening starts from the match as it is now.
  const [seenOpen, setSeenOpen] = useState(false);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setWhen(toLocalDateTimeInput(match.scheduled_at));
      setVenue(match.venue ?? "");
      setUmpire1(match.umpire1_name ?? "");
      setUmpire2(match.umpire2_name ?? "");
      setError(null);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!when) {
      setError("Pick a date and time");
      return;
    }
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof rescheduleMatch>>;
      try {
        res = await rescheduleMatch(match.id, {
          scheduledAt: new Date(when).toISOString(),
          venue,
          umpire1Name: umpire1,
          umpire2Name: umpire2,
        });
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Match rescheduled");
      if (!controlled) setUncontrolledOpen(false);
      onOpenChange?.(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 gap-1.5">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            Reschedule
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader className="text-left">
            <DialogTitle className="text-balance">Reschedule match</DialogTitle>
            <DialogDescription>
              Change when and where it is played, before it starts.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor={ids.when}>Date and time</Label>
            <Input
              id={ids.when}
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1.5"
              required
              aria-describedby={error ? ids.error : undefined}
            />
          </div>
          <div>
            <Label htmlFor={ids.venue}>Venue</Label>
            <Input
              id={ids.venue}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. Central Park ground"
              className="mt-1.5"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={ids.umpire1}>Umpire 1</Label>
              <Input
                id={ids.umpire1}
                value={umpire1}
                onChange={(e) => setUmpire1(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor={ids.umpire2}>Umpire 2</Label>
              <Input
                id={ids.umpire2}
                value={umpire2}
                onChange={(e) => setUmpire2(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          {error && (
            <p id={ids.error} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
