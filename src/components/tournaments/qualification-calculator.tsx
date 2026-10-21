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
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { evaluateQualification } from "~/lib/tournament-standings";

interface StandingsTeam {
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  points: number;
  netRunRate: number;
  qualificationStatus?: string | null;
}

interface QualificationCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  teams: StandingsTeam[];
  totalScheduledMatchesPerTeam?: number;
}

export function QualificationCalculator({
  open,
  onOpenChange,
  tournamentName,
  teams,
  totalScheduledMatchesPerTeam = 4,
}: QualificationCalculatorProps) {
  const [qualSpots, setQualSpots] = useState<number>(2);

  const teamScenarios = useMemo(() => {
    // Calculate remaining matches for each team
    const data = teams.map((t) => {
      const remaining = Math.max(
        0,
        totalScheduledMatchesPerTeam - t.matchesPlayed,
      );
      const maxPoints = t.points + remaining * 2;
      return {
        ...t,
        remainingMatches: remaining,
        maxPoints,
      };
    });

    // Evaluate mathematical status
    const evalMap = evaluateQualification(
      data.map((d) => ({
        teamId: d.teamId,
        points: d.points,
        remainingMatches: d.remainingMatches,
      })),
      qualSpots,
    );

    return data.map((t) => {
      const mathStatus = evalMap.get(t.teamId) ?? "in_contention";
      // If admin explicitly set status, respect it, otherwise use math
      const effectiveStatus =
        t.qualificationStatus && t.qualificationStatus !== "in_contention"
          ? t.qualificationStatus
          : mathStatus;

      let conditionText = "";
      if (effectiveStatus === "qualified") {
        conditionText = "Top spot secured";
      } else if (effectiveStatus === "eliminated") {
        conditionText = "Mathematically eliminated from top spots.";
      } else {
        const cutoff =
          [...data].sort((a, b) => b.points - a.points)[qualSpots - 1]
            ?.points ?? 0;
        const pointsNeeded = Math.max(0, cutoff - t.points);
        const winsNeeded = Math.ceil(pointsNeeded / 2);
        conditionText = `Needs ${winsNeeded > 0 ? `${winsNeeded} win${winsNeeded > 1 ? "s" : ""}` : "1 win"} and strong NRR to qualify.`;
      }

      return {
        ...t,
        status: effectiveStatus,
        conditionText,
      };
    });
  }, [teams, totalScheduledMatchesPerTeam, qualSpots]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Qualification & cutoff calculator
          </DialogTitle>
          <DialogDescription>
            Qualification scenarios for{" "}
            {tournamentName}.
          </DialogDescription>
        </DialogHeader>

        {/* Qualification Spots Selector */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            Playoff spots
          </span>
          <div className="flex gap-2">
            {[2, 4].map((spots) => (
              <Button
                key={spots}
                variant={qualSpots === spots ? "default" : "outline"}
                size="sm"
                onClick={() => setQualSpots(spots)}
                className="h-8 text-xs font-semibold"
              >
                Top {spots}
              </Button>
            ))}
          </div>
        </div>

        {/* Team Scenarios Table */}
        <div className="space-y-2.5 py-1 sm:max-h-[380px] sm:overflow-y-auto sm:pr-1">
          {teamScenarios.map((team, idx) => {
            const isQ = team.status === "qualified";
            const isE = team.status === "eliminated";

            return (
              <div
                key={team.teamId}
                className={`rounded-lg border p-3.5 transition-all ${
                  isQ
                    ? "border-success/50 bg-success/5"
                    : isE
                      ? "border-destructive/40 bg-destructive/5 opacity-75"
                      : "border-border bg-card"
                }`}
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-4 text-center text-xs font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {team.teamName}
                    </span>
                  </div>
                  <div>
                    {isQ && (
                      <Badge className="border-success/40 bg-success/20 text-2xs font-semibold text-success">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Qualified (Q)
                      </Badge>
                    )}
                    {isE && (
                      <Badge
                        variant="destructive"
                        className="text-2xs font-semibold"
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Eliminated (E)
                      </Badge>
                    )}
                    {!isQ && !isE && (
                      <Badge
                        variant="secondary"
                        className="text-2xs font-semibold"
                      >
                        <HelpCircle className="mr-1 h-3 w-3" /> In contention
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="my-2 grid grid-cols-3 gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <div>
                    Current:{" "}
                    <span className="font-semibold text-foreground">
                      {team.points} pts
                    </span>{" "}
                    ({team.matchesPlayed} pl)
                  </div>
                  <div>
                    Remaining:{" "}
                    <span className="font-semibold text-foreground">
                      {team.remainingMatches} gms
                    </span>
                  </div>
                  <div>
                    Max Possible:{" "}
                    <span className="font-semibold text-primary">
                      {team.maxPoints} pts
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Scenario:{" "}
                  </span>
                  {team.conditionText}
                </p>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
