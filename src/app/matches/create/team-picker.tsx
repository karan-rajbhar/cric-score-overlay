"use client";

import { useId, useState } from "react";
import { Check, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn, deriveShortName } from "~/lib/utils";
import {
  matchesTeamQuery,
  sortByRecent,
  type SetupTeam,
  type TeamGroup,
} from "./match-setup";

export function playerCountLabel(count?: number | null) {
  if (count === null || count === undefined) return null;
  if (count === 0) return "No players yet";
  return count === 1 ? "1 player" : `${count} players`;
}

export type CreateTeamResult =
  | { team: SetupTeam; error: null }
  | { team: null; error: string };

interface TeamPickerProps {
  /** Visible label, e.g. "Your team". */
  label: string;
  /** Dialog title, e.g. "Choose your team". */
  title: string;
  value: string;
  selected?: SetupTeam;
  groups: TeamGroup[];
  recentIds: readonly string[];
  onChange: (teamId: string) => void;
  /** Creates a team and returns it; omit to hide "New team". */
  onCreate?: (name: string, shortName: string) => Promise<CreateTeamResult>;
  /** Shown when no team can be picked. */
  emptyMessage: string;
  disabled?: boolean;
}

export function TeamPicker({
  label,
  title,
  value,
  selected,
  groups,
  recentIds,
  onChange,
  onCreate,
  emptyMessage,
  disabled,
}: TeamPickerProps) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");

  const openPicker = () => {
    setQuery("");
    // Nothing to pick yet: go straight to creating one.
    setMode(groups.length === 0 && onCreate ? "create" : "list");
    setOpen(true);
  };

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const count = playerCountLabel(selected?.player_count);

  return (
    <div className="min-w-0">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-labelledby={`${labelId} ${labelId}-value`}
        aria-haspopup="dialog"
        className={cn(
          "mt-1.5 flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
          !value && "border-dashed",
        )}
      >
        <span id={`${labelId}-value`} className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-medium">
                {selected.name}
                {selected.short_name && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({selected.short_name})
                  </span>
                )}
              </span>
              {count && (
                <span className="block text-xs text-muted-foreground">
                  {count}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Choose a team</span>
          )}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-balance">
              {mode === "create" ? "New team" : title}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add players now or later, while scoring."
                : "Recent teams are listed first."}
            </DialogDescription>
          </DialogHeader>

          {mode === "list" ? (
            <TeamList
              query={query}
              onQueryChange={setQuery}
              groups={groups}
              recentIds={recentIds}
              value={value}
              onChoose={choose}
              emptyMessage={emptyMessage}
              onNew={onCreate ? () => setMode("create") : undefined}
            />
          ) : (
            <NewTeamForm
              initialName={query}
              onBack={groups.length > 0 ? () => setMode("list") : undefined}
              onCreate={async (name, shortName) => {
                const res = await onCreate!(name, shortName);
                if (res.team) choose(res.team.id);
                return res.error;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamList({
  query,
  onQueryChange,
  groups,
  recentIds,
  value,
  onChoose,
  emptyMessage,
  onNew,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  groups: TeamGroup[];
  recentIds: readonly string[];
  value: string;
  onChoose: (id: string) => void;
  emptyMessage: string;
  onNew?: () => void;
}) {
  const searchId = useId();
  const trimmed = query.trim();

  // Without a query, recently used teams get their own group on top.
  const recentSet = new Set(recentIds);
  const recent = trimmed
    ? []
    : sortByRecent(
        groups.flatMap((g) => g.teams).filter((t) => recentSet.has(t.id)),
        recentIds,
      )
        .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i)
        .slice(0, 4);
  const shownRecent = new Set(recent.map((t) => t.id));
  const visible: TeamGroup[] = [
    ...(recent.length > 0 ? [{ label: "Recent", teams: recent }] : []),
    ...groups.map((g) => ({
      label: g.label,
      teams: sortByRecent(
        g.teams.filter(
          (t) => !shownRecent.has(t.id) && matchesTeamQuery(t, trimmed),
        ),
        recentIds,
      ),
    })),
  ].filter((g) => g.teams.length > 0);
  const matches = visible.flatMap((g) => g.teams);

  return (
    <>
      {groups.length > 0 && (
        <div className="relative">
          <Label htmlFor={searchId} className="sr-only">
            Search teams
          </Label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.length === 1) {
                e.preventDefault();
                onChoose(matches[0]!.id);
              }
            }}
            placeholder="Search teams"
            autoComplete="off"
            className="pl-9"
            autoFocus
          />
        </div>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {groups.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : matches.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground" role="status">
            No team matches "{trimmed}".
          </p>
        ) : (
          visible.map((group) => (
            <div
              key={group.label}
              role="group"
              aria-label={group.label}
              className="mb-3 [content-visibility:auto]"
            >
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.teams.map((team) => {
                  const isSelected = team.id === value;
                  const count = playerCountLabel(team.player_count);
                  return (
                    <li key={team.id}>
                      <button
                        type="button"
                        onClick={() => onChoose(team.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {team.name}
                            {team.short_name && (
                              <span className="text-muted-foreground">
                                {" "}
                                ({team.short_name})
                              </span>
                            )}
                          </span>
                          {count && (
                            <span className="block text-xs text-muted-foreground">
                              {count}
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <Check
                            className="h-4 w-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {onNew && (
        <Button
          type="button"
          variant="outline"
          onClick={onNew}
          className="h-11 w-full justify-start"
        >
          <Plus className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
          {trimmed ? `New team "${trimmed}"` : "New team"}
        </Button>
      )}
    </>
  );
}

function NewTeamForm({
  initialName,
  onBack,
  onCreate,
}: {
  initialName: string;
  onBack?: () => void;
  /** Resolves to an error message, or null once the team is created. */
  onCreate: (name: string, shortName: string) => Promise<string | null>;
}) {
  const nameId = useId();
  const shortId = useId();
  const errorId = useId();
  const [name, setName] = useState(initialName.trim());
  // The short name follows the name until it is edited by hand.
  const [shortName, setShortName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveShort = shortName ?? deriveShortName(name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a team name");
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onCreate(name.trim(), effectiveShort.trim());
    if (failure) {
      setError(failure);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor={nameId}>Team name</Label>
        <Input
          id={nameId}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Mumbai Lions"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          className="mt-1.5"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor={shortId}>Short name</Label>
        <Input
          id={shortId}
          value={effectiveShort}
          onChange={(e) => setShortName(e.target.value.toUpperCase())}
          maxLength={5}
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="done"
          className="mt-1.5 w-28 uppercase"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on the scoreboard. Up to 5 letters.
        </p>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-11 flex-1"
            disabled={saving}
          >
            Back to list
          </Button>
        )}
        <Button type="submit" className="h-11 flex-1" disabled={saving}>
          {saving && (
            <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
          )}
          Create team
        </Button>
      </div>
    </form>
  );
}
