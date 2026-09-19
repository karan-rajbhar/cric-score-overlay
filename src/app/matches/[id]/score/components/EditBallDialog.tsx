"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ALL_DISMISSAL_TYPES } from "./WicketDialog";
import type { ExtraType } from "~/app/matches/types";
import type { TeamPlayer } from "~/lib/match-types";

export interface DeliveryToEdit {
  id: string;
  over_number?: number;
  ball_number?: number;
  runs_scored?: number | null;
  extras?: number | null;
  extra_type?: string | null;
  is_wicket?: boolean | null;
  dismissal_type?: string | null;
  bowler_id?: string | null;
  batsman_id?: string | null;
  dismissed_player_id?: string | null;
}

interface EditBallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delivery: DeliveryToEdit | null;
  onSave: (params: {
    ballId: string;
    runsScored: number;
    extras: number;
    extraType: ExtraType | null;
    isWicket: boolean;
    dismissalType: string | null;
    batsmanId?: string | null;
    bowlerId?: string | null;
  }) => Promise<void>;
  isProcessing: boolean;
  battingTeamPlayers?: TeamPlayer[];
  bowlingTeamPlayers?: TeamPlayer[];
}

export function EditBallDialog({
  open,
  onOpenChange,
  delivery,
  onSave,
  isProcessing,
  battingTeamPlayers = [],
  bowlingTeamPlayers = [],
}: EditBallDialogProps) {
  const [prevDeliveryId, setPrevDeliveryId] = useState<string | null>(
    delivery?.id ?? null,
  );
  const [runsScored, setRunsScored] = useState<number>(
    delivery?.runs_scored ?? 0,
  );
  const [extras, setExtras] = useState<number>(delivery?.extras ?? 0);
  const [extraType, setExtraType] = useState<string>(
    delivery?.extra_type ?? "none",
  );
  const [isWicket, setIsWicket] = useState<boolean>(
    Boolean(delivery?.is_wicket),
  );
  const [dismissalType, setDismissalType] = useState<string>(
    delivery?.dismissal_type ?? "bowled",
  );
  const [batsmanId, setBatsmanId] = useState<string | null>(
    delivery?.batsman_id ?? null,
  );
  const [bowlerId, setBowlerId] = useState<string | null>(
    delivery?.bowler_id ?? null,
  );

  if (delivery && delivery.id !== prevDeliveryId) {
    setPrevDeliveryId(delivery.id);
    setRunsScored(delivery.runs_scored ?? 0);
    setExtras(delivery.extras ?? 0);
    setExtraType(delivery.extra_type ?? "none");
    setIsWicket(Boolean(delivery.is_wicket));
    setDismissalType(delivery.dismissal_type ?? "bowled");
    setBatsmanId(delivery.batsman_id ?? null);
    setBowlerId(delivery.bowler_id ?? null);
  }

  if (!delivery) return null;

  const handleConfirm = async () => {
    await onSave({
      ballId: delivery.id,
      runsScored,
      extras,
      extraType: extraType === "none" ? null : (extraType as ExtraType),
      isWicket,
      dismissalType: isWicket ? dismissalType : null,
      batsmanId,
      bowlerId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit Delivery (Over {(delivery.over_number ?? 0) + 1}, Ball{" "}
            {delivery.ball_number ?? 1})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Correct this ball in place. The entire innings projections, figures,
            and totals will be recalculated deterministically without deleting
            subsequent balls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Runs off Bat</Label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={runsScored === r ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setRunsScored(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Extra Type</Label>
            <Select value={extraType} onValueChange={setExtraType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Legal ball)</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="no_ball">No Ball</SelectItem>
                <SelectItem value="bye">Bye</SelectItem>
                <SelectItem value="leg_bye">Leg Bye</SelectItem>
                <SelectItem value="penalty">Penalty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {extraType !== "none" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Extras Count</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={extras}
                onChange={(e) => setExtras(Number(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="edit-is-wicket"
              checked={isWicket}
              onChange={(e) => setIsWicket(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label
              htmlFor="edit-is-wicket"
              className="cursor-pointer text-sm font-medium"
            >
              Wicket fell on this ball
            </Label>
          </div>

          {isWicket && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Dismissal Type</Label>
              <Select value={dismissalType} onValueChange={setDismissalType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_DISMISSAL_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Player Attribution (Correct wrong batter or bowler) */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-3">
            <Label className="text-xs font-bold text-muted-foreground">
              Player Attribution (Correct wrong batter or bowler)
            </Label>

            {battingTeamPlayers.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Batsman (Striker)</Label>
                <Select
                  value={batsmanId || ""}
                  onValueChange={(val) => setBatsmanId(val || null)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select batsman" />
                  </SelectTrigger>
                  <SelectContent>
                    {battingTeamPlayers.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                        {p.user?.full_name ?? "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {bowlingTeamPlayers.length > 0 && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Bowler</Label>
                <Select
                  value={bowlerId || ""}
                  onValueChange={(val) => setBowlerId(val || null)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select bowler" />
                  </SelectTrigger>
                  <SelectContent>
                    {bowlingTeamPlayers.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                        {p.user?.full_name ?? "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            className="mt-3 w-full"
            onClick={() => void handleConfirm()}
            disabled={isProcessing}
          >
            {isProcessing ? "Updating Delivery..." : "Save Delivery"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
