"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { Button as DsButton } from "~/components/ds/button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { addExistingPlayerQuick, createPlayerQuick } from "../../teams/actions";
import { PlayerSearchNote } from "~/components/players/player-search-note";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";
import { lookUpPlayers } from "~/lib/player-lookup";
import {
  foundPlayerHint,
  playerMatches,
  SUGGESTIONS_SHOWN,
  typedHandle,
  type FoundPlayer,
} from "~/lib/player-search";

/** Typed this many characters before the user's teammates are offered. */
const SEARCH_MIN = 2;
/** ... and before anyone else on CricScore is looked up (fewer strangers). */
const SEARCH_OTHERS_MIN = 3;
const normalize = (s: string) => s.trim().replace(/\s+/g, " ");

/** Existing players named like `query`, leaving out `exclude`. */
async function findExisting(
  query: string,
  exclude: ReadonlySet<string>,
): Promise<FoundPlayer[]> {
  const { players } = await lookUpPlayers(query);
  return players.filter((u) => !exclude.has(u.id)).slice(0, SUGGESTIONS_SHOWN);
}

/**
 * Inline "add players" for a team with a short squad, so a new side can
 * be filled in without leaving the form. Existing players named like what
 * is typed are offered first (with the matches they have played), and
 * Enter never adds a new player while one of them may be the same person:
 * a regular added by name every day would split their statistics. Uses
 * the same server actions as adding a player while scoring; the full squad
 * manager stays on the scoring screen and the team page.
 */
export function QuickPlayers({
  teamId,
  teamName,
  playerCount,
  existingIds = [],
  teammates = [],
  onAdded,
}: {
  teamId: string;
  teamName: string;
  playerCount: number | null | undefined;
  /** Players already in the team (not offered again). */
  existingIds?: readonly string[];
  /**
   * The people on the user's teams (`teammatesOf`): offered first, with
   * their teams, before anyone else of that name on CricScore.
   */
  teammates?: readonly FoundPlayer[];
  onAdded: (player: { id: string }) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ q: string; players: FoundPlayer[] }>({
    q: "",
    players: [],
  });
  // The name a search could not answer for, and a way to ask again.
  const [failedQ, setFailedQ] = useState("");
  const [attempt, setAttempt] = useState(0);

  const q = normalize(name);
  const lookup = open && q.length >= SEARCH_MIN ? q : "";
  const lookupOthers = q.length >= SEARCH_OTHERS_MIN ? lookup : "";
  const excludeKey = [...existingIds, ...added.map((a) => a.id)].join(",");

  // Existing players matching what is typed (debounced).
  useEffect(() => {
    if (!lookupOthers) return;
    let cancelled = false;
    const t = setTimeout(() => {
      findExisting(lookupOthers, new Set(excludeKey.split(","))).then(
        (players) => {
          if (!cancelled) setFound({ q: lookupOthers, players });
        },
        () => {
          if (!cancelled) setFailedQ(lookupOthers);
        },
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [lookupOthers, excludeKey, attempt]);
  const taken = new Set([...existingIds, ...added.map((a) => a.id)]);
  // People from the user's teams first (known without a read), then
  // anyone else on CricScore of that name.
  const fromTeams = lookup
    ? teammates
        .filter((p) => !taken.has(p.id) && playerMatches(lookup, p))
        .slice(0, SUGGESTIONS_SHOWN)
    : [];
  const fromTeamIds = new Set(fromTeams.map((p) => p.id));
  const others =
    lookupOthers && found.q === lookupOthers
      ? found.players.filter((p) => !fromTeamIds.has(p.id))
      : [];
  const suggestions = [...fromTeams, ...others];
  const searchFailed = Boolean(q) && failedQ === q && found.q !== q;
  const handle = typedHandle(q);

  // The page adds each new player to `playerCount` (via onAdded).
  const total = playerCount ?? 0;

  if (!open) {
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {total === 0 && <span>Add them now or while scoring.</span>}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-8 px-0 text-xs"
          onClick={() => setOpen(true)}
          aria-label={`Add players to ${teamName}`}
        >
          Add players
        </Button>
      </div>
    );
  }

  const run = async (
    key: string,
    action: () => ReturnType<typeof createPlayerQuick>,
  ) => {
    setSaving(key);
    setError(null);
    let res: Awaited<ReturnType<typeof createPlayerQuick>>;
    try {
      res = await action();
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      return;
    } finally {
      setSaving(null);
    }
    if (res.error || !res.data) {
      setError(res.error ?? "The player could not be added");
      return;
    }
    const player = { id: res.data.user_id, name: res.data.full_name };
    setAdded((prev) => [...prev, player]);
    setName("");
    setFound({ q: "", players: [] });
    onAdded({ id: player.id });
    inputRef.current?.focus();
  };

  const addExisting = (p: FoundPlayer) =>
    run(p.id, () => addExistingPlayerQuick(teamId, p.id));
  const addNew = () => run("new", () => createPlayerQuick(teamId, q));

  // Enter / Add: a new player only once no existing one may be the same
  // person (asks the search first if it has not answered for this name).
  const add = async () => {
    if (!q) {
      setError("Enter a player name");
      return;
    }
    if (fromTeams.length) return;
    if (q.length >= SEARCH_OTHERS_MIN && found.q !== q) {
      setSaving("search");
      let players: FoundPlayer[];
      try {
        players = await findExisting(
          q,
          new Set([...existingIds, ...added.map((a) => a.id)]),
        );
      } catch {
        // Nobody is added on a guess: the box says it could not check, and
        // adding them as new is one tap away.
        setFailedQ(q);
        return;
      } finally {
        setSaving(null);
      }
      setFound({ q, players });
      if (players.length) return;
    } else if (suggestions.length) {
      return;
    }
    // "@name" finds someone; it cannot be a new player's name.
    if (handle !== null) {
      setError(`Nobody has the username ${q}. Type a name to add a new player.`);
      return;
    }
    await addNew();
  };

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-3">
      <Label htmlFor={inputId} className="text-xs">
        Add a player to {teamName}
      </Label>
      <div className="mt-1.5 flex gap-2">
        <Input
          ref={inputRef}
          id={inputId}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!saving) void add();
            }
          }}
          placeholder="Name or @username"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="words"
          enterKeyHint="enter"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1"
          autoFocus
        />
        <Button
          type="button"
          onClick={() => void add()}
          disabled={Boolean(saving)}
          className="h-10 shrink-0"
        >
          {saving === "new" || saving === "search" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="ml-1">Add</span>
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Is it one of these? Pick the same person instead of adding them
            twice.
          </p>
          <SuggestionGroup
            label="From your teams"
            players={fromTeams}
            saving={saving}
            onPick={(p) => void addExisting(p)}
          />
          <SuggestionGroup
            label="Other players on CricScore"
            note="Pick one only if you know it's the same person."
            players={others}
            saving={saving}
            onPick={(p) => void addExisting(p)}
          />
          {handle === null && (
            <DsButton
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={Boolean(saving)}
              loading={saving === "new"}
              onClick={() => void addNew()}
            >
              <Plus aria-hidden="true" />
              <span className="min-w-0 truncate">
                Add “{q}” as a new player
              </span>
            </DsButton>
          )}
        </div>
      )}
      {searchFailed && suggestions.length === 0 && (
        <div className="mt-2 space-y-1">
          <PlayerSearchNote
            search={{
              status: "failed",
              more: false,
              retry: () => {
                setFailedQ("");
                setAttempt((n) => n + 1);
              },
            }}
            query={q}
            listed={0}
          />
          {handle === null && (
            <DsButton
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={Boolean(saving)}
              loading={saving === "new"}
              onClick={() => void addNew()}
            >
              <Plus aria-hidden="true" />
              <span className="min-w-0 truncate">
                Add “{q}” as a new player
              </span>
            </DsButton>
          )}
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {added.length > 0
          ? `Added: ${added.map((a) => a.name).join(", ")}. `
          : "Press Enter after each name. "}
        {total} {total === 1 ? "player" : "players"} in the squad.
      </p>
    </div>
  );
}

/** One group of existing players to pick from, with who each one is. */
function SuggestionGroup({
  label,
  note,
  players,
  saving,
  onPick,
}: {
  label: string;
  note?: string;
  players: readonly FoundPlayer[];
  saving: string | null;
  onPick: (p: FoundPlayer) => void;
}) {
  if (!players.length) return null;
  return (
    <div role="group" aria-label={label} className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">
        {label}
        {note && (
          <span className="font-normal text-muted-foreground"> · {note}</span>
        )}
      </p>
      {players.map((p) => (
        <DsButton
          key={p.id}
          type="button"
          variant="outline"
          size="sm"
          className="h-auto min-h-11 w-full justify-start rounded-xl py-1.5"
          disabled={Boolean(saving)}
          loading={saving === p.id}
          onClick={() => onPick(p)}
        >
          <UserPlus aria-hidden="true" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate">Add {p.name}</span>
            <span className="block truncate text-xs font-normal tabular-nums text-muted-foreground">
              {foundPlayerHint(p)}
            </span>
          </span>
        </DsButton>
      ))}
    </div>
  );
}
