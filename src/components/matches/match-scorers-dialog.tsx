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
import { Avatar } from "~/components/ds/avatar";
import { Button as DsButton } from "~/components/ds/button";
import { Chip } from "~/components/ds/chip";
import { SearchField } from "~/components/ds/field";
import { ListCard, ListRow } from "~/components/ds/list";
import { UserPlus, Copy, Check, Trash2, Loader2, Share2 } from "lucide-react";
import {
  getMatchScorers,
  addMatchScorer,
  removeMatchScorer,
  searchScorers,
  type MatchScorerUser,
} from "~/app/matches/mutations";
import { toast } from "sonner";
import { inviteToApp } from "~/app/invitations/actions";
import { InviteShare, inviteMessage } from "~/components/invite-share";
import { MatchStreamersSection } from "~/components/matches/match-streamers-section";
import { useAuth } from "~/lib/auth";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [shareText, setShareText] = useState<string | null>(null);
  const { user } = useAuth();

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
      setShareText(null);
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
        if (res.error) toast.error(res.error);
      } catch (err) {
        console.error("Search error:", err);
        toast.error(NETWORK_ERROR_MESSAGE);
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
    setShareText(null);
    try {
      // An email adds an existing user, or invites someone new as a scorer.
      if (EMAIL_PATTERN.test(cleanTarget)) {
        const invite = await inviteToApp(cleanTarget, matchId);
        if ("error" in invite) {
          toast.error(invite.error ?? "Failed to invite scorer");
          return;
        }
        toast.success(invite.message);
        if (invite.shareEmail) {
          const name =
            typeof user?.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : undefined;
          setShareText(inviteMessage(name, invite.shareEmail, matchId));
        }
        setQuery("");
        setSearchResults([]);
        void fetchScorers();
        return;
      }

      const res = await addMatchScorer(matchId, cleanTarget);
      if (!res.success) {
        toast.error(res.error ?? "Failed to add scorer");
      } else {
        toast.success(
          `Added ${res.user?.full_name ?? "scorer"} as match scorer`
        );
        setQuery("");
        setSearchResults([]);
        void fetchScorers();
      }
    } catch (err) {
      console.error("Error adding match scorer:", err);
      toast.error(NETWORK_ERROR_MESSAGE);
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
            title="Invite co-scorers to record balls live"
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Invite scorer</span>
            <span className="sm:hidden">Scorers</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Match scorers</DialogTitle>
          <DialogDescription>
            Co-scorers can record balls and fix mistakes, like you. Only the
            match&apos;s creator can remove them.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Add a scorer: one box for a name or an email */}
        <section className="space-y-2">
          <label
            htmlFor="scorer-search-input"
            className="block text-sm font-medium text-foreground"
          >
            Add scorer by name or email
          </label>
          <form onSubmit={handleFormSubmit} className="flex gap-2">
            <SearchField
              id="scorer-search-input"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Name or Google email"
              className="min-w-0 flex-1"
              disabled={submitting}
              autoComplete="off"
            />
            <DsButton
              type="submit"
              disabled={!query.trim()}
              loading={submitting}
              className="shrink-0"
            >
              Add
            </DsButton>
          </form>
          <p className="text-xs text-muted-foreground">
            Not on CricScore yet? Enter their Google email to invite them.
          </p>

          {searching && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Searching players
            </p>
          )}
          {!searching && searchResults.length > 0 && (
            <ListCard>
              {searchResults.map((found) => (
                <ListRow
                  key={found.id}
                  leading={<Avatar name={found.full_name} src={found.avatar_url} size="sm" />}
                  title={found.full_name}
                  subtitle={found.username ? `@${found.username}` : undefined}
                  trailing={
                    existingAdminIds.has(found.id) ? (
                      <Chip>Scorer</Chip>
                    ) : (
                      <DsButton
                        type="button"
                        size="sm"
                        variant="soft"
                        disabled={submitting}
                        onClick={() => handleAddScorerTarget(found.id)}
                        aria-label={`Add ${found.full_name} as a scorer`}
                      >
                        Add
                      </DsButton>
                    )
                  }
                />
              ))}
            </ListCard>
          )}
        </section>

        {shareText && <InviteShare text={shareText} />}

        {/* 2. Who scores this match */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            Scorers{" "}
            <span className="font-normal text-muted-foreground">
              ({(createdBy ? 1 : 0) + matchAdmins.length})
            </span>
          </h3>
          {loading ? (
            <div className="flex justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          ) : (
            <ListCard>
              {createdBy && (
                <ListRow
                  leading={<Avatar name={createdBy.full_name} src={createdBy.avatar_url} size="sm" />}
                  title={createdBy.full_name}
                  trailing={<Chip tone="primary">Creator</Chip>}
                />
              )}
              {matchAdmins.map((admin) => (
                <ListRow
                  key={admin.id}
                  leading={<Avatar name={admin.full_name} src={admin.avatar_url} size="sm" />}
                  title={admin.full_name}
                  trailing={
                    <span className="flex items-center gap-1">
                      <Chip>Co-scorer</Chip>
                      {isCreator && (
                        <DsButton
                          size="icon-sm"
                          variant="ghost"
                          onClick={() =>
                            handleRemoveScorer(admin.id, admin.full_name)
                          }
                          className="text-muted-foreground hover:text-destructive"
                          title="Remove scorer"
                          aria-label={`Remove ${admin.full_name} as a scorer`}
                        >
                          <Trash2 aria-hidden="true" />
                        </DsButton>
                      )}
                    </span>
                  }
                />
              ))}
              {!createdBy && matchAdmins.length === 0 && (
                <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                  No scorers yet.
                </p>
              )}
            </ListCard>
          )}
        </section>

        {/* 3. The link they open to score */}
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Scoring link</h3>
          <p className="text-xs text-muted-foreground">
            Send it to the scorers above: it opens live scoring for this match.
          </p>
          <div className="flex flex-wrap gap-2">
            <DsButton variant="outline" size="sm" onClick={copyScoringLink}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </DsButton>
            {typeof navigator !== "undefined" && Boolean(navigator.share) && (
              <DsButton variant="outline" size="sm" onClick={handleShare}>
                <Share2 aria-hidden="true" />
                Share
              </DsButton>
            )}
          </div>
        </section>

        <MatchStreamersSection matchId={matchId} />
      </DialogContent>
    </Dialog>
  );
}

export default MatchScorersDialog;
