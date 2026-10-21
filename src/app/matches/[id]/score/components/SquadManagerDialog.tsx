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
import { removePlayerFromTeam, searchUsers } from "~/app/teams/actions";
import type { TeamPlayer } from "~/lib/match-types";
import { roleLabel } from "./player-rows";

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
  /** Ids of players who have batted or bowled in this match. */
  usedIds: Set<string>;
  dismissedIds: Set<string>;
  /**
   * Adds a player to the side: a brand-new record named `name`, or with
   * `existingId` that registered player (the scorer's route, so the match's
   * co-scorers may add players too).
   */
  onCreatePlayer: (
    side: "batting" | "bowling",
    name: string,
    existingId?: string,
  ) => Promise<unknown>;
  /** Called after any roster change so the page can reload squads. */
  onChanged: () => Promise<void> | void;
  isProcessing: boolean;
  /** Squad changes need the server; they are disabled while offline. */
  isOffline?: boolean;
}

type FoundUser = {
  id: string;
  full_name?: string;
  username?: string | null;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function SquadPanel({
  side,
  team,
  activeIds,
  usedIds,
  dismissedIds,
  onCreatePlayer,
  onChanged,
  isProcessing,
  isOffline,
}: {
  side: "batting" | "bowling";
  team: SquadTeam;
  activeIds: Set<string>;
  usedIds: Set<string>;
  dismissedIds: Set<string>;
  onCreatePlayer: SquadManagerDialogProps["onCreatePlayer"];
  onChanged: SquadManagerDialogProps["onChanged"];
  isProcessing: boolean;
  isOffline: boolean;
}) {
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
  const searchable = activeQuery.length >= 2 && !isOffline;
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await searchUsers(activeQuery);
        if (!cancelled) {
          setResults(
            ((data ?? []) as FoundUser[]).filter((u) => !rosterIds.has(u.id)),
          );
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activeQuery, searchable, rosterIds]);
  const visibleResults = searchable ? results : [];

  const q = normalize(query);
  const filtered = q
    ? team.players.filter((p) => normalize(p.user?.full_name ?? "").includes(q))
    : team.players;
  const hasPlayed = (id: string) => activeIds.has(id) || usedIds.has(id);
  const played = filtered.filter((p) => hasPlayed(p.user_id));
  const yetToPlay = filtered.filter((p) => !hasPlayed(p.user_id));
  const duplicate = q
    ? team.players.find((p) => normalize(p.user?.full_name ?? "") === q)
    : undefined;

  const addExisting = async (u: FoundUser) => {
    if (isOffline) return;
    setBusyId(u.id);
    try {
      await onCreatePlayer(side, u.full_name ?? "Player", u.id);
      setQuery("");
      setResults([]);
    } finally {
      setBusyId(null);
    }
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
    const name = query.trim().replace(/\s+/g, " ");
    if (!name || isOffline) return;
    setBusyId("new");
    try {
      await onCreatePlayer(side, name);
      setQuery("");
      setResults([]);
    } finally {
      setBusyId(null);
    }
  };

  const renderRow = (p: TeamPlayer) => {
    const name = p.user?.full_name ?? "Player";
    const active = activeIds.has(p.user_id);
    const out = dismissedIds.has(p.user_id);
    const role = roleLabel(p.role_in_team);
    // Players who have taken part cannot be removed, so no button for them.
    const removable = !hasPlayed(p.user_id);
    return (
      <li
        key={p.user_id}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-border/60 py-1 pl-3 pr-1 text-sm [contain-intrinsic-size:auto_44px] [content-visibility:auto]"
      >
        <span className="min-w-0 flex-1 truncate font-medium">
          {name}
          {role && (
            <span className="ml-1 font-normal text-muted-foreground">
              {role}
            </span>
          )}
        </span>
        {active && (
          <span className="shrink-0 text-xs text-primary">
            {side === "batting" ? "Batting" : "Bowling"}
          </span>
        )}
        {out && (
          <span className="shrink-0 pr-2 text-xs text-destructive">
            Out
          </span>
        )}
        {removable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${name} from squad`}
            title="Remove from squad"
            disabled={busyId === p.user_id || isProcessing || isOffline}
            onClick={() => void remove(p.user_id, name)}
          >
            {busyId === p.user_id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          id={`find-player-${side}`}
          type="search"
          name="playerSearch"
          autoComplete="off"
          aria-label={`Find or add a player for ${team.name}`}
          placeholder="Find or add a player"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q && filtered.length === 0) {
              e.preventDefault();
              void createNew();
            }
          }}
          className="h-11 pl-9 text-base sm:text-sm"
        />
      </div>

      {q && (
        <div className="space-y-1">
          {duplicate && (
            <p className="text-xs text-warning">
              {duplicate.user?.full_name} is already in {team.name}. Add another
              player only if this is a different person.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full justify-start gap-2"
            disabled={isProcessing || isOffline || busyId === "new"}
            onClick={() => void createNew()}
          >
            {busyId === "new" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            <span className="truncate">
              {duplicate ? "Add another" : "Add"} “{query.trim()}” as a new
              player
            </span>
          </Button>
        </div>
      )}
      {isOffline && (
        <p className="text-xs text-muted-foreground">
          Changing squads needs a connection.
        </p>
      )}

      {(visibleResults.length > 0 || (searchable && searching)) && (
        <section aria-label="Registered players" className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            On CricScore
          </p>
          {searching && visibleResults.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Searching…
            </p>
          ) : (
            <ul className="space-y-1 sm:max-h-40 sm:overflow-y-auto">
              {visibleResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={busyId === u.id || isProcessing}
                    onClick={() => void addExisting(u)}
                    aria-label={`Add ${u.full_name ?? "player"} to ${team.name}`}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {u.full_name ?? "Player"}
                      </span>
                      {u.username && (
                        <span className="block truncate text-xs text-muted-foreground">
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
              ))}
            </ul>
          )}
        </section>
      )}

      {team.players.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No players in {team.name} yet. Type a name above to add one.
        </p>
      ) : (
        <div className="space-y-3 sm:max-h-[42dvh] sm:overflow-y-auto sm:overscroll-contain">
          {yetToPlay.length > 0 && (
            <section aria-label="Yet to play" className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Yet to play ({yetToPlay.length})
                </p>
                {!q && team.players.length < 11 && (
                  <span className="text-xs text-warning">
                    {11 - team.players.length} short of XI
                  </span>
                )}
              </div>
              <ul className="space-y-1">{yetToPlay.map(renderRow)}</ul>
            </section>
          )}
          {played.length > 0 && (
            <section aria-label="Played in this match" className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Played in this match ({played.length}), cannot be removed
              </p>
              <ul className="space-y-1">{played.map(renderRow)}</ul>
            </section>
          )}
          {q && filtered.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              Nobody in {team.name} matches “{query.trim()}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * In-match squad management: see both squads, find, add (new or
 * registered) and remove anyone who has not yet taken part in the match.
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
  isOffline = false,
}: SquadManagerDialogProps) {
  const [side, setSide] = useState<"batting" | "bowling">("batting");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden />{" "}
            Squads
          </DialogTitle>
          <DialogDescription>
            New players can bat or bowl straight away.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={side}
          onValueChange={(v) => setSide(v as "batting" | "bowling")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              value="batting"
              className="truncate text-xs font-medium"
            >
              {batting?.name ?? "Batting"} ({batting?.players.length ?? 0})
            </TabsTrigger>
            <TabsTrigger
              value="bowling"
              className="truncate text-xs font-medium"
            >
              {bowling?.name ?? "Bowling"} ({bowling?.players.length ?? 0})
            </TabsTrigger>
          </TabsList>
          {(["batting", "bowling"] as const).map((s) => {
            const team = s === "batting" ? batting : bowling;
            return (
              <TabsContent key={s} value={s} className="pt-3">
                {team && (
                  <SquadPanel
                    side={s}
                    team={team}
                    activeIds={activeIds}
                    usedIds={usedIds}
                    dismissedIds={dismissedIds}
                    onCreatePlayer={onCreatePlayer}
                    onChanged={onChanged}
                    isProcessing={isProcessing}
                    isOffline={isOffline}
                  />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
