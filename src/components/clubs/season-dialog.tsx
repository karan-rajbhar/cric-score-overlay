"use client";

import { useState } from "react";
import { useConfirm } from "~/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CalendarRange, Trash2, Loader2 } from "lucide-react";
import { Chip } from "~/components/ds/chip";
import { createSeason, deleteSeason } from "~/app/clubs/actions";
import { toast } from "sonner";

interface SeasonDialogProps {
  clubId: string;
  /** The club's seasons, listed with a way to delete each but the current. */
  seasons?: readonly { id: string; name: string; is_current?: boolean | null }[];
}

/**
 * The club's seasons in one place (T5): the list, each past one with a
 * 44px delete, and a form for a new one. The header shows only the
 * current season; it used to carry every season as a chip with a 24px bin.
 */
export function SeasonDialog({ clubId, seasons = [] }: SeasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a season name");
      return;
    }

    setIsSaving(true);
    try {
      const res = await createSeason(
        clubId,
        name,
        startDate,
        endDate,
        isCurrent,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Created season ${name}`);
        setName("");
        setStartDate("");
        setEndDate("");
      }
    } catch (err) {
      console.error("Season creation error:", err);
      toast.error("Failed to create season");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
          Seasons
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seasons</DialogTitle>
          <DialogDescription>
            Tournaments and statistics can be grouped by season.
          </DialogDescription>
        </DialogHeader>

        {seasons.length > 0 && (
          <ul aria-label="Seasons" className="divide-y divide-border rounded-xl ring-1 ring-border/60">
            {seasons.map((season) => (
              <li
                key={season.id}
                className="flex min-h-11 items-center gap-2 py-1 pl-3 pr-1 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{season.name}</span>
                {season.is_current ? (
                  <Chip tone="primary" className="mr-2">
                    Current
                  </Chip>
                ) : (
                  <DeleteSeasonButton
                    clubId={clubId}
                    seasonId={season.id}
                    seasonName={season.name}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 py-2">
          <h3 className="text-sm font-semibold text-foreground">New season</h3>
          <div className="space-y-2">
            <Label htmlFor="seasonName">Season name</Label>
            <Input
              id="seasonName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2025/26 Season, Summer League 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End date</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isCurrent"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="rounded border-border"
            />
            <Label
              htmlFor="isCurrent"
              className="cursor-pointer text-sm font-normal"
            >
              Make it the current season
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Adding…" : "Add season"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSeasonButton({
  clubId,
  seasonId,
  seasonName,
}: {
  clubId: string;
  seasonId: string;
  seasonName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [ask, confirmDialog] = useConfirm();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await ask({
      title: `Delete the season ${seasonName}?`,
      description: "Its matches and their records stay.",
      cancelLabel: "Keep season",
      confirmLabel: "Delete season",
      destructive: true,
    });
    if (!ok) return;

    setLoading(true);
    try {
      const res = await deleteSeason(seasonId, clubId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Deleted season "${seasonName}"`);
      }
    } catch (err) {
      console.error("Failed to delete season:", err);
      toast.error("Failed to delete season");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {confirmDialog}
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={handleDelete}
      className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
      aria-label={`Delete the season ${seasonName}`}
      title={`Delete the season ${seasonName}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
    </>
  );
}

