"use client";

import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAuth } from "~/lib/auth";
import {
  useCanDeleteMatchQuery,
  useMatchAdminQuery,
} from "~/lib/hooks/useMatchQueries";
import { DeleteMatchDialog } from "./delete-match-dialog";

interface MatchMoreMenuProps {
  match: {
    id: string;
    title: string | null;
    tournament_id?: string | null;
    club_id?: string | null;
  };
  className?: string;
}

/**
 * The match page's "More" menu. It holds rarely used, destructive actions
 * (delete), so it renders nothing for users who may not use any of them.
 */
export function MatchMoreMenu({ match, className }: MatchMoreMenuProps) {
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

  if (!canDelete) return null;

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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() => setShowDelete(true)}
            className="flex cursor-pointer items-center gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete match</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteMatchDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        match={match}
      />
    </>
  );
}
