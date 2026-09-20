"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { UserPlus, Loader2, Mail } from "lucide-react";
import { inviteClubMember } from "~/app/clubs/actions";
import { toast } from "sonner";

interface InviteMemberDialogProps {
  clubId: string;
}

export function InviteMemberDialog({ clubId }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await inviteClubMember(clubId, cleanEmail);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Invitation recorded for ${cleanEmail}!`);
        setEmail("");
        setOpen(false);
      }
    } catch (err) {
      console.error("Error inviting club member:", err);
      toast.error("Failed to send club invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 min-h-[36px] gap-1.5 text-xs">
          <UserPlus className="h-3.5 w-3.5" />
          <span>Invite Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Club Membership
            </span>
          </div>
          <DialogTitle className="text-xl">Invite Player or Staff</DialogTitle>
          <DialogDescription>
            Send a club invitation to a cricketer, scorer, or coach by their
            email address.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 min-h-[40px] sm:h-9 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="h-10 min-h-[40px] sm:h-9 text-sm font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Inviting...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
