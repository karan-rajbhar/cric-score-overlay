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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Plus, Trophy, Trash2, Loader2 } from "lucide-react";
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
      toast.error("Please select a player to induct");
      return;
    }
    if (!title.trim()) {
      toast.error("Please provide an induction title or honor");
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
        toast.success("Player inducted into the Hall of Fame!");
        setOpen(false);
        setTitle("");
        setDescription("");
        setRecordMetric("");
        setSeasonOrYear("");
      }
    } catch (err) {
      console.error("Hall of Fame induction error:", err);
      toast.error("Failed to induct player");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-amber-600 font-medium text-white hover:bg-amber-500"
        >
          <Plus className="h-4 w-4" />
          Induct Legend
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-amber-500">
            <Trophy className="h-5 w-5" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Club honors
            </span>
          </div>
          <DialogTitle className="text-xl">Hall of Fame Induction</DialogTitle>
          <DialogDescription>
            Honor a player or record holder into the club&apos;s prestigious
            Hall of Fame.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="player">Select Member / Legend</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger id="player">
                <SelectValue placeholder="Choose a member..." />
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
                <SelectItem value="legend">Club Legend (General)</SelectItem>
                <SelectItem value="top_scorer">
                  All-Time Top Run Scorer
                </SelectItem>
                <SelectItem value="top_wicket_taker">
                  Record Wicket Taker
                </SelectItem>
                <SelectItem value="champion">Championship Winner</SelectItem>
                <SelectItem value="record">Historic Milestone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Honor / Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Inaugural Captain & Record Centurion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metric">Record Metric (Optional)</Label>
            <Input
              id="metric"
              value={recordMetric}
              onChange={(e) => setRecordMetric(e.target.value)}
              placeholder="e.g. 1,420 Runs @ 54.6 | 148* (56b)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="season">Season / Era (Optional)</Label>
            <Input
              id="season"
              value={seasonOrYear}
              onChange={(e) => setSeasonOrYear(e.target.value)}
              placeholder="e.g. 2024/25 or 2020-Present"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Citation / Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe their contribution and landmark moments..."
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
            className="bg-amber-600 text-white hover:bg-amber-500"
          >
            {isSaving ? "Inducting..." : "Confirm Induction"}
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

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Remove ${playerName} from the Club Hall of Fame?`)) return;

    setLoading(true);
    try {
      const res = await removeHallOfFame(hallOfFameId, clubId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Removed ${playerName} from Hall of Fame`);
      }
    } catch (err) {
      console.error("Failed to remove Hall of Fame inductee:", err);
      toast.error("Failed to remove inductee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={handleRemove}
      className="h-6 w-6 text-muted-foreground hover:text-destructive"
      title={`Remove ${playerName} from Hall of Fame`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

