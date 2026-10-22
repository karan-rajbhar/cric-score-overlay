"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarClock,
  CloudRain,
  MoreHorizontal,
  Trash2,
  Tv,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAuth } from "~/lib/auth";
import {
  useCanDeleteMatchQuery,
  useMatchAdminQuery,
} from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { DeleteMatchDialog } from "./delete-match-dialog";
import { RescheduleMatchDialog } from "./reschedule-match-dialog";

const DlsCalculatorModal = dynamic(
  () => import("./dls-calculator-modal").then((m) => m.DlsCalculatorModal),
  { ssr: false },
);

interface MatchMoreMenuProps {
  match: {
    id: string;
    title: string | null;
    status?: string;
    overs_per_innings?: number | null;
    tournament_id?: string | null;
    club_id?: string | null;
    scheduled_at?: string | null;
    venue?: string | null;
    umpire1_name?: string | null;
    umpire2_name?: string | null;
  };
  /** The full match, for the DLS calculator's defaults (live matches). */
  dlsMatch?: Match;
  /** Whether the DLS calculator may set the target (scorers). */
  canEditDls?: boolean;
  className?: string;
}

/**
 * The match page's "More" menu: the tools few people need (the OBS overlay,
 * the DLS calculator while live) and, for its organisers (who may delete
 * it), Reschedule before the start and Delete match.
 */
export function MatchMoreMenu({
  match,
  dlsMatch,
  canEditDls = false,
  className,
}: MatchMoreMenuProps) {
  const { user } = useAuth();
  // Everyone who may delete is also a match admin; ask the stricter
  // question only then (viewers pay no extra reads).
  const { data: isAdmin } = useMatchAdminQuery(match.id, user?.id);
  const { data: canDelete } = useCanDeleteMatchQuery(
    match.id,
    user?.id,
    isAdmin === true,
  );
  const [showDelete, setShowDelete] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const canReschedule = canDelete === true && match.status === "scheduled";
  const [showDls, setShowDls] = useState(false);
  const dls =
    dlsMatch &&
    dlsMatch.status === "live" &&
    (dlsMatch.overs_per_innings ?? 0) > 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={className ?? "h-8 w-8 p-0"}
            aria-label="More match actions"
            title="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <a
              href={`/overlay/${match.id}`}
              target="_blank"
              rel="noopener"
              className="flex cursor-pointer items-center gap-2"
            >
              <Tv className="h-4 w-4" />
              <span>OBS overlay</span>
            </a>
          </DropdownMenuItem>
          {dls && (
            <DropdownMenuItem
              onSelect={() => setShowDls(true)}
              className="flex cursor-pointer items-center gap-2"
            >
              <CloudRain className="h-4 w-4" />
              <span>DLS calculator</span>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              {canReschedule && (
                <DropdownMenuItem
                  onSelect={() => setShowReschedule(true)}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <CalendarClock className="h-4 w-4" />
                  <span>Reschedule</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => setShowDelete(true)}
                className="flex cursor-pointer items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete match</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteMatchDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        match={match}
      />
      {canReschedule && (
        <RescheduleMatchDialog
          open={showReschedule}
          onOpenChange={setShowReschedule}
          match={match}
        />
      )}
      {dls && showDls && (
        <DlsCalculatorModal
          match={dlsMatch}
          canEdit={canEditDls}
          open={showDls}
          onOpenChange={setShowDls}
        />
      )}
    </>
  );
}
