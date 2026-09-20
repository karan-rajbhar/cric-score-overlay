"use client";

import { useState } from "react";
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
import { Calendar, Plus, Trash2, Loader2 } from "lucide-react";
import { createSeason, deleteSeason } from "~/app/clubs/actions";
import { toast } from "sonner";

interface SeasonDialogProps {
  clubId: string;
}

export function SeasonDialog({ clubId }: SeasonDialogProps) {
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
        toast.success(`Created season ${name}!`);
        setOpen(false);
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
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          New Season
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Season Management
            </span>
          </div>
          <DialogTitle className="text-xl">Create Club Season</DialogTitle>
          <DialogDescription>
            Organize tournaments, team rosters, and stats under a periodic
            season or quarter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="seasonName">Season Name</Label>
            <Input
              id="seasonName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2025/26 Season, Summer League 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start Date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End Date</Label>
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
              Set as current active season
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Creating..." : "Create Season"}
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

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete season "${seasonName}"?`)) return;

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
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={handleDelete}
      className="h-6 w-6 text-muted-foreground hover:text-destructive"
      title={`Delete season "${seasonName}"`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

