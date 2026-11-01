"use client";

import {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { PlayerSearchNote } from "~/components/players/player-search-note";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { usePlayerSearch } from "~/lib/hooks/usePlayerSearch";
import {
  foundPlayerHint,
  playerMatches,
  SUGGESTIONS_SHOWN,
  typedHandle,
  whyNotAddable,
  type FoundPlayer,
  type PlayerSearchResult,
} from "~/lib/player-search";
import { cn } from "~/lib/utils";
import type { PickerRow } from "./player-rows";

/** An existing player who is in neither squad yet. */
export type { FoundPlayer };

/**
 * Finds registered players for "Add" (the scoring screen provides it, saying
 * which squad each is in and who they played for); without it only a new
 * player can be added.
 */
export const PlayerSearchContext = createContext<
  ((query: string) => Promise<PlayerSearchResult>) | null
>(null);

/** Typed this many characters before registered players are looked up. */
const SEARCH_MIN = 2;

export interface PickerAddPlayer {
  /** Team the new player joins, shown on the add button. */
  teamName: string;
  /**
   * Adds the player: a new one named `name`, or the registered player
   * `existingId`. Resolves to their id, or null on failure.
   */
  onAdd: (name: string, existingId?: string) => Promise<string | null>;
  /** When set (e.g. offline), adding is disabled and this is shown instead. */
  disabledReason?: string | null;
}

interface PlayerPickerProps {
  /** Accessible name of the list. */
  label: string;
  rows: PickerRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Enter on a row: select it and confirm (the dialog decides what that means). */
  onSubmit?: (id: string) => void;
  addPlayer?: PickerAddPlayer;
  /** Show the search box once the list is longer than this. */
  searchThreshold?: number;
  /** Why the list is empty; by default, that the squad is. */
  emptyMessage?: string;
  /**
   * Show each row's @username (telling people apart is the point of the
   * list). Otherwise only rows sharing a name show it, or a "@" search.
   */
  showUsernames?: boolean;
  /** What the rows are, for the search box: "batter", "bowler", "fielder". */
  noun?: string;
  className?: string;
}

/**
 * Dialog `onOpenAutoFocus` handler: focus the picker's current row instead
 * of the search box, so phones do not open the keyboard over the list.
 */
export function focusPickerRow(e: Event, container: HTMLElement | null) {
  const row = container?.querySelector<HTMLElement>(
    '[role="radio"][tabindex="0"]',
  );
  if (!row) return;
  e.preventDefault();
  row.focus();
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Phone-first player list shared by the scoring dialogs: 44px rows with role
 * and today's figures, disabled rows that say why, search for long lists and
 * inline "Add <name>" when nobody matches.
 */
export function PlayerPicker({
  label,
  rows,
  selectedId,
  onSelect,
  onSubmit,
  addPlayer,
  searchThreshold = 8,
  emptyMessage,
  showUsernames = false,
  noun = "player",
  className,
}: PlayerPickerProps) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const findPlayers = useContext(PlayerSearchContext);

  const showSearch = Boolean(addPlayer) || rows.length > searchThreshold;
  const q = normalize(query);
  const handle = typedHandle(q);
  const canAdd = Boolean(addPlayer && q && !addPlayer.disabledReason);

  // Registered players matching what is typed, so the scorer adds the
  // person who already has a profile instead of a second one.
  const searchable = (handle ?? q).length >= SEARCH_MIN;
  const lookup = canAdd && findPlayers && searchable ? q : "";
  const search = usePlayerSearch(lookup, findPlayers ?? undefined);
  const foundIds = new Set(search.players.map((p) => p.id));

  // Whoever the search found in this list shows here, even if the row
  // itself cannot tell (no username on it).
  const visible = q
    ? rows.filter((r) => playerMatches(q, r) || foundIds.has(r.id))
    : rows;
  const exactMatch = q ? rows.find((r) => normalize(r.name) === q) : undefined;
  const firstEnabled = visible.find((r) => !r.disabledReason);
  const focusId =
    visible.find((r) => r.id === selectedId && !r.disabledReason)?.id ??
    firstEnabled?.id;

  const elsewhere = search.players.filter(
    (p) => !rows.some((r) => r.id === p.id),
  );
  const suggestions = elsewhere.slice(0, SUGGESTIONS_SHOWN);
  const moreElsewhere = search.more || elsewhere.length > SUGGESTIONS_SHOWN;

  // A new player waits for the search: nobody is added twice because the
  // answer was still on its way. A "@" text finds people, it names no one.
  const canAddNew =
    canAdd && handle === null && search.status !== "searching";

  const repeatedNames = useMemo(() => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const r of rows) {
      const name = normalize(r.name);
      if (seen.has(name)) repeated.add(name);
      seen.add(name);
    }
    return repeated;
  }, [rows]);
  const usernameOf = (row: PickerRow) =>
    row.username &&
    (showUsernames || handle !== null || repeatedNames.has(normalize(row.name)))
      ? `@${row.username}`
      : null;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    const rowsEls =
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-player-id]");
    rowsEls?.forEach((el) => {
      if (el.dataset.playerId === id) el.focus();
    });
  };

  const add = async (existing?: FoundPlayer) => {
    if (!addPlayer || !canAdd || adding) return;
    const name = existing?.name ?? query.trim().replace(/\s+/g, " ");
    setAdding(existing?.id ?? "new");
    try {
      const id = existing
        ? await addPlayer.onAdd(name, existing.id)
        : await addPlayer.onAdd(name);
      if (id) {
        onSelect(id);
        setQuery("");
      }
    } finally {
      setAdding(null);
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusRow(focusId);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (firstEnabled) {
        onSelect(firstEnabled.id);
        focusRow(firstEnabled.id);
      } else if (
        canAddNew &&
        search.status !== "failed" &&
        suggestions.length === 0
      ) {
        // With registered players listed, or none to go by, the scorer
        // picks one or taps "new player": Enter does not guess.
        void add();
      }
    }
  };

  const onRowKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const enabled = visible.filter((r) => !r.disabledReason);
    const at = enabled.findIndex((r) => r.id === id);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = enabled[at + step];
      if (next) focusRow(next.id);
      else if (step === -1 && showSearch)
        document.getElementById(inputId)?.focus();
    } else if (e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSelect(id);
      onSubmit(id);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showSearch && (
        // On phones the list does not scroll on its own (the dialog does:
        // one scroll), so the search stays pinned at the top while it moves.
        <div className="max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:-mx-1 max-sm:bg-card max-sm:px-1 max-sm:py-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              id={inputId}
              type="search"
              name="player-search"
              autoComplete="off"
              enterKeyHint={firstEnabled ? "go" : "done"}
              aria-label={
                addPlayer ? `Search or add a ${noun}` : `Search ${noun}s`
              }
              placeholder={
                addPlayer ? "Search name or @username" : `Search ${noun}s`
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              className="h-11 pl-9 text-base sm:text-sm"
            />
          </div>
          {/* Right under the search box (pinned with it on phones), so
              "Add <name>" shows while the keyboard is open instead of
              below the list, out of sight. */}
          <div className="mt-2 space-y-2 empty:hidden">
            {addPlayer && q && (
              <div className="space-y-1">
                {exactMatch && (
                  <p className="text-xs text-warning">
                    {exactMatch.name} is already in {addPlayer.teamName}. Add
                    another player only if this is a different person.
                  </p>
                )}
                {suggestions.length > 0 && (
                  <div
                    role="group"
                    aria-label="Existing players"
                    className="space-y-1"
                  >
                    <p className="px-1 text-xs text-muted-foreground">
                      Existing players on CricScore. Pick one only if you know
                      it&apos;s the same person; otherwise add a new player.
                    </p>
                    {suggestions.map((p) => {
                      const blocked = whyNotAddable(p, addPlayer.teamName);
                      return (
                        <Button
                          key={p.id}
                          type="button"
                          variant="outline"
                          className="h-auto min-h-11 w-full justify-start gap-2 py-1.5"
                          disabled={Boolean(adding) || blocked !== null}
                          onClick={() => void add(p)}
                        >
                          {adding === p.id ? (
                            <Loader2
                              className="h-4 w-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <UserPlus
                              className={cn("h-4 w-4", blocked && "invisible")}
                              aria-hidden
                            />
                          )}
                          {/* Two lines: the name is how the scorer knows
                              them, so a hint must not squeeze it. */}
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate">
                              {blocked
                                ? p.name
                                : `Add ${p.name} to ${addPlayer.teamName}`}
                            </span>
                            <span className="block truncate text-xs font-normal tabular-nums text-muted-foreground">
                              {blocked ?? foundPlayerHint(p)}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
                {lookup && (
                  <PlayerSearchNote
                    search={{ ...search, more: moreElsewhere }}
                    query={query.trim()}
                    listed={suggestions.length + visible.length}
                  />
                )}
                {handle === null && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start gap-2"
                    disabled={!canAddNew || Boolean(adding)}
                    onClick={() => void add()}
                  >
                    {adding === "new" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <UserPlus className="h-4 w-4" aria-hidden />
                    )}
                    <span className="truncate">
                      {exactMatch ? "Add another" : "Add"} “{query.trim()}”{" "}
                      {suggestions.length > 0 &&
                        !exactMatch &&
                        "as a new player "}
                      to {addPlayer.teamName}
                    </span>
                  </Button>
                )}
              </div>
            )}
            {addPlayer?.disabledReason && (q || rows.length === 0) && (
              <p className="text-xs text-muted-foreground">
                {addPlayer.disabledReason}
              </p>
            )}
          </div>
        </div>
      )}

      <div
        ref={listRef}
        role="radiogroup"
        aria-label={label}
        className="space-y-1 sm:max-h-[min(42dvh,22rem)] sm:overflow-y-auto sm:overscroll-contain"
      >
        {visible.map((row) => {
          const selected = row.id === selectedId;
          const disabled = Boolean(row.disabledReason);
          return (
            <button
              key={row.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={[
                row.role ? `${row.name} ${row.role}` : row.name,
                usernameOf(row),
                row.tag,
                row.note,
                row.detail,
                row.disabledReason,
              ]
                .filter(Boolean)
                .join(", ")}
              data-player-id={row.id}
              disabled={disabled}
              tabIndex={row.id === focusId ? 0 : -1}
              onClick={() => onSelect(row.id)}
              onKeyDown={(e) => onRowKeyDown(e, row.id)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors [contain-intrinsic-size:auto_44px] [content-visibility:auto] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border/70 bg-background hover:bg-muted",
                disabled && "cursor-not-allowed bg-muted/30 hover:bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  disabled && "text-muted-foreground",
                )}
              >
                {row.name}
                {row.role && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    {row.role}
                  </span>
                )}
                {usernameOf(row) && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    {usernameOf(row)}
                  </span>
                )}
              </span>
              {row.tag && (
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {row.tag}
                </span>
              )}
              {row.note && (
                <span className="shrink-0 text-xs text-warning">
                  {row.note}
                </span>
              )}
              {row.detail && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {row.detail}
                </span>
              )}
              {row.disabledReason && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.disabledReason}
                </span>
              )}
              {selected && (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              )}
            </button>
          );
        })}

        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            {emptyMessage ??
              (addPlayer && !addPlayer.disabledReason
                ? `No players in ${addPlayer.teamName} yet. Type a name to add one.`
                : "No players in this squad yet.")}
          </p>
        )}
        {rows.length > 0 && q && visible.length === 0 && !lookup && (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            No player matches “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
