"use client";

import { useEffect, useState } from "react";
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
import {
  searchUsers,
  addPlayerToTeam,
  createPlayerQuick,
} from "~/app/teams/actions";
import { toast } from "sonner";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

interface AddPlayerDialogProps {
  teamId: string;
  onSuccess?: () => void;
}

type FoundUser = {
  id: string;
  full_name?: string;
  username?: string | null;
};

/**
 * Adds a player to a team: search registered players as you type, or create
 * a new player record from a name when they are not on the platform yet.
 */
export function AddPlayerDialog({ teamId, onSuccess }: AddPlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [users, setUsers] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await searchUsers(trimmed);
        if (cancelled) return;
        if (error) toast.error("Search failed");
        else setUsers((data ?? []) as FoundUser[]);
      } catch {
        if (!cancelled) toast.error(NETWORK_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed]);

  const results = trimmed.length >= 2 ? users : [];

  const finish = (message: string) => {
    toast.success(message);
    setOpen(false);
    setQuery("");
    setUsers([]);
    onSuccess?.();
  };

  const addExisting = async (user: FoundUser) => {
    setBusy(user.id);
    try {
      const result = await addPlayerToTeam(teamId, user.id);
      if (result.error) toast.error(result.error);
      else finish(`${user.full_name ?? "Player"} added to the squad`);
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setBusy(null);
    }
  };

  const createNew = async () => {
    if (!trimmed) return;
    setBusy("new");
    try {
      const result = await createPlayerQuick(teamId, trimmed);
      if (result.error) toast.error(result.error);
      else finish(`${trimmed} added to the squad`);
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
            Type a name to find a registered player, or add them as a new player
            if they are not on CricScore yet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="Player name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search players"
              autoFocus
              className="pl-9"
            />
          </div>

          {/* Right under the name box, so it shows while the phone keyboard
              is open (below the results it was out of sight). */}
          {trimmed.length >= 2 && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void createNew()}
              disabled={busy !== null}
            >
              {busy === "new" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              <span className="truncate">Add “{trimmed}” as a new player</span>
            </Button>
          )}

          {trimmed.length >= 2 && (
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
                      {user.full_name?.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.full_name}
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

              {!searching && results.length === 0 && (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  No registered player matches “{trimmed}”.
                </p>
              )}
              {searching && (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  Searching…
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
