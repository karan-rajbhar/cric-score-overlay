"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useConfirm } from "~/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { removeMember, updateMemberRole } from "~/app/clubs/actions";

interface MemberActionsProps {
  clubId: string;
  membershipId: string;
  currentRole: string;
  userName: string;
  /** Only the owner makes or unmakes admins. */
  canChangeRole: boolean;
  canRemove: boolean;
}

/**
 * A member's actions in one row menu (`/design#spec-row-actions`), so the
 * name keeps the row's width on a phone; each asks first in the app's own
 * dialog.
 */
export function MemberActions({
  clubId,
  membershipId,
  currentRole,
  userName,
  canChangeRole,
  canRemove,
}: MemberActionsProps) {
  const [busy, setBusy] = useState(false);
  const [ask, confirmDialog] = useConfirm();
  if (currentRole === "owner" || (!canChangeRole && !canRemove)) return null;

  const isAdmin = currentRole === "admin";
  const targetRole = isAdmin ? "member" : "admin";

  const changeRole = async () => {
    const ok = await ask({
      title: isAdmin ? `Make ${userName} a member?` : `Make ${userName} an admin?`,
      description: isAdmin
        ? "They will no longer manage the club's teams, tournaments and members."
        : "Admins manage the club's teams, tournaments and members.",
      confirmLabel: isAdmin ? "Make member" : "Make admin",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await updateMemberRole(clubId, membershipId, targetRole);
      if (res.error) toast.error(res.error);
      else toast.success(`${userName} is now a club ${targetRole}`);
    } catch (err) {
      console.error("Failed to update role:", err);
      toast.error("Failed to update member role");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await ask({
      title: `Remove ${userName} from the club?`,
      description:
        "Their matches and statistics stay. They can be invited again.",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await removeMember(clubId, membershipId);
      if (res?.error) toast.error(res.error);
      else toast.success(`Removed ${userName} from the club`);
    } catch (err) {
      console.error("Failed to remove member:", err);
      toast.error("Failed to remove member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            className="h-11 w-11 shrink-0 text-muted-foreground"
            aria-label={`Actions for ${userName}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canChangeRole && (
            <DropdownMenuItem onSelect={() => void changeRole()}>
              {isAdmin ? (
                <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {isAdmin ? "Make member" : "Make admin"}
            </DropdownMenuItem>
          )}
          {canChangeRole && canRemove && <DropdownMenuSeparator />}
          {canRemove && (
            <DropdownMenuItem
              onSelect={() => void remove()}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove from club
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
