"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Award, Check, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { setPlayerOfTheMatch } from "~/app/matches/mutations";
import { rankPlayersByImpact } from "~/lib/cricket";
import type { Match } from "~/lib/match-types";

interface PlayerOption {
  id: string;
  name: string;
  avatarUrl?: string | null;
  teamName: string;
  stats?: string;
  impactPoints?: number;
}

interface PotmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  players: PlayerOption[];
  currentPotmId?: string | null;
  onSuccess?: (potmId: string) => void;
  match?: Match | null;
}

export function PotmDialog({
  open,
  onOpenChange,
  matchId,
  players,
  currentPotmId,
  onSuccess,
  match,
}: PotmDialogProps) {
  const rankedImpact = useMemo(() => {
    if (!match) return [];
    return rankPlayersByImpact(match);
  }, [match]);

  const topPerformer = rankedImpact[0] ?? null;

  const [overridePlayerId, setOverridePlayerId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPlayerId =
    overridePlayerId ?? currentPotmId ?? topPerformer?.playerId ?? "";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOverridePlayerId(null);
    }
    onOpenChange(nextOpen);
  };

  // Combine player list with algorithmic rankings and performance stats
  const enrichedPlayers = useMemo(() => {
    const impactMap = new Map(rankedImpact.map((r) => [r.playerId, r]));

    return [...players]
      .map((p) => {
        const impact = impactMap.get(p.id);
        return {
          ...p,
          impactPoints: impact?.totalPoints ?? 0,
          stats: impact?.summary ?? p.stats,
          isTopRecommendation: impact?.playerId === topPerformer?.playerId,
        };
      })
      .sort((a, b) => {
        // Top recommended first, then by impact points, then by name
        if (a.isTopRecommendation) return -1;
        if (b.isTopRecommendation) return 1;
        return (b.impactPoints ?? 0) - (a.impactPoints ?? 0);
      });
  }, [players, rankedImpact, topPerformer]);

  const handleSave = async () => {
    if (!selectedPlayerId) {
      toast.error("Please select a player");
      return;
    }

    setIsSaving(true);
    try {
      const res = await setPlayerOfTheMatch(matchId, selectedPlayerId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Player of the Match awarded successfully!");
        handleOpenChange(false);
        onSuccess?.(selectedPlayerId);
      }
    } catch (err) {
      console.error("Failed to save POTM:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoAward = async () => {
    const targetId = topPerformer?.playerId || enrichedPlayers[0]?.id;
    if (!targetId) {
      toast.error("No player performance data available to auto-award");
      return;
    }

    setOverridePlayerId(targetId);
    setIsSaving(true);
    try {
      const res = await setPlayerOfTheMatch(matchId, targetId);
      if (res.error) {
        toast.error(res.error);
      } else {
        const winnerName =
          topPerformer?.playerName || enrichedPlayers[0]?.name || "Player";
        toast.success(`Automatically awarded to ${winnerName}!`);
        handleOpenChange(false);
        onSuccess?.(targetId);
      }
    } catch (err) {
      console.error("Failed to auto-award POTM:", err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-1.5 text-amber-500">
            <Award className="h-4 w-4" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Match honors
            </span>
          </div>
          <DialogTitle className="text-xl">
            Award Player of the Match
          </DialogTitle>
          <DialogDescription>
            {topPerformer
              ? `Standout performer calculated based on match impact. Confirm the automated recommendation or select another player.`
              : `Select the standout player of this fixture to be featured on scorecards and broadcast graphics.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-2 overflow-y-auto py-2 pr-1">
          {enrichedPlayers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No players available to award.
            </p>
          ) : (
            enrichedPlayers.map((p) => {
              const isSelected = selectedPlayerId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOverridePlayerId(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-amber-500/80 bg-amber-500/10 text-foreground ring-1 ring-amber-500/50"
                      : "border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/50 bg-muted">
                      {p.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        {p.isTopRecommendation && (
                          <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px] px-1.5 py-0">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            Top Recommended
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{p.teamName}</span>
                        {p.stats && (
                          <>
                            <span>•</span>
                            <span className="text-foreground/80 font-mono">
                              {p.stats}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.impactPoints != null && p.impactPoints > 0 && (
                      <span className="text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {p.impactPoints} pts
                      </span>
                    )}
                    {isSelected && (
                      <Check className="h-5 w-5 flex-shrink-0 text-amber-500" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center w-full">
          {topPerformer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoAward}
              disabled={isSaving}
              className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Auto-Award Top Performer
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedPlayerId || isSaving}
              className="bg-amber-600 text-white hover:bg-amber-500"
            >
              {isSaving ? "Awarding..." : "Confirm Award"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
