"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
import {
  Settings2,
  Trash2,
  Loader2,
  AlertTriangle,
  Calendar,
  Layers,
} from "lucide-react";
import {
  updateTournament,
  deleteTournament,
} from "~/app/tournaments/actions";
import { toast } from "sonner";

export interface TournamentManageData {
  id: string;
  name: string;
  description?: string | null;
  tournament_format?: string | null;
  match_format?: string | null;
  overs_per_innings?: number | null;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  season_id?: string | null;
}

interface TournamentManageDialogProps {
  tournament: TournamentManageData;
  seasons?: Array<{ id: string; name: string }>;
  clubId?: string | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  onDeleted?: () => void;
}

export function TournamentManageDialog({
  tournament,
  seasons = [],
  trigger,
  onSuccess,
  onDeleted,
}: TournamentManageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  // Form states
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description ?? "");
  const [tournamentFormat, setTournamentFormat] = useState(
    tournament.tournament_format ?? "league",
  );
  const [matchFormat, setMatchFormat] = useState(
    tournament.match_format ?? "T20",
  );
  const [overs, setOvers] = useState(
    String(tournament.overs_per_innings ?? 20),
  );
  const [venue, setVenue] = useState(tournament.venue ?? "");
  const [startDate, setStartDate] = useState(tournament.start_date ?? "");
  const [endDate, setEndDate] = useState(tournament.end_date ?? "");
  const [seasonId, setSeasonId] = useState(
    tournament.season_id ?? "none",
  );

  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleOpen = (newOpen: boolean) => {
    if (newOpen) {
      setName(tournament.name);
      setDescription(tournament.description ?? "");
      setTournamentFormat(tournament.tournament_format ?? "league");
      setMatchFormat(tournament.match_format ?? "T20");
      setOvers(String(tournament.overs_per_innings ?? 20));
      setVenue(tournament.venue ?? "");
      setStartDate(tournament.start_date ?? "");
      setEndDate(tournament.end_date ?? "");
      setSeasonId(tournament.season_id ?? "none");
      setConfirmDeleteText("");
      setActiveTab("details");
    }
    setOpen(newOpen);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Tournament name is required");
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("description", description.trim());
    formData.set("tournament_format", tournamentFormat);
    formData.set("match_format", matchFormat);
    formData.set("overs_per_innings", overs);
    formData.set("venue", venue.trim());
    if (startDate) formData.set("start_date", startDate);
    if (endDate) formData.set("end_date", endDate);
    if (seasonId && seasonId !== "none") {
      formData.set("season_id", seasonId);
    } else {
      formData.set("season_id", "none");
    }

    startUpdateTransition(async () => {
      const res = await updateTournament(tournament.id, formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tournament settings saved");
        setOpen(false);
        router.refresh();
        onSuccess?.();
      }
    });
  };

  const handleDelete = () => {
    if (confirmDeleteText !== tournament.name) {
      toast.error("Tournament name does not match confirmation");
      return;
    }

    startDeleteTransition(async () => {
      const res = await deleteTournament(tournament.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tournament deleted successfully");
        setOpen(false);
        router.refresh();
        onDeleted?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            aria-label="Manage tournament settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Settings2 className="h-4 w-4 text-primary" />
            Manage Tournament: {tournament.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Edit tournament settings, season association, or delete this tournament.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="danger"
              className="gap-1.5 text-xs text-destructive data-[state=active]:text-destructive"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Danger Zone
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <form
              data-testid="tournament-manage-form"
              onSubmit={handleSave}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="tourn-name" className="text-xs font-semibold">
                  Tournament Name *
                </Label>
                <Input
                  id="tourn-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Premier League 2026"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tourn-desc" className="text-xs font-semibold">
                  Description
                </Label>
                <Textarea
                  id="tourn-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Rules, sponsor details, or overview..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tourn-format" className="text-xs font-semibold">
                    Tournament Format
                  </Label>
                  <Select
                    value={tournamentFormat}
                    onValueChange={setTournamentFormat}
                  >
                    <SelectTrigger id="tourn-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="league">League (Round Robin)</SelectItem>
                      <SelectItem value="knockout">Knockout</SelectItem>
                      <SelectItem value="mixed">Mixed / Groups</SelectItem>
                      <SelectItem value="round_robin">Double Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="match-format" className="text-xs font-semibold">
                    Match Format
                  </Label>
                  <Select value={matchFormat} onValueChange={setMatchFormat}>
                    <SelectTrigger id="match-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T20">T20</SelectItem>
                      <SelectItem value="ODI">ODI</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tourn-overs" className="text-xs font-semibold">
                    Overs Per Innings
                  </Label>
                  <Input
                    id="tourn-overs"
                    type="number"
                    min="1"
                    max="100"
                    value={overs}
                    onChange={(e) => setOvers(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tourn-venue" className="text-xs font-semibold">
                    Venue / Ground
                  </Label>
                  <Input
                    id="tourn-venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. National Cricket Stadium"
                  />
                </div>
              </div>

              {seasons.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="tourn-season" className="text-xs font-semibold">
                    Linked Season
                  </Label>
                  <Select value={seasonId} onValueChange={setSeasonId}>
                    <SelectTrigger id="tourn-season">
                      <SelectValue placeholder="Select club season" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (All Seasons)</SelectItem>
                      {seasons.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tourn-start" className="text-xs font-semibold">
                    Start Date
                  </Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="tourn-start"
                      type="date"
                      className="pl-8"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tourn-end" className="text-xs font-semibold">
                    End Date
                  </Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="tourn-end"
                      type="date"
                      className="pl-8"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="danger" className="mt-4 space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Permanent Tournament Deletion
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Deleting this tournament will remove all fixtures, points tables, and registered team associations. This action cannot be undone.
              </p>
              <div className="mt-4 space-y-2">
                <Label htmlFor="confirm-del" className="text-[11px] font-medium text-foreground">
                  Type <span className="font-bold text-destructive">{tournament.name}</span> to confirm:
                </Label>
                <Input
                  id="confirm-del"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  placeholder={tournament.name}
                  className="text-xs"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={confirmDeleteText !== tournament.name || isDeleting}
                  onClick={handleDelete}
                  className="gap-1.5 text-xs"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Permanently Delete Tournament
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
