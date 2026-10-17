"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  addPlayerToTeam,
  removePlayerFromTeam,
  searchUsers,
} from "~/app/teams/actions";
import type { TeamPlayer } from "~/lib/match-types";
import { cn } from "~/lib/utils";

export interface SquadTeam {
  id: string;
  name: string;
  players: TeamPlayer[];
}

export interface SquadManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batting: SquadTeam | null;
  bowling: SquadTeam | null;
  /** Ids of players currently at the crease / bowling. */
  activeIds: Set<string>;
  /** Ids of players who have batted or bowled in this innings. */
  usedIds: Set<string>;
  dismissedIds: Set<string>;
  /** Creates a brand-new player record and adds them to the side. */
  onCreatePlayer: (
    side: "batting" | "bowling",
    name: string,
  ) => Promise<unknown>;
  /** Called after any roster change so the page can reload squads. */
  onChanged: () => Promise<void> | void;
  isProcessing: boolean;
}

type FoundUser = {
  id: string;
  full_name?: string;
  username?: string | null;
};

function roleLabel(role?: string | null): string | null {
  switch (role) {
    case "captain":
      return "(c)";
    case "vice_captain":
      return "(vc)";
    case "wicket_keeper":
      return "(wk)";
    default:
      return null;
  }
}

function SquadPanel({
  side,
  team,
  activeIds,
  usedIds,
  dismissedIds,
  onCreatePlayer,
  onChanged,
  isProcessing,
}: {
  side: "batting" | "bowling";
  team: SquadTeam;
  activeIds: Set<string>;
  usedIds: Set<string>;
  dismissedIds: Set<string>;
  onCreatePlayer: SquadManagerDialogProps["onCreatePlayer"];
  onChanged: SquadManagerDialogProps["onChanged"];
  isProcessing: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rosterIds = useMemo(
    () => new Set(team.players.map((p) => p.user_id)),
    [team.players],
  );

  // Search registered players as the scorer types (debounced).
  const activeQuery = query.trim();
  useEffect(() => {
    if (activeQuery.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await searchUsers(activeQuery);
      if (!cancelled) {
        setResults(
          ((data ?? []) as FoundUser[]).filter((u) => !rosterIds.has(u.id)),
        );
        setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeQuery, rosterIds]);
  const visibleResults = activeQuery.length >= 2 ? results : [];

  const addExisting = async (userId: string) => {
    setBusyId(userId);
    const res = await addPlayerToTeam(team.id, userId);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Player added to squad");
      setQuery("");
      setResults([]);
      await onChanged();
    }
    setBusyId(null);
  };

  const remove = async (userId: string, name: string) => {
    setBusyId(userId);
    const res = await removePlayerFromTeam(team.id, userId);
    if (res.error) toast.error(res.error);
    else {
      toast.success(`${name} removed from squad`);
      await onChanged();
    }
    setBusyId(null);
  };

  const createNew = async () => {
    const name = newName.trim();
    if (!name) return;
    await onCreatePlayer(side, name);
    setNewName("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Squad ({team.players.length})
          </p>
          {team.players.length < 11 && (
            <span className="text-2xs font-semibold text-amber-600 dark:text-amber-400">
              {11 - team.players.length} short of XI
            </span>
          )}
        </div>
        {team.players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
            No players yet. Add them below.
          </p>
        ) : (
          <ul className="max-h-[38vh] space-y-1 overflow-y-auto pr-1">
            {team.players.map((p) => {
              const name = p.user?.full_name ?? "Player";
              const active = activeIds.has(p.user_id);
              const used = usedIds.has(p.user_id);
              const out = dismissedIds.has(p.user_id);
              const role = roleLabel(p.role_in_team);
              const locked = active || used;
              return (
                <li
                  key={p.user_id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-sm",
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-border/60 bg-muted/20",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {name.charAt(0)}
                    </span>
                    <span className="truncate font-semibold">{name}</span>
                    {role && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {role}
                      </span>
                    )}
                    {active && (
                      <span className="text-2xs font-medium text-emerald-700 dark:text-emerald-300">
                        {side === "batting" ? "Batting" : "Bowling"}
                      </span>
                    )}
                    {out && (
                      <span className="text-2xs font-medium text-rose-600 dark:text-rose-400">
                        Out
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${name} from squad`}
                    title={
                      locked
                        ? "Players who have taken part in this innings cannot be removed"
                        : "Remove from squad"
                    }
                    disabled={locked || busyId === p.user_id || isProcessing}
                    onClick={() => void remove(p.user_id, name)}
                  >
                    {busyId === p.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`new-player-${side}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Add a new player
        </label>
        <div className="flex gap-2">
          <Input
            id={`new-player-${side}`}
            name="playerName"
            autoComplete="off"
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createNew();
              }
            }}
            className="h-10"
          />
          <Button
            type="button"
            className="h-10 shrink-0 font-bold"
            onClick={() => void createNew()}
            disabled={!newName.trim() || isProcessing}
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`find-player-${side}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Or add a registered player
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`find-player-${side}`}
            name="playerSearch"
            autoComplete="off"
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        {activeQuery.length >= 2 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {searching && visibleResults.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                Searching…
              </li>
            ) : visibleResults.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No registered players match. Add them as a new player above.
              </li>
            ) : (
              visibleResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={busyId === u.id || isProcessing}
                    onClick={() => void addExisting(u.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-border/60 px-2.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {u.full_name ?? "Player"}
                      </span>
                      {u.username && (
                        <span className="block truncate font-mono text-2xs text-muted-foreground">
                          @{u.username}
                        </span>
                      )}
                    </span>
                    {busyId === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 text-primary" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * In-match squad management: see both XIs, add players (new or registered)
 * and remove anyone who has not yet taken part in the innings.
 */
export function SquadManagerDialog({
  open,
  onOpenChange,
  batting,
  bowling,
  activeIds,
  usedIds,
  dismissedIds,
  onCreatePlayer,
  onChanged,
  isProcessing,
}: SquadManagerDialogProps) {
  const [side, setSide] = useState<"batting" | "bowling">("batting");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-500" /> Squads
          </DialogTitle>
          <DialogDescription>
            Players added here are available immediately for batting and
            bowling.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={side}
          onValueChange={(v) => setSide(v as "batting" | "bowling")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="batting" className="truncate text-xs font-bold">
              {batting?.name ?? "Batting"} ({batting?.players.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="bowling" className="truncate text-xs font-bold">
              {bowling?.name ?? "Bowling"} ({bowling?.players.length ?? 0})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="batting" className="pt-3">
            {batting && (
              <SquadPanel
                side="batting"
                team={batting}
                activeIds={activeIds}
                usedIds={usedIds}
                dismissedIds={dismissedIds}
                onCreatePlayer={onCreatePlayer}
                onChanged={onChanged}
                isProcessing={isProcessing}
              />
            )}
          </TabsContent>
          <TabsContent value="bowling" className="pt-3">
            {bowling && (
              <SquadPanel
                side="bowling"
                team={bowling}
                activeIds={activeIds}
                usedIds={usedIds}
                dismissedIds={dismissedIds}
                onCreatePlayer={onCreatePlayer}
                onChanged={onChanged}
                isProcessing={isProcessing}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
