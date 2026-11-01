"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { addPlayerToTeam, createPlayerQuick } from "~/app/teams/actions";
import {
  PlayerSearchNote,
  SameNameNote,
} from "~/components/players/player-search-note";
import { RecentPlayers } from "~/components/players/recent-players";
import { toast } from "sonner";
import { usePlayerSearch, useSameNameCheck } from "~/lib/hooks/usePlayerSearch";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";
import { lookUpPlayers } from "~/lib/player-lookup";
import { typedHandle, type FoundPlayer } from "~/lib/player-search";
import { rememberPlayer } from "~/lib/recent-players";

interface AddPlayerDialogProps {
  teamId: string;
  /** The team's club: its members come first in a search. */
  clubId?: string | null;
  onSuccess?: () => void;
}

/**
 * Adds a player to a team: search registered players as you type, or create
 * a new player record from a name when they are not on the platform yet.
 */
export function AddPlayerDialog({
  teamId,
  clubId,
  onSuccess,
}: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const trimmed = query.trim();
  const handle = typedHandle(trimmed);
  const searchable = (handle ?? trimmed).length >= 2;
  const find = useCallback(
    (q: string) => lookUpPlayers(q, clubId ? { clubId } : undefined),
    [clubId],
  );
  const search = usePlayerSearch(searchable ? trimmed : "", find);
  const results = search.players;
  const sameName = useSameNameCheck(trimmed, results);

  const finish = (message: string) => {
    toast.success(message);
    setOpen(false);
    setQuery("");
    onSuccess?.();
  };

  const addExisting = async (user: FoundPlayer) => {
    setBusy(user.id);
    try {
      const result = await addPlayerToTeam(teamId, user.id);
      if (result.error) toast.error(result.error);
      else {
        rememberPlayer(user);
        finish(`${user.name} added to the squad`);
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  const createNew = async () => {
    if (!trimmed || !sameName.allow()) return;
    setBusy("new");
    try {
      const result = await createPlayerQuick(teamId, trimmed);
      if (result.error) toast.error(result.error);
      else {
        if (result.data) {
          rememberPlayer({ id: result.data.user_id, name: trimmed });
        }
        finish(`${trimmed} added to the squad`);
      }
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add player
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add player to squad</DialogTitle>
          <DialogDescription>
            Type a name or @username to find a registered player, or add them
            as a new player if they are not on CricScore yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="Name or @username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players"
              autoFocus
              className="pl-9"
            />
          </div>

          {!trimmed && (
            <RecentPlayers
              teamName="the squad"
              disabled={busy !== null}
              onPick={(p) => void addExisting(p)}
            />
          )}

          {sameName.asking && sameName.twin && (
            <SameNameNote twin={sameName.twin} />
          )}

          {/* Right under the name box, so it shows while the phone keyboard
              is open (below the results it was out of sight). */}
          {searchable && handle === null && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void createNew()}
              disabled={busy !== null || search.status === "searching"}
            >
              {busy === "new" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              <span className="truncate">
                {sameName.asking
                  ? `Yes, add a second “${trimmed}”`
                  : `Add “${trimmed}” as a new player`}
              </span>
            </Button>
          )}

          {searchable && (
            <div
              className="space-y-2 sm:max-h-[300px] sm:overflow-y-auto"
              aria-label="Registered players"
              role="group"
            >
              {results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void addExisting(user)}
                  className="flex min-h-11 w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted disabled:opacity-60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {user.name.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.name}
                      </p>
                      {user.username && (
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          @{user.username}
                        </p>
                      )}
                    </div>
                  </div>
                  {busy === user.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus
                      className="h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}

              <PlayerSearchNote
                search={search}
                query={trimmed}
                listed={results.length}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
