"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Initials } from "~/components/ui/initials";
import { InviteShare, inviteLink } from "~/components/invite-share";
import { searchScorers, type MatchScorerUser } from "~/app/matches/mutations";
import {
  addMatchStreamer,
  getMatchStreamers,
  inviteMatchStreamer,
  removeMatchStreamer,
} from "~/app/matches/streamers";
import { useAuth } from "~/lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign-in message for someone invited to run a match's graphics. */
export function streamerInviteMessage(
  inviter: string | undefined,
  email: string,
  matchId: string,
): string {
  const who = inviter?.trim() || "Someone";
  return (
    `${who} invited you to run the broadcast graphics for a match on CricScore.\n` +
    `Open ${inviteLink(email, `/overlay/${matchId}/control`)} and sign in with Google using ${email}.`
  );
}

/**
 * Streamers section of the match scorers dialog: people who may run the
 * overlay graphics (control room, Stream Deck, stream channels) but not
 * score. Match admins add them by name, or invite them by email with the
 * same share-a-sign-in-link flow as scorers.
 */
export function MatchStreamersSection({ matchId }: { matchId: string }) {
  const { user } = useAuth();
  const [streamers, setStreamers] = useState<MatchScorerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MatchScorerUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (res: Awaited<ReturnType<typeof getMatchStreamers>>) => {
      if (res.error) toast.error(res.error);
      setStreamers(res.data);
      setLoading(false);
    },
    [],
  );
  const load = useCallback(
    () => getMatchStreamers(matchId).then(show),
    [matchId, show],
  );

  useEffect(() => {
    let live = true;
    void getMatchStreamers(matchId).then((res) => {
      if (live) show(res);
    });
    return () => {
      live = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [matchId, show]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed.length < 2 || EMAIL_PATTERN.test(trimmed)) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await searchScorers(trimmed);
        setResults(res.data ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
  };

  const addById = async (target: MatchScorerUser) => {
    setSubmitting(true);
    try {
      const res = await addMatchStreamer(matchId, target.id);
      if (!res.success) {
        toast.error(res.error ?? "Failed to add streamer");
        return;
      }
      toast.success(`${target.full_name} can now run the graphics`);
      setQuery("");
      setResults([]);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = query.trim();
    if (!EMAIL_PATTERN.test(email)) {
      toast.error("Pick a player from the list or enter an email");
      return;
    }
    setSubmitting(true);
    setShareText(null);
    try {
      const res = await inviteMatchStreamer(email, matchId);
      if ("error" in res) {
        toast.error(res.error ?? "Failed to invite streamer");
        return;
      }
      toast.success(res.message);
      if (res.shareEmail) {
        const name =
          typeof user?.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : undefined;
        setShareText(streamerInviteMessage(name, res.shareEmail, matchId));
      }
      setQuery("");
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (target: MatchScorerUser) => {
    if (!confirm(`Remove ${target.full_name} from streamers?`)) return;
    const res = await removeMatchStreamer(matchId, target.id);
    if (!res.success) {
      toast.error(res.error ?? "Failed to remove streamer");
      return;
    }
    toast.success(`Removed ${target.full_name} from streamers`);
    void load();
  };

  const streamerIds = new Set(streamers.map((s) => s.id));

  return (
    <section
      aria-labelledby="match-streamers-heading"
      className="space-y-2 border-t border-border pt-4"
    >
      <h3
        id="match-streamers-heading"
        className="text-sm font-semibold text-foreground"
      >
        Streamers
      </h3>
      <p className="text-2xs text-muted-foreground">
        Streamers run the overlay graphics and the Stream Deck, but cannot
        score.
      </p>

      <form onSubmit={invite} className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="streamer-search-input" className="sr-only">
            Add streamer by name or email
          </label>
          <Input
            id="streamer-search-input"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search a player or enter an email"
            className="pl-8 text-sm"
            disabled={submitting}
          />
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={submitting || !EMAIL_PATTERN.test(query.trim())}
          className="h-10 min-h-[40px] gap-1 px-3.5"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          <span>Invite</span>
        </Button>
      </form>

      {searching && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Searching players</span>
        </div>
      )}
      {!searching && results.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 p-2.5 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Initials name={r.full_name} fallback="U" className="h-7 w-7" />
                <span className="truncate font-semibold">{r.full_name}</span>
              </span>
              {streamerIds.has(r.id) ? (
                <Badge variant="secondary" className="shrink-0 text-2xs">
                  Streamer
                </Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => addById(r)}
                  className="h-8 min-h-[32px] shrink-0 px-2.5 text-xs"
                  aria-label={`Add ${r.full_name} as a streamer`}
                >
                  Add
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {shareText && (
        <InviteShare text={shareText} id="streamer-invite-message" />
      )}

      {loading ? (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : streamers.length === 0 ? (
        <p className="rounded-xl border border-border p-3 text-center text-xs text-muted-foreground">
          No streamers yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {streamers.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 p-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Initials name={s.full_name} fallback="S" className="h-8 w-8" />
                <span className="truncate font-semibold">{s.full_name}</span>
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(s)}
                className="h-8 min-h-[32px] w-8 min-w-[32px] text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${s.full_name} from streamers`}
                title="Remove streamer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
