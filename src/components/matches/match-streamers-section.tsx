"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "~/components/ds/avatar";
import { Button as DsButton } from "~/components/ds/button";
import { Chip } from "~/components/ds/chip";
import { SearchField } from "~/components/ds/field";
import { ListCard, ListRow } from "~/components/ds/list";
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
      className="space-y-2"
    >
      <h3
        id="match-streamers-heading"
        className="text-sm font-medium text-foreground"
      >
        Streamers
      </h3>
      <p className="text-xs text-muted-foreground">
        Streamers run the overlay graphics and the Stream Deck, but cannot
        score.
      </p>

      <form onSubmit={invite} className="flex gap-2">
        <label htmlFor="streamer-search-input" className="sr-only">
          Add streamer by name or email
        </label>
        <SearchField
          id="streamer-search-input"
          autoComplete="off"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Name or email"
          className="min-w-0 flex-1"
          disabled={submitting}
        />
        <DsButton
          type="submit"
          variant="outline"
          disabled={!EMAIL_PATTERN.test(query.trim())}
          loading={submitting}
          className="shrink-0"
        >
          Invite
        </DsButton>
      </form>

      {searching && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Searching players
        </p>
      )}
      {!searching && results.length > 0 && (
        <ListCard>
          {results.map((r) => (
            <ListRow
              key={r.id}
              leading={<Avatar name={r.full_name} size="sm" />}
              title={r.full_name}
              trailing={
                streamerIds.has(r.id) ? (
                  <Chip>Streamer</Chip>
                ) : (
                  <DsButton
                    type="button"
                    size="sm"
                    variant="soft"
                    disabled={submitting}
                    onClick={() => addById(r)}
                    aria-label={`Add ${r.full_name} as a streamer`}
                  >
                    Add
                  </DsButton>
                )
              }
            />
          ))}
        </ListCard>
      )}

      {shareText && (
        <InviteShare text={shareText} id="streamer-invite-message" />
      )}

      {loading ? (
        <div className="flex justify-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <ListCard>
          {streamers.map((s) => (
            <ListRow
              key={s.id}
              leading={<Avatar name={s.full_name} size="sm" />}
              title={s.full_name}
              trailing={
                <DsButton
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => remove(s)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${s.full_name} from streamers`}
                  title="Remove streamer"
                >
                  <Trash2 aria-hidden="true" />
                </DsButton>
              }
            />
          ))}
          {streamers.length === 0 && (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              No streamers yet.
            </p>
          )}
        </ListCard>
      )}
    </section>
  );
}
