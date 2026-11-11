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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { inductHallOfFame, removeHallOfFame } from "~/app/clubs/actions";
import { toast } from "sonner";

interface MemberOption {
  id: string; // user id
  name: string;
}

interface HallOfFameDialogProps {
  clubId: string;
  members: MemberOption[];
}

export function HallOfFameDialog({ clubId, members }: HallOfFameDialogProps) {
  const [open, setOpen] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [category, setCategory] = useState("legend");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [seasonOrYear, setSeasonOrYear] = useState("");
  const [recordMetric, setRecordMetric] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!playerId) {
      toast.error("Choose who to add");
      return;
    }
    if (!title.trim()) {
      toast.error("Give the honour a title");
      return;
    }

    setIsSaving(true);
    try {
      const res = await inductHallOfFame(clubId, {
        playerId,
        category,
        title,
        description,
        seasonOrYear,
        recordMetric,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Added to the hall of fame");
        setOpen(false);
        setTitle("");
        setDescription("");
        setRecordMetric("");
        setSeasonOrYear("");
      }
    } catch (err) {
      console.error("Hall of Fame induction error:", err);
      toast.error("Could not add them to the hall of fame");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add to hall of fame
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {/* Sentence case, as the tab says "Hall of fame" (T11). */}
          <DialogTitle className="text-xl">Add to the hall of fame</DialogTitle>
          <DialogDescription>
            Recognise a player for a record, a title or long service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="player">Member</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger id="player">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legend">Club legend (general)</SelectItem>
                <SelectItem value="top_scorer">
                  All-time top run scorer
                </SelectItem>
                <SelectItem value="top_wicket_taker">
                  Record wicket taker
                </SelectItem>
                <SelectItem value="champion">Championship winner</SelectItem>
                <SelectItem value="record">Historic milestone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Honour</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. First captain and first centurion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metric">Record (optional)</Label>
            <Input
              id="metric"
              value={recordMetric}
              onChange={(e) => setRecordMetric(e.target.value)}
              placeholder="e.g. 1,420 runs at 54.6, best 148*"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="season">Season or years (optional)</Label>
            <Input
              id="season"
              value={seasonOrYear}
              onChange={(e) => setSeasonOrYear(e.target.value)}
              placeholder="e.g. 2024/25, or 2020 to now"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Citation (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What they did for the club"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Adding…" : "Add to hall of fame"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveHallOfFameButton({
  clubId,
  hallOfFameId,
  playerName,
}: {
  clubId: string;
  hallOfFameId: string;
  playerName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [ask, confirmDialog] = useConfirm();

  const handleRemove = async () => {
    const ok = await ask({
      title: `Remove ${playerName} from the hall of fame?`,
      description: "Their records stay; only the hall of fame entry goes.",
      cancelLabel: "Keep",
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    setLoading(true);
    try {
      const res = await removeHallOfFame(hallOfFameId, clubId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Removed ${playerName} from the hall of fame`);
      }
    } catch (err) {
      console.error("Failed to remove Hall of Fame inductee:", err);
      toast.error("Could not remove them");
    } finally {
      setLoading(false);
    }
  };

  // A ⋯ menu with Remove named, not a bare bin in the card's corner (T11).
  return (
    <>
      {confirmDialog}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={loading}
            className="-mr-2 -mt-2 h-11 w-11 shrink-0 text-muted-foreground"
            aria-label={`Actions for ${playerName}`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            // After the menu has let go of the focus, so the dialog keeps it.
            onSelect={() => window.setTimeout(() => void handleRemove(), 0)}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Remove from hall of fame
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

