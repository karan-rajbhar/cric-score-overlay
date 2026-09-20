"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { ShieldCheck, ShieldAlert, Loader2, Trash2 } from "lucide-react";
import { updateMemberRole, removeMember } from "~/app/clubs/actions";
import { toast } from "sonner";

interface MemberRoleActionProps {
  clubId: string;
  membershipId: string;
  currentRole: string;
  userName: string;
}

export function MemberRoleAction({
  clubId,
  membershipId,
  currentRole,
  userName,
}: MemberRoleActionProps) {
  const [loading, setLoading] = useState(false);

  if (currentRole === "owner") return null;

  const isAdmin = currentRole === "admin";
  const targetRole = isAdmin ? "member" : "admin";

  const handleToggle = async () => {
    const actionLabel = isAdmin
      ? `Demote ${userName} to regular member?`
      : `Promote ${userName} to club admin?`;
    if (!confirm(actionLabel)) return;

    setLoading(true);
    try {
      const res = await updateMemberRole(clubId, membershipId, targetRole);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`${userName} is now a club ${targetRole}!`);
      }
    } catch (err) {
      console.error("Failed to update role:", err);
      toast.error("Failed to update member role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={handleToggle}
      className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
      title={isAdmin ? "Demote to Member" : "Promote to Admin"}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isAdmin ? (
        <>
          <ShieldAlert className="h-3 w-3 text-amber-500" />
          <span>Demote</span>
        </>
      ) : (
        <>
          <ShieldCheck className="h-3 w-3 text-sky-500" />
          <span>Make Admin</span>
        </>
      )}
    </Button>
  );
}

export function RemoveMemberButton({
  clubId,
  membershipId,
  userName,
}: {
  clubId: string;
  membershipId: string;
  userName: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm(`Remove ${userName} from this club?`)) return;

    setLoading(true);
    try {
      const res = await removeMember(clubId, membershipId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Removed ${userName} from the club`);
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
      toast.error("Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={handleRemove}
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      title={`Remove ${userName} from club`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

