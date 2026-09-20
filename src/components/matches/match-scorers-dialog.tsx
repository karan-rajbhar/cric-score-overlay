"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Search,
  Share2,
} from "lucide-react";
import {
  getMatchScorers,
  addMatchScorer,
  removeMatchScorer,
  searchScorers,
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
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Scorers state
  const [createdBy, setCreatedBy] = useState<MatchScorerUser | null>(null);
  const [matchAdmins, setMatchAdmins] = useState<MatchScorerUser[]>([]);

  // Autocomplete search state
  const [searchResults, setSearchResults] = useState<MatchScorerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchScorers = useCallback(async () => {
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
  }, [matchId]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      void fetchScorers();
    } else {
      setQuery("");
      setSearchResults([]);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await searchScorers(trimmed);
        if (res.data) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleAddScorerTarget = async (targetValue: string) => {
    const cleanTarget = targetValue.trim();
    if (!cleanTarget) {
      toast.error("Please enter a player name or email");
      return;
    }

    setSubmitting(true);
    try {
      const res = await addMatchScorer(matchId, cleanTarget);
      if (!res.success) {
        toast.error(res.error ?? "Failed to add scorer");
      } else {
        toast.success(
          `Added ${res.user?.full_name ?? "scorer"} as match scorer!`
        );
        setQuery("");
        setSearchResults([]);
        void fetchScorers();
      }
    } catch (err) {
      console.error("Error adding match scorer:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAddScorerTarget(query);
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

  const getScoringUrl = () => {
    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "";
    return `${origin}/matches/${matchId}/score`;
  };

  const copyScoringLink = async () => {
    const url = getScoringUrl();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure / HTTP / test environments
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success("Scoring link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link to clipboard");
    }
  };

  const handleShare = async () => {
    const url = getScoringUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "CricScore — Match Scoring",
          text: "Score this match live with us on CricScore:",
          url,
        });
        toast.success("Shared successfully");
      } catch {
        // User dismissed or aborted share dialog
      }
    } else {
      void copyScoringLink();
    }
  };

  const existingAdminIds = new Set([
    ...(createdBy ? [createdBy.id] : []),
    ...matchAdmins.map((m) => m.id),
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton ?? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs sm:px-3"
            title="Invite co-scorers to record balls live"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Invite Scorer</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

        {/* Quick Link Share Box */}
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">Direct Scoring Link</div>
              <div className="truncate text-muted-foreground text-[11px]">
                /matches/{matchId}/score
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={copyScoringLink}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
              {typeof navigator !== "undefined" && Boolean(navigator.share) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleShare}
                  className="h-8 gap-1 px-2 text-xs"
                  title="Share scoring link"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Share</span>
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Anyone with this link can open live scoring once authorized below.
          </p>
        </div>

        {/* Search & Add Scorer Form */}
        <div className="space-y-2 pt-1">
          <label htmlFor="scorer-search-input" className="text-xs font-semibold text-foreground">
            Add Scorer by Name or Email
          </label>
          <form onSubmit={handleFormSubmit} className="relative flex gap-2">
            <div className="relative flex-1">
              <Input
                id="scorer-search-input"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search registered player or enter email..."
                className="text-sm pl-8"
                disabled={submitting}
                autoComplete="off"
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
            <Button
              type="submit"
              disabled={submitting || !query.trim()}
              size="sm"
              className="gap-1 px-3.5 whitespace-nowrap"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span>Add</span>
            </Button>
          </form>

          {/* Autocomplete Search Dropdown */}
          {searching && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Searching registered players...</span>
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="rounded-lg border border-border bg-card shadow-sm divide-y divide-border/60 max-h-48 overflow-y-auto">
              {searchResults.map((user) => {
                const isAlreadyScorer = existingAdminIds.has(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(user.full_name || "U")[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">
                          {user.full_name}
                        </div>
                        {user.email && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                    {isAlreadyScorer ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        Authorized
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={submitting}
                        onClick={() => handleAddScorerTarget(user.id)}
                        className="h-7 text-xs px-2.5 shrink-0"
                      >
                        + Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Authorized Scorers Roster */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Authorized Match Scorers
            </span>
            <span className="text-[11px] text-muted-foreground">
              {(createdBy ? 1 : 0) + matchAdmins.length} active
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {/* Lead / Creator Scorer */}
              {createdBy && (
                <div className="flex items-center justify-between p-3 text-sm bg-primary/5">
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {(createdBy.full_name || "U")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {createdBy.full_name}
                      </div>
                      {createdBy.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {createdBy.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal shrink-0">
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
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                      {(admin.full_name || "S")[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground truncate">
                        {admin.full_name}
                      </div>
                      {admin.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {admin.email}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      Co-Scorer
                    </Badge>
                    {isCreator && (
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
                  No additional scorers authorized yet.
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MatchScorersDialog;
