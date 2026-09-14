"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { createMatch } from "../mutations";
import { createTeamQuick } from "../../teams/actions";
import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/supabase/client";
import { toast } from "sonner";
import { deriveShortName } from "~/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trophy,
  Shield,
  RotateCcw,
  Users,
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  short_name?: string | null;
  club_id?: string | null;
  created_by?: string | null;
  captain_id?: string | null;
  vice_captain_id?: string | null;
}

interface TournamentOption {
  id: string;
  name: string;
  match_format?: string | null;
  custom_overs?: number | null;
  overs_per_innings?: number | null;
  created_by?: string | null;
  club_id?: string | null;
}

interface ClubOption {
  id: string;
  name: string;
  short_name?: string | null;
  owner_id?: string | null;
}

type MatchFormat = "T20" | "ODI" | "Custom";

interface FormData {
  title: string;
  matchFormat: MatchFormat;
  oversPerInnings: number;
  team1Id: string;
  team2Id: string;
  venue: string;
  scheduledAt: string;
  umpire1Name: string;
  umpire2Name: string;
  tournamentId: string;
  clubId: string;
}

function CreateMatchWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTournamentId = searchParams.get("tournamentId") ?? "";
  const urlClubId = searchParams.get("clubId") ?? "";

  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [tournamentTeamIds, setTournamentTeamIds] = useState<Set<string>>(
    new Set(),
  );
  const [myTeamIds, setMyTeamIds] = useState<Set<string>>(new Set());
  const [myClubAdminIds, setMyClubAdminIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsLoadError, setTeamsLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    matchFormat: "T20",
    oversPerInnings: 20,
    team1Id: "",
    team2Id: "",
    venue: "",
    scheduledAt: "",
    umpire1Name: "",
    umpire2Name: "",
    tournamentId: urlTournamentId,
    clubId: urlClubId,
  });

  // Inline "new team" creation from the team-selection step.
  const [newTeamFor, setNewTeamFor] = useState<"team1Id" | "team2Id" | null>(
    null,
  );
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamSaving, setNewTeamSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // If auth is still initializing, don't run loadData prematurely.
    if (authLoading) {
      return;
    }

    // If user is not authenticated, early return as auth guard screen will be rendered.
    if (!user) {
      return;
    }

    let cancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const loadData = async () => {
      setTeamsLoading(true);
      setTeamsLoadError(null);

      // Safety timeout fallback: if queries hang or take longer than 8 seconds,
      // stop spinning and show the error message with retry button.
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setTeamsLoading(false);
          setTeamsLoadError(
            "Loading teams took longer than expected. Please check your connection and retry.",
          );
        }
      }, 8000);

      try {
        const supabase = createClient();
        const [teamRes, tournRes, clubRes, myPlayersRes, myClubAdminRes] =
          await Promise.all([
            supabase
              .from("teams")
              .select(
                "id, name, short_name, club_id, created_by, captain_id, vice_captain_id",
              )
              .order("name"),
            supabase
              .from("tournaments")
              .select(
                "id, name, match_format, custom_overs, created_by, club_id",
              )
              .order("created_at", { ascending: false }),
            supabase
              .from("clubs")
              .select("id, name, short_name, owner_id")
              .order("name"),
            supabase
              .from("team_players")
              .select("team_id")
              .eq("user_id", user.id),
            supabase
              .from("club_memberships")
              .select("club_id")
              .eq("user_id", user.id)
              .in("role", ["owner", "admin"])
              .eq("status", "active"),
          ]);

        if (cancelled) return;
        if (timeoutId) clearTimeout(timeoutId);

        const playerTeamIds = new Set<string>(
          (myPlayersRes.data ?? [])
            .map((r) => r.team_id)
            .filter((id): id is string => Boolean(id)),
        );
        const clubAdminIds = new Set<string>(
          (myClubAdminRes.data ?? [])
            .map((r) => r.club_id)
            .filter((id): id is string => Boolean(id)),
        );
        if (clubRes.data) {
          for (const c of clubRes.data) {
            if (c.owner_id === user.id) {
              clubAdminIds.add(c.id);
            }
          }
        }
        setMyClubAdminIds(clubAdminIds);

        if (teamRes.error) {
          console.error("Error fetching teams:", teamRes.error);
          setTeamsLoadError(teamRes.error.message || "Failed to load teams");
        } else if (teamRes.data) {
          setTeams(teamRes.data);
          const mine = new Set<string>();
          for (const t of teamRes.data) {
            if (
              t.created_by === user.id ||
              t.captain_id === user.id ||
              t.vice_captain_id === user.id ||
              playerTeamIds.has(t.id) ||
              (t.club_id && clubAdminIds.has(t.club_id))
            ) {
              mine.add(t.id);
            }
          }
          setMyTeamIds(mine);
        }

        if (tournRes.error) {
          console.error("Error fetching tournaments:", tournRes.error);
        } else if (tournRes.data) {
          setTournaments(tournRes.data);
          // If urlTournamentId matches, auto set format
          if (urlTournamentId) {
            const matchTourn = tournRes.data.find(
              (t) => t.id === urlTournamentId,
            );
            if (matchTourn?.match_format === "ODI") {
              setFormData((prev) => ({
                ...prev,
                matchFormat: "ODI",
                oversPerInnings: 50,
              }));
            } else if (matchTourn?.match_format === "T20") {
              setFormData((prev) => ({
                ...prev,
                matchFormat: "T20",
                oversPerInnings: 20,
              }));
            } else if (
              matchTourn?.match_format === "Custom" &&
              matchTourn.custom_overs
            ) {
              setFormData((prev) => ({
                ...prev,
                matchFormat: "Custom",
                oversPerInnings: matchTourn.custom_overs!,
              }));
            }
          }
        }

        if (clubRes.error) {
          console.error("Error fetching clubs:", clubRes.error);
        } else if (clubRes.data) {
          setClubs(clubRes.data);
        }
      } catch (err) {
        console.error("Unexpected error loading match wizard data:", err);
        if (!cancelled) {
          setTeamsLoadError(
            err instanceof Error ? err.message : "Failed to load data",
          );
        }
      } finally {
        if (!cancelled) {
          setTeamsLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [urlTournamentId, refreshKey, user?.id, authLoading]);

  const handleRetry = () => {
    setRefreshKey((k) => k + 1);
  };

  // When tournamentId changes, fetch registered teams for filtering/badging
  useEffect(() => {
    let cancelled = false;

    const fetchTournamentRegistrations = async () => {
      if (!formData.tournamentId) {
        if (!cancelled) setTournamentTeamIds(new Set());
        return;
      }

      try {
        const supabase = createClient();
        const { data, error: regError } = await supabase
          .from("tournament_registrations")
          .select("team_id")
          .eq("tournament_id", formData.tournamentId);

        if (!cancelled && data && !regError) {
          setTournamentTeamIds(
            new Set(
              data
                .map((r) => r.team_id)
                .filter((id): id is string => Boolean(id)),
            ),
          );
        }
      } catch (err) {
        console.error("Error fetching tournament registrations:", err);
      }
    };

    void fetchTournamentRegistrations();
    return () => {
      cancelled = true;
    };
  }, [formData.tournamentId]);

  // Auto-set overs when format changes (derived in the change handler, not an effect)
  const handleFormatChange = (format: MatchFormat) => {
    updateField("matchFormat", format);
    if (format === "T20") {
      updateField("oversPerInnings", 20);
    } else if (format === "ODI") {
      updateField("oversPerInnings", 50);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    const result = await createMatch({
      title: formData.title,
      matchFormat: formData.matchFormat,
      oversPerInnings: formData.oversPerInnings,
      team1Id: formData.team1Id,
      team2Id: formData.team2Id,
      venue: formData.venue || undefined,
      scheduledAt: formData.scheduledAt || undefined,
      umpire1Name: formData.umpire1Name || undefined,
      umpire2Name: formData.umpire2Name || undefined,
      tournamentId: formData.tournamentId || undefined,
      clubId: formData.clubId || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => {
        router.push(`/matches/${result.data?.id}`);
      }, 1200);
    }
  };

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "team1Id" && next.team2Id === value) {
        next.team2Id = "";
      } else if (field === "team2Id" && next.team1Id === value) {
        next.team1Id = "";
      }
      return next;
    });
  };

  const selectedTournament = tournaments.find(
    (t) => t.id === formData.tournamentId,
  );
  const selectedClub = clubs.find((c) => c.id === formData.clubId);

  const isTournamentOrganizer = Boolean(
    user &&
      selectedTournament &&
      (selectedTournament.created_by === user.id ||
        (selectedTournament.club_id &&
          myClubAdminIds.has(selectedTournament.club_id))),
  );

  const isClubOrganizer = Boolean(
    user && formData.clubId && myClubAdminIds.has(formData.clubId),
  );

  // Teams that the user is authorized to represent as Team 1 (Host)
  const myTeams = teams.filter((t) => myTeamIds.has(t.id));
  const organizerTournamentTeams = isTournamentOrganizer
    ? teams.filter((t) => tournamentTeamIds.has(t.id) && !myTeamIds.has(t.id))
    : [];
  const organizerClubTeams = isClubOrganizer
    ? teams.filter((t) => t.club_id === formData.clubId && !myTeamIds.has(t.id))
    : [];

  const selectableTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (t.id === urlTournamentId || t.id === formData.tournamentId)
        return true;
      if (!user) return false;
      if (t.created_by === user.id) return true;
      if (t.club_id && myClubAdminIds.has(t.club_id)) return true;
      return false;
    });
  }, [
    tournaments,
    urlTournamentId,
    formData.tournamentId,
    user,
    myClubAdminIds,
  ]);

  const selectableClubs = useMemo(() => {
    const selectedT1 = teams.find((t) => t.id === formData.team1Id);
    const selectedT2 = teams.find((t) => t.id === formData.team2Id);
    return clubs.filter((c) => {
      if (c.id === urlClubId || c.id === formData.clubId) return true;
      if (myClubAdminIds.has(c.id)) return true;
      if (selectedT1?.club_id === c.id || selectedT2?.club_id === c.id)
        return true;
      return false;
    });
  }, [
    clubs,
    urlClubId,
    formData.clubId,
    myClubAdminIds,
    teams,
    formData.team1Id,
    formData.team2Id,
  ]);

  const team1Eligible = teams.filter((t) => {
    if (myTeamIds.has(t.id)) return true;
    if (isTournamentOrganizer && tournamentTeamIds.has(t.id)) return true;
    if (isClubOrganizer && t.club_id === formData.clubId) return true;
    return false;
  });

  // Team 1 options excluding selected Team 2
  const team1MyTeams = myTeams.filter((t) => t.id !== formData.team2Id);
  const team1OrgTournTeams = organizerTournamentTeams.filter(
    (t) => t.id !== formData.team2Id,
  );
  const team1OrgClubTeams = organizerClubTeams.filter(
    (t) => t.id !== formData.team2Id,
  );
  const team1AvailableCount =
    team1MyTeams.length + team1OrgTournTeams.length + team1OrgClubTeams.length;

  // Team 2 (Opponent) options excluding selected Team 1
  const team2TournamentTeams = formData.tournamentId
    ? teams.filter(
        (t) => t.id !== formData.team1Id && tournamentTeamIds.has(t.id),
      )
    : [];

  const team2ClubTeams =
    formData.clubId && !formData.tournamentId
      ? teams.filter(
          (t) => t.id !== formData.team1Id && t.club_id === formData.clubId,
        )
      : [];

  const team2MyTeams = formData.tournamentId
    ? []
    : teams.filter(
        (t) =>
          t.id !== formData.team1Id &&
          myTeamIds.has(t.id) &&
          (!formData.clubId || t.club_id !== formData.clubId),
      );

  const team2Eligible = formData.tournamentId
    ? team2TournamentTeams
    : formData.clubId
      ? [...team2ClubTeams, ...team2MyTeams]
      : team2MyTeams;

  const canProceedStep1 = formData.matchFormat && formData.oversPerInnings > 0;
  const canProceedStep2 =
    Boolean(formData.team1Id) &&
    Boolean(formData.team2Id) &&
    formData.team1Id !== formData.team2Id &&
    team1Eligible.some((t) => t.id === formData.team1Id) &&
    team2Eligible.some((t) => t.id === formData.team2Id);
  const canProceedStep3 = formData.title.trim().length > 0;

  const isMatchValidForSubmission = useMemo(() => {
    if (!formData.team1Id || !formData.team2Id) return false;
    if (formData.team1Id === formData.team2Id) return false;
    if (formData.tournamentId && tournamentTeamIds.size > 0) {
      if (
        !tournamentTeamIds.has(formData.team1Id) ||
        !tournamentTeamIds.has(formData.team2Id)
      ) {
        return false;
      }
    }
    return true;
  }, [
    formData.team1Id,
    formData.team2Id,
    formData.tournamentId,
    tournamentTeamIds,
  ]);

  const getTeamName = (id: string) => {
    const team = teams.find((t) => t.id === id);
    return team ? team.name : "Not selected";
  };

  const handleCreateInlineTeam = async () => {
    if (!newTeamFor || !newTeamName.trim()) return;

    setNewTeamSaving(true);
    const derived = deriveShortName(newTeamName);
    const result = await createTeamQuick(newTeamName, derived);

    if (result.error || !result.data) {
      toast.error(result.error || "Failed to create team");
      setNewTeamSaving(false);
      return;
    }

    const created: Team = {
      id: result.data.id,
      name: result.data.name,
      short_name: result.data.short_name ?? undefined,
      club_id: result.data.club_id ?? undefined,
      created_by: user?.id,
    };

    setTeams((prev) => [created, ...prev]);
    if (user) {
      setMyTeamIds((prev) => new Set([...prev, created.id]));
    }
    updateField(newTeamFor, created.id);
    toast.success(`Team "${created.name}" created`);
    setNewTeamSaving(false);
    setNewTeamFor(null);
    setNewTeamName("");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="mx-4 w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h2 className="mb-2 text-xl font-semibold">Sign in required</h2>
            <p className="mb-4 text-muted-foreground">
              You need to be signed in to create and score a match.
            </p>
            <Button asChild>
              <Link href="/auth/login?redirect=/matches/create">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="mx-4 w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Match Created!</h2>
            <p className="text-muted-foreground">
              Redirecting to live scorecard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link
              href={
                selectedTournament
                  ? `/tournaments/${selectedTournament.id}?tab=fixtures`
                  : selectedClub || urlClubId
                    ? `/clubs/${selectedClub?.id || urlClubId}?tab=matches`
                    : "/matches"
              }
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {selectedTournament
                ? `Back to ${selectedTournament.name}`
                : selectedClub
                  ? `Back to ${selectedClub.name}`
                  : urlClubId
                    ? "Back to Club"
                    : "Back to Matches"}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">
              Create New Match
            </h1>
            {selectedTournament && (
              <Badge variant="outline" className="gap-1">
                <Trophy className="h-3 w-3 text-amber-500" />
                {selectedTournament.name}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">
            Set up teams, format, overs, and tournament linkage in a few simple
            steps.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`mx-2 h-1 w-full ${
                    step > s ? "bg-primary" : "bg-muted"
                  }`}
                  style={{ width: "60px" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="mb-8 flex justify-between px-2 text-xs text-muted-foreground">
          <span className={step === 1 ? "font-medium text-primary" : ""}>
            Format
          </span>
          <span className={step === 2 ? "font-medium text-primary" : ""}>
            Teams
          </span>
          <span className={step === 3 ? "font-medium text-primary" : ""}>
            Details
          </span>
          <span className={step === 4 ? "font-medium text-primary" : ""}>
            Review
          </span>
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-6">
            {/* Step 1: Format */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-2 text-xl font-semibold">Match Format</h2>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Choose the format and number of overs for this match
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Format</Label>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      {(["T20", "ODI", "Custom"] as MatchFormat[]).map(
                        (format) => (
                          <button
                            key={format}
                            type="button"
                            onClick={() => handleFormatChange(format)}
                            className={`rounded-lg border-2 p-4 transition-colors ${
                              formData.matchFormat === format
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="text-lg font-bold">{format}</div>
                            <div className="text-xs text-muted-foreground">
                              {format === "T20" && "20 overs"}
                              {format === "ODI" && "50 overs"}
                              {format === "Custom" && "Custom overs"}
                            </div>
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="overs">Overs per Innings</Label>
                    <Input
                      id="overs"
                      type="number"
                      min={1}
                      max={50}
                      value={formData.oversPerInnings}
                      onChange={(e) =>
                        updateField(
                          "oversPerInnings",
                          parseInt(e.target.value) || 0,
                        )
                      }
                      disabled={formData.matchFormat !== "Custom"}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Teams */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-2 text-xl font-semibold">Select Teams</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Choose the two teams that will compete. Team 1 is your team
                    or the host team.
                  </p>
                  {selectedTournament && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-amber-500">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>
                          Teams marked with ★ are registered in{" "}
                          {selectedTournament.name}
                        </span>
                      </div>
                      {isTournamentOrganizer && (
                        <Badge
                          variant="secondary"
                          className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400"
                        >
                          Tournament Organizer Access
                        </Badge>
                      )}
                    </div>
                  )}
                  {selectedClub && isClubOrganizer && !selectedTournament && (
                    <div className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-500">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Club Admin Access for {selectedClub.name}</span>
                    </div>
                  )}
                </div>

                {teamsLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Loading teams...
                    </span>
                  </div>
                ) : teamsLoadError ? (
                  <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-sm text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span>{teamsLoadError}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Team 1 (Host / Your Team) */}
                    <div>
                      <div className="flex items-baseline justify-between">
                        <Label>Team 1 (Host / Your Team)</Label>
                        <span className="text-xs text-muted-foreground">
                          Teams you represent
                        </span>
                      </div>

                      {team1Eligible.length === 0 ? (
                        <div className="mt-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                          <div className="flex items-start gap-3">
                            <Users className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                No eligible teams found
                              </p>
                              <p className="text-xs text-muted-foreground">
                                You can only host matches for teams you created,
                                captain, play for, or manage. Create a team now
                                to proceed!
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-2 text-xs"
                                onClick={() => {
                                  setNewTeamFor("team1Id");
                                  setNewTeamName("");
                                }}
                              >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Create your team
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Select
                            value={formData.team1Id || undefined}
                            onValueChange={(value) =>
                              updateField("team1Id", value)
                            }
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select your team" />
                            </SelectTrigger>
                            <SelectContent>
                              {team1AvailableCount === 0 ? (
                                <div className="p-2 text-center text-xs text-muted-foreground">
                                  No eligible teams available
                                </div>
                              ) : (
                                <>
                                  {team1MyTeams.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>My Teams</SelectLabel>
                                      {team1MyTeams.map((team) => {
                                        const isReg = tournamentTeamIds.has(
                                          team.id,
                                        );
                                        return (
                                          <SelectItem
                                            key={team.id}
                                            value={team.id}
                                          >
                                            {isReg ? "★ " : ""}
                                            {team.name}
                                            {team.short_name &&
                                              ` (${team.short_name})`}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectGroup>
                                  )}

                                  {team1OrgTournTeams.length > 0 && (
                                    <>
                                      {team1MyTeams.length > 0 && (
                                        <SelectSeparator />
                                      )}
                                      <SelectGroup>
                                        <SelectLabel>
                                          Tournament Teams (Organizer Access)
                                        </SelectLabel>
                                        {team1OrgTournTeams.map((team) => (
                                          <SelectItem
                                            key={team.id}
                                            value={team.id}
                                          >
                                            ★ {team.name}
                                            {team.short_name &&
                                              ` (${team.short_name})`}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </>
                                  )}

                                  {team1OrgClubTeams.length > 0 && (
                                    <>
                                      {(team1MyTeams.length > 0 ||
                                        team1OrgTournTeams.length > 0) && (
                                        <SelectSeparator />
                                      )}
                                      <SelectGroup>
                                        <SelectLabel>
                                          Club Teams (Admin Access)
                                        </SelectLabel>
                                        {team1OrgClubTeams.map((team) => {
                                          const isReg = tournamentTeamIds.has(
                                            team.id,
                                          );
                                          return (
                                            <SelectItem
                                              key={team.id}
                                              value={team.id}
                                            >
                                              {isReg ? "★ " : ""}
                                              {team.name}
                                              {team.short_name &&
                                                ` (${team.short_name})`}
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectGroup>
                                    </>
                                  )}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-7 text-xs text-muted-foreground"
                            onClick={() => {
                              setNewTeamFor("team1Id");
                              setNewTeamName("");
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Create new team
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Team 2 (Opponent) */}
                    <div>
                      <div className="flex items-baseline justify-between">
                        <Label>Team 2 (Opponent)</Label>
                        <span className="text-xs text-muted-foreground">
                          {formData.tournamentId
                            ? "Tournament opponents"
                            : formData.clubId
                              ? "Club / Managed opponents"
                              : "Internal squad or create opponent"}
                        </span>
                      </div>
                      <Select
                        value={formData.team2Id || undefined}
                        onValueChange={(value) => updateField("team2Id", value)}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select opponent team" />
                        </SelectTrigger>
                        <SelectContent>
                          {team2Eligible.length === 0 ? (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              {formData.tournamentId
                                ? "No other teams registered in this tournament"
                                : "No opponent squads available"}
                            </div>
                          ) : (
                            <>
                              {formData.tournamentId &&
                                team2TournamentTeams.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>Tournament Teams</SelectLabel>
                                    {team2TournamentTeams.map((team) => (
                                      <SelectItem key={team.id} value={team.id}>
                                        ★ {team.name}
                                        {team.short_name &&
                                          ` (${team.short_name})`}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}

                              {!formData.tournamentId && formData.clubId && (
                                <>
                                  {team2ClubTeams.length > 0 && (
                                    <SelectGroup>
                                      <SelectLabel>Club Squads</SelectLabel>
                                      {team2ClubTeams.map((team) => (
                                        <SelectItem
                                          key={team.id}
                                          value={team.id}
                                        >
                                          {team.name}
                                          {team.short_name &&
                                            ` (${team.short_name})`}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  )}

                                  {team2MyTeams.length > 0 && (
                                    <>
                                      {team2ClubTeams.length > 0 && (
                                        <SelectSeparator />
                                      )}
                                      <SelectGroup>
                                        <SelectLabel>
                                          My Other Squads
                                        </SelectLabel>
                                        {team2MyTeams.map((team) => (
                                          <SelectItem
                                            key={team.id}
                                            value={team.id}
                                          >
                                            {team.name}
                                            {team.short_name &&
                                              ` (${team.short_name})`}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </>
                                  )}
                                </>
                              )}

                              {!formData.tournamentId &&
                                !formData.clubId &&
                                team2MyTeams.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>
                                      My Squads (Internal Match)
                                    </SelectLabel>
                                    {team2MyTeams.map((team) => (
                                      <SelectItem key={team.id} value={team.id}>
                                        {team.name}
                                        {team.short_name &&
                                          ` (${team.short_name})`}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                            </>
                          )}
                        </SelectContent>
                      </Select>

                      {!formData.tournamentId ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-7 text-xs text-muted-foreground"
                            onClick={() => {
                              setNewTeamFor("team2Id");
                              setNewTeamName("");
                            }}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Create opponent team
                          </Button>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formData.clubId
                              ? "Select a club squad, one of your squads, or create a new opponent squad."
                              : "For friendly matches, select one of your squads or create a new opponent team. Unaffiliated external teams cannot be selected directly to prevent unauthorized matches."}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Only teams registered in this tournament can be
                          selected as opponents.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Details */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-2 text-xl font-semibold">
                    Match Details & Associations
                  </h2>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Add venue, schedule, and tournament or club linkage
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Match Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., League Match - Round 1"
                      value={formData.title}
                      onChange={(e) => updateField("title", e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  {/* Tournament Selector */}
                  <div>
                    <Label htmlFor="tournament_select">
                      Tournament (Optional)
                    </Label>
                    <Select
                      value={formData.tournamentId || "none"}
                      onValueChange={(val) =>
                        updateField("tournamentId", val === "none" ? "" : val)
                      }
                    >
                      <SelectTrigger id="tournament_select" className="mt-2">
                        <SelectValue placeholder="Independent match (no tournament)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          None (Independent / Friendly)
                        </SelectItem>
                        {selectableTournaments.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <div className="flex items-center gap-2">
                              <Trophy className="h-3.5 w-3.5 text-amber-500" />
                              <span>{t.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Only tournaments you organize or are pre-selected are
                      shown.
                    </p>
                  </div>

                  {/* Club Selector */}
                  <div>
                    <Label htmlFor="club_select">
                      Club / Organization (Optional)
                    </Label>
                    <Select
                      value={formData.clubId || "none"}
                      onValueChange={(val) =>
                        updateField("clubId", val === "none" ? "" : val)
                      }
                    >
                      <SelectTrigger id="club_select" className="mt-2">
                        <SelectValue placeholder="Independent match (no club)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          None (Independent match)
                        </SelectItem>
                        {selectableClubs.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{c.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Only clubs you administer or that your selected teams
                      belong to are shown.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="venue">Venue</Label>
                    <Input
                      id="venue"
                      placeholder="e.g., Central Park Cricket Ground"
                      value={formData.venue}
                      onChange={(e) => updateField("venue", e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="datetime">Date & Time</Label>
                    <Input
                      id="datetime"
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={(e) =>
                        updateField("scheduledAt", e.target.value)
                      }
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="umpire1">Umpire 1</Label>
                      <Input
                        id="umpire1"
                        placeholder="Name"
                        value={formData.umpire1Name}
                        onChange={(e) =>
                          updateField("umpire1Name", e.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="umpire2">Umpire 2</Label>
                      <Input
                        id="umpire2"
                        placeholder="Name"
                        value={formData.umpire2Name}
                        onChange={(e) =>
                          updateField("umpire2Name", e.target.value)
                        }
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-2 text-xl font-semibold">
                    Review Match Details
                  </h2>
                  <p className="mb-6 text-sm text-muted-foreground">
                    Verify match parameters before opening the scorecard
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Match Title</span>
                    <span className="font-semibold">{formData.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Format</span>
                    <span className="font-medium">
                      {formData.matchFormat} ({formData.oversPerInnings} overs)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team 1</span>
                    <span className="font-medium">
                      {getTeamName(formData.team1Id)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team 2</span>
                    <span className="font-medium">
                      {getTeamName(formData.team2Id)}
                    </span>
                  </div>
                  {selectedTournament && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tournament</span>
                      <span className="font-semibold text-amber-500">
                        {selectedTournament.name}
                      </span>
                    </div>
                  )}
                  {selectedClub && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Club</span>
                      <span className="font-semibold text-foreground">
                        {selectedClub.name}
                      </span>
                    </div>
                  )}
                  {formData.venue && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Venue</span>
                      <span className="font-medium">{formData.venue}</span>
                    </div>
                  )}
                  {formData.scheduledAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date/Time</span>
                      <span className="font-medium">
                        {new Date(formData.scheduledAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {!isMatchValidForSubmission && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="text-xs">
                      The selected teams are not both registered in this
                      tournament. Please go back to Step 2 to select registered
                      teams.
                    </span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-500">
                    <AlertCircle className="h-5 w-5" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between border-t pt-6">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {step < 4 ? (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={
                    (step === 1 && !canProceedStep1) ||
                    (step === 2 && !canProceedStep2) ||
                    (step === 3 && !canProceedStep3)
                  }
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !isMatchValidForSubmission}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Create Match
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Inline New Team Dialog */}
        <Dialog
          open={newTeamFor !== null}
          onOpenChange={(open) => !open && setNewTeamFor(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {newTeamFor === "team1Id"
                  ? "Create Your Team (Team 1)"
                  : "Create Opponent Team (Team 2)"}
              </DialogTitle>
              <DialogDescription>
                Quickly register a new team roster to use immediately for this
                match fixture.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="inline_team_name">Team Name</Label>
                <Input
                  id="inline_team_name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Mumbai Lions"
                  className="mt-2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      newTeamName.trim() &&
                      !newTeamSaving
                    ) {
                      e.preventDefault();
                      void handleCreateInlineTeam();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleCreateInlineTeam}
                disabled={!newTeamName.trim() || newTeamSaving}
                className="w-full"
              >
                {newTeamSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Save and Select Team"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default function CreateMatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CreateMatchWizard />
    </Suspense>
  );
}
