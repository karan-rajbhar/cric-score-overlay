"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CloudRain,
  FileJson,
  MoreHorizontal,
  Trash2,
  Shield,
  Tv,
  UserCog,
  UserPlus,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { ActionMenu } from "~/components/ds/action-menu";
import { useAuth } from "~/lib/auth";
import {
  useCanDeleteMatchQuery,
  useCanProduceOverlayQuery,
  useMatchAdminQuery,
  useMatchClubChoices,
} from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { DeleteMatchDialog } from "./delete-match-dialog";
import { MatchClubDialog } from "./match-club-dialog";
import { RescheduleMatchDialog } from "./reschedule-match-dialog";

const DlsCalculatorModal = dynamic(
  () => import("./dls-calculator-modal").then((m) => m.DlsCalculatorModal),
  { ssr: false },
);
const MatchScorersDialog = dynamic(
  () => import("./match-scorers-dialog").then((m) => m.MatchScorersDialog),
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
  /**
   * The full match: the DLS calculator's defaults (live matches), the
   * ball-by-ball download (finished ones).
   */
  dlsMatch?: Match;
  /** Whether the DLS calculator may set the target (scorers). */
  canEditDls?: boolean;
  /** The user created the match (they may remove scorers). */
  isCreator?: boolean;
  className?: string;
}

const ENDED = new Set(["completed", "abandoned", "cancelled"]);

/**
 * The match page's "More" menu: the tools few people need (streaming the
 * match, which leads on to the control room; inviting scorers until it ends;
 * the DLS calculator while live; a finished match's ball-by-ball data) and,
 * for its organisers (who may delete it), Reschedule before the start and
 * Delete match. With nothing to offer, no button.
 *
 * Once the match ends, Stream stays for its scorers and streamers only: a
 * stream outlasts the last ball (the result, sponsors), and this is the one
 * way back to the control room.
 */
export function MatchMoreMenu({
  match,
  dlsMatch,
  canEditDls = false,
  isCreator = false,
  className,
}: MatchMoreMenuProps) {
  const { user } = useAuth();
  const router = useRouter();
  // Everyone who may delete is also a match admin; ask the stricter
  // question only then (viewers pay no extra reads).
  const { data: isAdmin } = useMatchAdminQuery(match.id, user?.id);
  const { data: canDelete } = useCanDeleteMatchQuery(
    match.id,
    user?.id,
    isAdmin === true,
  );
  // Asked only once the menu opens (viewers pay no extra reads).
  const [menuOpen, setMenuOpen] = useState(false);
  // Putting the match into a club afterwards: the user's clubs are read
  // once the menu opens.
  const [showClub, setShowClub] = useState(false);
  const {
    choosable: choosableClubs,
    offer,
    loading: clubsLoading,
  } = useMatchClubChoices(
    match,
    user?.id,
    isAdmin === true,
    menuOpen || showClub,
  );
  const canSetClub = !!dlsMatch && offer;
  const [showDelete, setShowDelete] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const canReschedule = canDelete === true && match.status === "scheduled";
  const [showDls, setShowDls] = useState(false);
  const [showScorers, setShowScorers] = useState(false);
  const dls =
    dlsMatch &&
    dlsMatch.status === "live" &&
    (dlsMatch.overs_per_innings ?? 0) > 0;
  const ended = ENDED.has(match.status ?? "");
  // Asked only of someone it could change the menu for (1 read).
  const { data: canProduce } = useCanProduceOverlayQuery(
    match.id,
    user?.id,
    ended && isAdmin === false,
  );
  const canStream = !ended || isAdmin === true || canProduce === true;
  const canDownload = dlsMatch?.status === "completed";
  // Scorers can always stream, so they always have something here.
  const hasItems = canStream || canSetClub || canDownload || canDelete;
  if (!hasItems) return null;

  return (
    <>
      <ActionMenu
        title={match.title ?? "Match"}
        onOpenChange={setMenuOpen}
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className={className ?? "h-9 w-9 p-0"}
            aria-label="More match actions"
            title="More"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
        groups={[
          {
            items: [
              canStream && {
                key: "stream",
                label: "Stream this match",
                icon: Tv,
                href: `/matches/${match.id}/stream`,
              },
              isAdmin === true &&
                !ended && {
                  key: "scorers",
                  label: "Invite scorers",
                  icon: UserPlus,
                  onSelect: () => setShowScorers(true),
                },
              // The team sheet, where any player can be replaced.
              isAdmin === true && {
                key: "replace",
                label: "Replace a player",
                icon: UserCog,
                href: `/matches/${match.id}/players`,
              },
              canSetClub && {
                key: "club",
                label: match.club_id ? "Change club" : "Add to club",
                icon: Shield,
                onSelect: () => setShowClub(true),
              },
              dls && {
                key: "dls",
                label: "DLS calculator",
                icon: CloudRain,
                onSelect: () => setShowDls(true),
              },
              Boolean(dlsMatch && canDownload) && {
                key: "cricsheet",
                label: "Download ball-by-ball data (Cricsheet)",
                icon: FileJson,
                // Loaded on demand: the Cricsheet builder and the export
                // query are needed by few.
                onSelect: () =>
                  void import("./cricsheet-export").then((m) =>
                    m.exportCricsheet(dlsMatch!),
                  ),
              },
              canReschedule && {
                key: "reschedule",
                // What it changes, as the dialog it opens is titled (M14).
                label: "Change date, venue or umpires",
                icon: CalendarClock,
                onSelect: () => setShowReschedule(true),
              },
              canDelete === true && {
                key: "delete",
                label: "Delete match",
                icon: Trash2,
                destructive: true,
                onSelect: () => setShowDelete(true),
              },
            ],
          },
        ]}
      />
      {showScorers && (
        <MatchScorersDialog
          matchId={match.id}
          isCreator={isCreator}
          open
          onOpenChange={setShowScorers}
        />
      )}
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
      {dlsMatch && (canSetClub || showClub) && (
        <MatchClubDialog
          open={showClub}
          onOpenChange={setShowClub}
          match={dlsMatch}
          clubs={choosableClubs}
          loading={clubsLoading}
          onSaved={() => router.refresh()}
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
