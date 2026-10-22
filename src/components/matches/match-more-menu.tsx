"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CloudRain, FileJson, MoreHorizontal, Trash2, Tv } from "lucide-react";
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
  };
  /**
   * The full match: the DLS calculator's defaults (live matches), the
   * ball-by-ball download (finished ones).
   */
  dlsMatch?: Match;
  /** Whether the DLS calculator may set the target (scorers). */
  canEditDls?: boolean;
  className?: string;
}

/**
 * The match page's "More" menu: the tools few people need (the OBS overlay,
 * the DLS calculator while live, a finished match's ball-by-ball data)
 * and, for those who may, Delete match.
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
          {dlsMatch && dlsMatch.status === "completed" && (
            <DropdownMenuItem
              // Loaded on demand: the Cricsheet builder and the export
              // query are needed by few.
              onSelect={() =>
                void import("./cricsheet-export").then((m) =>
                  m.exportCricsheet(dlsMatch),
                )
              }
              className="flex cursor-pointer items-center gap-2"
            >
              <FileJson className="h-4 w-4" aria-hidden="true" />
              <span>Download ball-by-ball data (Cricsheet)</span>
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
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
