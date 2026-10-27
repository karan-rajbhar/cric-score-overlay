"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  localDateTimeToIso,
  todayLocalDateInput,
} from "~/lib/local-datetime";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";
import {
  SlidersHorizontal,
  Calculator,
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
        onClick={() => setOpen(true)}
      >
        <Calculator className="h-3.5 w-3.5 text-primary" />
        Qualification calculator
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

/**
 * Round-robin fixtures for every confirmed team: one round a day from the
 * first match's day and time (in the organiser's own time zone), each match
 * reschedulable afterwards.
 */
export function GenerateFixturesButton({
  tournamentId,
  startDate,
}: {
  tournamentId: string;
  /** The tournament's start date ("2026-11-01"), the first day offered. */
  startDate?: string | null;
}) {
  const router = useRouter();
  const ids = { day: useId(), time: useId(), error: useId() };
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const openDialog = (next: boolean) => {
    if (loading) return;
    if (next) {
      setDay(startDate || todayLocalDateInput());
      setTime("10:00");
      setError(null);
    }
    setOpen(next);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstMatchAt = localDateTimeToIso(day, time);
    if (!firstMatchAt) {
      setError("Pick the first match's day and time");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateTournamentFixtures(tournamentId, firstMatchAt);
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success(`Generated ${res.count} matches`);
      setOpen(false);
      router.refresh();
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          Generate round-robin fixtures
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleGenerate} className="space-y-4" noValidate>
          <DialogHeader className="text-left">
            <DialogTitle className="text-balance">
              Generate round-robin fixtures
            </DialogTitle>
            <DialogDescription>
              Every confirmed team plays every other team once, one round a
              day from the first match. You can reschedule any match
              afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={ids.day}>First match day</Label>
              <Input
                id={ids.day}
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor={ids.time}>Start time</Label>
              <Input
                id={ids.time}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5"
                required
              />
            </div>
          </div>
          {error && (
            <p id={ids.error} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => openDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Generate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
            ? "Team registration approved"
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
        className="border-success/40 text-success hover:bg-success/10"
      >
        <Check className="mr-1 h-3.5 w-3.5" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => handleAction("rejected")}
        className="border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  );
}
