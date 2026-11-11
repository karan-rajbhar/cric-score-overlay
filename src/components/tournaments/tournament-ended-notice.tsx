"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeTournament } from "~/app/tournaments/actions";
import { Button } from "~/components/ui/button";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

/**
 * For the organiser of a tournament past its end date but never closed
 * (T12): say so, and close it in one tap. Its dates can still be changed
 * in Manage instead.
 */
export function TournamentEndedNotice({
  tournamentId,
  endDate,
}: {
  tournamentId: string;
  /** "30 Aug 2024". */
  endDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const close = () =>
    startTransition(async () => {
      try {
        const res = await completeTournament(tournamentId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        router.refresh();
      } catch {
        toast.error(NETWORK_ERROR_MESSAGE);
      }
    });
  return (
    <div
      role="status"
      className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-foreground">
        Its end date, {endDate}, has passed. Mark it completed to close it, or
        change its dates in Manage.
      </p>
      <Button
        type="button"
        onClick={close}
        disabled={pending}
        className="shrink-0"
      >
        {pending ? "Closing…" : "Mark completed"}
      </Button>
    </div>
  );
}
