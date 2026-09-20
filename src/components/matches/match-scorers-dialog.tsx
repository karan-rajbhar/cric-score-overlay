"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Trash2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  getMatchScorers,
  addMatchScorer,
  removeMatchScorer,
  type MatchScorerUser,
} from "~/app/matches/mutations";
import { toast } from "sonner";

interface MatchScorersDialogProps {
  matchId: string;
  isCreator?: boolean;
  triggerButton?: React.ReactNode;
}

export function MatchScorersDialog({
  matchId,
  isCreator = false,
  triggerButton,
}: MatchScorersDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailOrId, setEmailOrId] = useState("");
  const [copied, setCopied] = useState(false);

  const [createdBy, setCreatedBy] = useState<MatchScorerUser | null>(null);
  const [matchAdmins, setMatchAdmins] = useState<MatchScorerUser[]>([]);

  const fetchScorers = async () => {
    setLoading(true);
    try {
      const res = await getMatchScorers(matchId);
      if (res.data) {
        setCreatedBy(res.data.createdBy);
        setMatchAdmins(res.data.matchAdmins);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch (err) {
      console.error("Failed to load match scorers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      void fetchScorers();
    }
  };

  const handleAddScorer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrId.trim()) {
      toast.error("Please enter a user email or ID");
      return;
    }

    setSubmitting(true);
    try {
      const res = await addMatchScorer(matchId, emailOrId);
      if (!res.success) {
        toast.error(res.error ?? "Failed to add scorer");
      } else {
        toast.success(
          `Added ${res.user?.full_name ?? "scorer"} as match scorer!`
        );
        setEmailOrId("");
        void fetchScorers();
      }
    } catch (err) {
      console.error("Error adding match scorer:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveScorer = async (scorerId: string, name: string) => {
    if (!confirm(`Remove ${name} from match scorers?`)) return;

    try {
      const res = await removeMatchScorer(matchId, scorerId);
      if (!res.success) {
        toast.error(res.error ?? "Failed to remove scorer");
      } else {
        toast.success(`Removed ${name} from match scorers`);
        void fetchScorers();
      }
    } catch (err) {
      console.error("Error removing scorer:", err);
      toast.error("Failed to remove scorer");
    }
  };

  const copyScoringLink = () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/matches/${matchId}/score`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Scoring link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton ?? (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <UserPlus className="h-3.5 w-3.5" />
            <span>Invite Scorer</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Users className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Scorer Delegation
            </span>
          </div>
          <DialogTitle className="text-xl">Match Scorers</DialogTitle>
          <DialogDescription>
            Authorize multiple scorers (home & away scorers, substitute scorers)
            to record balls and edit events live.
          </DialogDescription>
        </DialogHeader>

        {/* Quick Link Share */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-xs">
          <div className="min-w-0 pr-2">
            <div className="font-semibold text-foreground">Scoring Link</div>
            <div className="truncate text-muted-foreground">
              /matches/{matchId}/score
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={copyScoringLink}
            className="h-8 gap-1 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </Button>
        </div>

        {/* Add Scorer Form */}
        <form onSubmit={handleAddScorer} className="space-y-3 pt-1">
          <div className="flex gap-2">
            <Input
              value={emailOrId}
              onChange={(e) => setEmailOrId(e.target.value)}
              placeholder="Scorer email or player UUID"
              className="text-sm"
              disabled={submitting}
            />
            <Button
              type="submit"
              disabled={submitting || !emailOrId.trim()}
              size="sm"
              className="gap-1 px-4 whitespace-nowrap"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>Add</span>
            </Button>
          </div>
        </form>

        {/* Scorers List */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Match Scorers
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {/* Match Creator */}
              {createdBy && (
                <div className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(createdBy.full_name || "U")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        {createdBy.full_name}
                      </div>
                      {createdBy.email && (
                        <div className="text-xs text-muted-foreground">
                          {createdBy.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal">
                    <ShieldCheck className="mr-1 h-3 w-3 text-primary" />
                    Creator
                  </Badge>
                </div>
              )}

              {/* Co-Scorers */}
              {matchAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {(admin.full_name || "S")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">
                        {admin.full_name}
                      </div>
                      {admin.email && (
                        <div className="text-xs text-muted-foreground">
                          {admin.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Co-Scorer
                    </Badge>
                    {(isCreator || true) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          handleRemoveScorer(admin.id, admin.full_name)
                        }
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Remove scorer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {!createdBy && matchAdmins.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No additional scorers added yet.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
