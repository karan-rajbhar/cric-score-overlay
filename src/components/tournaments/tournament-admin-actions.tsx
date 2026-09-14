"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  SlidersHorizontal,
  Calculator,
  Sparkles,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { PointsOverrideDialog } from "./points-override-dialog";
import { QualificationCalculator } from "./qualification-calculator";
import {
  generateTournamentFixtures,
  updateRegistrationStatus,
} from "~/app/tournaments/actions";
import { toast } from "sonner";

interface PointsOverrideButtonProps {
  tournamentId: string;
  teamId: string;
  teamName: string;
  currentAdjustment?: number | null;
  currentReason?: string | null;
  currentStatus?: string | null;
}

export function PointsOverrideButton(props: PointsOverrideButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        title="Manual points / qualification override"
        aria-label="Manual points and qualification override"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
      </Button>
      <PointsOverrideDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}

interface QualificationCalculatorButtonProps {
  tournamentName: string;
  teams: Array<{
    teamId: string;
    teamName: string;
    matchesPlayed: number;
    points: number;
    netRunRate: number;
    qualificationStatus?: string | null;
  }>;
}

export function QualificationCalculatorButton({
  tournamentName,
  teams,
}: QualificationCalculatorButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Calculator className="h-3.5 w-3.5 text-primary" />
        Qualification Calculator
      </Button>
      <QualificationCalculator
        open={open}
        onOpenChange={setOpen}
        tournamentName={tournamentName}
        teams={teams}
      />
    </>
  );
}

export function GenerateFixturesButton({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!confirm("Generate round-robin fixtures for all confirmed teams?"))
      return;
    setLoading(true);
    try {
      const res = await generateTournamentFixtures(tournamentId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Generated ${res.count} tournament matches!`);
      }
    } catch (err) {
      console.error("Failed to generate fixtures:", err);
      toast.error("Failed to generate fixtures");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleGenerate}
      disabled={loading}
      className="gap-1.5 bg-primary font-semibold text-primary-foreground"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      Generate Round-Robin Schedule
    </Button>
  );
}

export function RegistrationApprovalActions({
  registrationId,
  tournamentId,
}: {
  registrationId: string;
  tournamentId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (status: "confirmed" | "rejected") => {
    setLoading(true);
    try {
      const res = await updateRegistrationStatus(
        registrationId,
        tournamentId,
        status,
      );
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          status === "confirmed"
            ? "Team registration approved!"
            : "Registration rejected",
        );
      }
    } catch (err) {
      console.error("Registration action failed:", err);
      toast.error("Action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => handleAction("confirmed")}
        className="h-7 border-emerald-500/40 px-2 text-xs text-emerald-600 hover:bg-emerald-500/10"
      >
        <Check className="mr-1 h-3.5 w-3.5" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => handleAction("rejected")}
        className="h-7 border-red-500/40 px-2 text-xs text-red-600 hover:bg-red-500/10"
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}
