"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createPlayerQuick } from "../../teams/actions";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

/**
 * Inline "add players" for a team with a short squad, so a new side can
 * be filled in without leaving the form. Uses the same server action as
 * adding a player while scoring; the full squad manager stays on the
 * scoring screen and the team page.
 */
export function QuickPlayers({
  teamId,
  teamName,
  playerCount,
  onAdded,
}: {
  teamId: string;
  teamName: string;
  playerCount: number | null | undefined;
  onAdded: () => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a player name");
      return;
    }
    setSaving(true);
    setError(null);
    let res: Awaited<ReturnType<typeof createPlayerQuick>>;
    try {
      res = await createPlayerQuick(teamId, trimmed);
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
      return;
    } finally {
      setSaving(false);
    }
    if (res.error || !res.data) {
      setError(res.error ?? "The player could not be added");
      return;
    }
    setAdded((prev) => [...prev, res.data!.full_name]);
    setName("");
    onAdded();
    inputRef.current?.focus();
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
          placeholder="Player name"
          autoComplete="off"
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
          disabled={saving}
          className="h-10 shrink-0"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="ml-1">Add</span>
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {added.length > 0
          ? `Added: ${added.join(", ")}. `
          : "Press Enter after each name. "}
        {total} {total === 1 ? "player" : "players"} in the squad.
      </p>
    </div>
  );
}
