"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { TeamLogoEditor } from "~/components/teams/team-logo-editor";
import { TeamColourPicker } from "~/components/teams/team-colour-picker";
import { isTeamColor } from "~/lib/team-colors";
import { updateTeam } from "~/app/teams/actions";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

export interface EditableTeam {
  id: string;
  name: string;
  short_name?: string | null;
  description?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

/**
 * Edits a team's name, short name, description and logo, for those who
 * manage it (the server checks again). Matches show the new name from the
 * next page load; live ones are told at once.
 */
export function EditTeamDialog({ team }: { team: EditableTeam }) {
  const router = useRouter();
  const ids = { name: useId(), short: useId(), about: useId(), error: useId() };
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name);
  const [shortName, setShortName] = useState(team.short_name ?? "");
  const [description, setDescription] = useState(team.description ?? "");
  const [primary, setPrimary] = useState(team.primary_color ?? "");
  const [secondary, setSecondary] = useState(team.secondary_color ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    if (next) {
      setName(team.name);
      setShortName(team.short_name ?? "");
      setDescription(team.description ?? "");
      setPrimary(team.primary_color ?? "");
      setSecondary(team.secondary_color ?? "");
      setError(null);
    } else {
      // The logo saves on its own: show it on the page.
      router.refresh();
    }
    setOpen(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a team name");
      return;
    }
    if (
      [primary, secondary].some((c) => c.trim() !== "" && !isTeamColor(c))
    ) {
      setError("Team colours must look like #1a2b3c");
      return;
    }
    setError(null);
    startTransition(async () => {
      let res: Awaited<ReturnType<typeof updateTeam>>;
      try {
        res = await updateTeam(team.id, {
          name,
          shortName,
          description,
          primaryColor: primary.trim() || null,
          secondaryColor: secondary.trim() || null,
        });
      } catch {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success("Team saved");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-1.5">
          <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
          Edit team
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader className="text-left">
            <DialogTitle className="text-balance">Edit team</DialogTitle>
            <DialogDescription>
              Scorecards and fixtures show the new name.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            <TeamLogoEditor
              teamId={team.id}
              teamName={name || team.name}
              shortName={shortName || team.short_name}
              logoUrl={team.logo_url}
            />
          </div>

          <div>
            <Label htmlFor={ids.name}>Team name</Label>
            <Input
              id={ids.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoComplete="off"
              autoCapitalize="words"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? ids.error : undefined}
              className="mt-1.5"
              required
            />
          </div>
          <div>
            <Label htmlFor={ids.short}>Short name</Label>
            <Input
              id={ids.short}
              value={shortName}
              onChange={(e) => setShortName(e.target.value.toUpperCase())}
              maxLength={Math.max(5, team.short_name?.length ?? 0)}
              autoComplete="off"
              autoCapitalize="characters"
              aria-describedby={`${ids.short}-hint`}
              className="mt-1.5 w-28 uppercase"
            />
            <p
              id={`${ids.short}-hint`}
              className="mt-1 text-xs text-muted-foreground"
            >
              Shown on the scoreboard. Up to 5 letters.
            </p>
          </div>
          <div>
            <Label htmlFor={ids.about}>About the team</Label>
            <Textarea
              id={ids.about}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Team colours</legend>
            <TeamColourPicker
              shortName={shortName || team.short_name || ""}
              primary={primary}
              secondary={secondary}
              onPrimaryChange={setPrimary}
              onSecondaryChange={setSecondary}
            />
          </fieldset>

          {error && (
            <p id={ids.error} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
