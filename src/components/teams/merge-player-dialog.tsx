"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ds/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PlayerSearchNote } from "~/components/players/player-search-note";
import { mergePlayerInto, previewMergePlayer } from "~/app/teams/actions";
import { usePlayerSearch } from "~/lib/hooks/usePlayerSearch";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";
import {
  foundPlayerHint,
  typedHandle,
  type FoundPlayer,
} from "~/lib/player-search";

const sameText = (a: string, b: string) =>
  a.trim().toLowerCase().replace(/\s+/g, " ") ===
  b.trim().toLowerCase().replace(/\s+/g, " ");

const plural = (n: number) => `${n} ${n === 1 ? "match" : "matches"}`;

/**
 * Merges a player who never signed in into the real one: find them, see
 * what moves, type the name, and it runs in batches until done. It cannot
 * be undone, so nothing happens before the name is typed.
 */
export function MergePlayerDialog({
  open,
  onOpenChange,
  teamId,
  player,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  /** The duplicate, removed by the merge. */
  player: { id: string; name: string };
}) {
  const router = useRouter();
  const inputId = useId();
  const confirmId = useId();
  const [query, setQuery] = useState("");
  const [keeper, setKeeper] = useState<FoundPlayer | null>(null);
  const [preview, setPreview] = useState<{
    matches: number;
    together: number;
  } | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<number | null>(null);

  const running = moved !== null;
  const text = query.trim();
  const searchable = (typedHandle(text) ?? text).length >= 2;
  const search = usePlayerSearch(searchable && !keeper ? text : "");
  const found = search.players.filter((p) => p.id !== player.id);

  const close = (next: boolean) => {
    if (running) return;
    onOpenChange(next);
  };

  const pick = async (p: FoundPlayer) => {
    setKeeper(p);
    setError(null);
    try {
      const res = await previewMergePlayer(teamId, player.id, p.id);
      if (res.error || !res.data) {
        setKeeper(null);
        setError(res.error ?? "These players could not be compared");
        return;
      }
      setPreview(res.data);
    } catch {
      setKeeper(null);
      setError(NETWORK_ERROR_MESSAGE);
    }
  };

  const merge = async () => {
    if (!keeper) return;
    setError(null);
    setMoved(0);
    try {
      // Each call moves a batch; a failure leaves every match whole, so
      // trying again carries on where this stopped.
      for (;;) {
        const res = await mergePlayerInto(teamId, player.id, keeper.id);
        if (res.error || !res.data) {
          setError(res.error ?? "The players could not be merged");
          setMoved(null);
          return;
        }
        const batch = res.data.moved;
        setMoved((n) => (n ?? 0) + batch);
        if (res.data.done) break;
      }
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      setMoved(null);
      return;
    }
    toast.success(`${player.name} merged into ${keeper.name}.`);
    onOpenChange(false);
    router.refresh();
  };

  const confirmed = sameText(typed, player.name);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance text-lg font-semibold">
            Is {player.name} someone else on CricScore?
          </DialogTitle>
          <DialogDescription>
            Find the real player. {player.name}&apos;s matches move to them and
            this duplicate is removed.
          </DialogDescription>
        </DialogHeader>

        {!keeper && (
          <div className="space-y-2">
            <Label htmlFor={inputId} className="text-sm font-medium">
              The real player
            </Label>
            <Input
              id={inputId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or @username"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
            />
            {searchable && (
              <PlayerSearchNote
                search={search}
                query={text}
                listed={found.length}
              />
            )}
            <div role="group" aria-label="Players found" className="space-y-1">
              {found.slice(0, 5).map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 w-full justify-start rounded-xl py-1.5"
                  onClick={() => void pick(p)}
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {foundPlayerHint(p)}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {keeper && !preview && !error && (
          <p role="status" className="text-sm text-muted-foreground">
            Comparing the two players
          </p>
        )}

        {keeper && preview && preview.together > 0 && (
          <p role="alert" className="text-sm text-destructive">
            {player.name} and {keeper.name} played in the same match, so they
            are different people.
          </p>
        )}

        {keeper && preview && preview.together === 0 && (
          <div className="space-y-3">
            <p className="rounded-lg bg-primary-soft px-3.5 py-3 text-sm text-primary-soft-foreground">
              {plural(preview.matches)} and {player.name}&apos;s squad places
              move to {keeper.name} ({foundPlayerHint(keeper)}). Their figures
              add up, and {player.name}&apos;s profile is removed. This
              can&apos;t be undone.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor={confirmId} className="text-sm font-medium">
                Type {player.name} to confirm
              </Label>
              <Input
                id={confirmId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={running}
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {running && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Moved {plural(moved)} so far
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {keeper && !running && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setKeeper(null);
                setPreview(null);
                setTyped("");
                setError(null);
              }}
            >
              Pick someone else
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={running}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {keeper && preview?.together === 0 && (
            <Button
              type="button"
              disabled={!confirmed}
              loading={running}
              onClick={() => void merge()}
            >
              Merge
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
