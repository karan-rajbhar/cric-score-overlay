"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import type { PickerRow } from "./player-rows";

export interface PickerAddPlayer {
  /** Team the new player joins, shown on the add button. */
  teamName: string;
  /** Creates the player; resolves to the new player's id, or null on failure. */
  onAdd: (name: string) => Promise<string | null>;
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
  emptyMessage?: string;
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
  emptyMessage = "No players in this squad yet.",
  noun = "player",
  className,
}: PlayerPickerProps) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const showSearch = Boolean(addPlayer) || rows.length > searchThreshold;
  const q = normalize(query);
  const visible = q ? rows.filter((r) => normalize(r.name).includes(q)) : rows;
  const exactMatch = q ? rows.find((r) => normalize(r.name) === q) : undefined;
  const firstEnabled = visible.find((r) => !r.disabledReason);
  const focusId =
    visible.find((r) => r.id === selectedId && !r.disabledReason)?.id ??
    firstEnabled?.id;

  const canAdd = Boolean(addPlayer && q && !addPlayer.disabledReason);

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    const rowsEls =
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-player-id]");
    rowsEls?.forEach((el) => {
      if (el.dataset.playerId === id) el.focus();
    });
  };

  const add = async () => {
    if (!addPlayer || !canAdd || adding) return;
    const name = query.trim().replace(/\s+/g, " ");
    setAdding(true);
    try {
      const id = await addPlayer.onAdd(name);
      if (id) {
        onSelect(id);
        setQuery("");
      }
    } finally {
      setAdding(false);
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
      } else if (canAdd) {
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
              id={inputId}
              type="search"
              name="player-search"
              autoComplete="off"
              enterKeyHint={firstEnabled ? "go" : "done"}
              aria-label={
                addPlayer ? `Search or add a ${noun}` : `Search ${noun}s`
              }
              placeholder={
                addPlayer ? `Search or add a ${noun}` : `Search ${noun}s`
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
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {exactMatch.name} is already in {addPlayer.teamName}. Add
                    another player only if this is a different person.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-start gap-2"
                  disabled={!canAdd || adding}
                  onClick={() => void add()}
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <UserPlus className="h-4 w-4" aria-hidden />
                  )}
                  <span className="truncate">
                    {exactMatch ? "Add another" : "Add"} “{query.trim()}” to{" "}
                    {addPlayer.teamName}
                  </span>
                </Button>
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
              </span>
              {row.tag && (
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {row.tag}
                </span>
              )}
              {row.note && (
                <span className="shrink-0 text-xs text-amber-700 dark:text-amber-400">
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
            {addPlayer && !addPlayer.disabledReason
              ? `No players in ${addPlayer.teamName} yet. Type a name to add one.`
              : emptyMessage}
          </p>
        )}
        {rows.length > 0 && q && visible.length === 0 && (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            No player matches “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  );
}
