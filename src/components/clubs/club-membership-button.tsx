"use client";

import { useTransition } from "react";
import { Button } from "~/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { joinClub, leaveClub } from "~/app/clubs/actions";
import { toast } from "sonner";
import Link from "next/link";

interface ClubMembershipButtonProps {
  clubId: string;
  isMember: boolean;
  isOwner: boolean;
  isAuthenticated: boolean;
}

export function ClubMembershipButton({
  clubId,
  isMember,
  isOwner,
  isAuthenticated,
}: ClubMembershipButtonProps) {
  const [isPending, startTransition] = useTransition();

  if (!isAuthenticated) {
    return (
      <Button variant="outline" size="sm" asChild className="gap-1.5">
        <Link href={`/auth/login?redirect=/clubs/${clubId}`}>
          <UserPlus className="h-4 w-4" />
          Sign in to join
        </Link>
      </Button>
    );
  }

  // The owner cannot leave: the header says who they are (a chip), and
  // there is no button to show (T6).
  if (isOwner) return null;

  const handleToggle = () => {
    startTransition(async () => {
      if (isMember) {
        const res = await leaveClub(clubId);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("You have left the club");
        }
      } else {
        const res = await joinClub(clubId);
        if (res?.error) {
          toast.error(res.error);
        } else {
          toast.success("You joined the club");
        }
      }
    });
  };

  return (
    <Button
      variant={isMember ? "outline" : "default"}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      className="gap-1.5"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isMember ? (
        <>
          <UserCheck className="h-4 w-4 text-success" />
          Member (leave)
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Join club
        </>
      )}
    </Button>
  );
}
