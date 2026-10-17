"use client";

import { useId, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ChevronLeft, Loader2, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { segmentedItem, segmentedTrack } from "~/components/ui/segmented";
import { PageContainer } from "~/components/layout/page";
import { useAuth } from "~/lib/auth";
import {
  useMatchWizardDataQuery,
  useTournamentRegistrationsQuery,
} from "~/lib/hooks/useMatchQueries";
import { cn } from "~/lib/utils";
import { createMatch } from "../mutations";
import { createTeamQuick } from "../../teams/actions";
import type { MatchFormat } from "../types";
import {
  defaultTitle,
  fieldError,
  FORMAT_PRESETS,
  formatForOvers,
  LIMITS,
  loadSetup,
  saveSetup,
  setupBlocker,
  teamGroups,
  type SetupTeam,
} from "./match-setup";
import { TeamPicker, type CreateTeamResult } from "./team-picker";
import { QuickPlayers } from "./quick-players";

interface TournamentOption {
  id: string;
  name: string;
  match_format?: string | null;
  custom_overs?: number | null;
  created_by?: string | null;
  club_id?: string | null;
}

interface ClubOption {
  id: string;
  name: string;
  owner_id?: string | null;
}

/** A full side: below this the form offers to add players inline. */
const FULL_SQUAD = 11;

function MatchSetupForm({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTournamentId = searchParams.get("tournamentId") ?? "";
  const urlClubId = searchParams.get("clubId") ?? "";
  const queryClient = useQueryClient();
  const ids = {
    overs: useId(),
    wickets: useId(),
    balls: useId(),
    when: useId(),
    datetime: useId(),
    title: useId(),
    venue: useId(),
    tournament: useId(),
    club: useId(),
    umpire1: useId(),
    umpire2: useId(),
    more: useId(),
    blocker: useId(),
  };

  // Mounted only on the client (after auth resolves), so reading
  // localStorage in the initializer cannot cause a hydration mismatch.
  const [stored] = useState(loadSetup);
  const [team1Id, setTeam1Id] = useState(stored.lastTeam1Id);
  const [team2Id, setTeam2Id] = useState("");
  const [matchFormat, setMatchFormat] = useState<MatchFormat>(
    stored.matchFormat,
  );
  const [overs, setOvers] = useState(String(stored.oversPerInnings));
  const [wickets, setWickets] = useState(String(stored.wicketsPerInnings));
  const [ballsPerOver, setBallsPerOver] = useState(String(stored.ballsPerOver));
  const [wideCountsAsBallFaced, setWideCountsAsBallFaced] = useState(
    stored.wideCountsAsBallFaced,
  );
  const [wideRunsToBatsman, setWideRunsToBatsman] = useState(
    stored.wideRunsToBatsman,
  );
  const [noballExtrasToBatsman, setNoballExtrasToBatsman] = useState(
    stored.noballExtrasToBatsman,
  );
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [umpire1, setUmpire1] = useState("");
  const [umpire2, setUmpire2] = useState("");
  const [tournamentId, setTournamentId] = useState(urlTournamentId);
  const [clubId, setClubId] = useState(urlClubId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTeams, setCreatedTeams] = useState<SetupTeam[]>([]);
  const [addedPlayers, setAddedPlayers] = useState<Record<string, number>>({});

  const {
    data: wizardData,
    isLoading: wizardLoading,
    error: wizardQueryError,
    refetch,
  } = useMatchWizardDataQuery(userId);
  const { data: registeredSet } = useTournamentRegistrationsQuery(tournamentId);
  const tournamentTeamIds = useMemo(
    () => registeredSet ?? new Set<string>(),
    [registeredSet],
  );

  const teams = useMemo(() => {
    const created = new Set(createdTeams.map((t) => t.id));
    return [
      ...createdTeams,
      ...((wizardData?.teams ?? []) as SetupTeam[]).filter(
        (t) => !created.has(t.id),
      ),
    ].map((t) =>
      addedPlayers[t.id]
        ? { ...t, player_count: (t.player_count ?? 0) + addedPlayers[t.id]! }
        : t,
    );
  }, [createdTeams, wizardData?.teams, addedPlayers]);
  const tournaments = (wizardData?.tournaments ?? []) as TournamentOption[];
  const clubs = (wizardData?.clubs ?? []) as ClubOption[];
  const clubAdminIds = useMemo(
    () => new Set<string>(wizardData?.clubAdminIds ?? []),
    [wizardData?.clubAdminIds],
  );

  // A tournament link sets the format once its list has loaded.
  const [appliedTournament, setAppliedTournament] = useState("");
  if (urlTournamentId && appliedTournament !== urlTournamentId) {
    const t = tournaments.find((x) => x.id === urlTournamentId);
    if (t) {
      setAppliedTournament(urlTournamentId);
      const preset = FORMAT_PRESETS.find((p) => p.format === t.match_format);
      const tOvers = preset?.overs ?? t.custom_overs ?? null;
      if (tOvers) {
        setMatchFormat(preset?.format ?? "Custom");
        setOvers(String(tOvers));
      }
    }
  }

  const selectedTournament = tournaments.find((t) => t.id === tournamentId);
  const selectedClub = clubs.find((c) => c.id === clubId);
  const isTournamentOrganizer = Boolean(
    selectedTournament &&
      (selectedTournament.created_by === userId ||
        (selectedTournament.club_id &&
          clubAdminIds.has(selectedTournament.club_id))),
  );

  const groups = useMemo(
    () =>
      teamGroups({
        teams,
        userId,
        playerTeamIds: wizardData?.playerTeamIds ?? [],
        clubAdminIds,
        tournamentId,
        clubId,
        tournamentTeamIds,
        isTournamentOrganizer,
      }),
    [
      teams,
      userId,
      wizardData?.playerTeamIds,
      clubAdminIds,
      tournamentId,
      clubId,
      tournamentTeamIds,
      isTournamentOrganizer,
    ],
  );
  const eligible1 = new Set(groups.team1.flatMap((g) => g.teams.map((t) => t.id)));
  const eligible2 = new Set(groups.team2.flatMap((g) => g.teams.map((t) => t.id)));
  // A remembered team only counts while it is still eligible.
  const effectiveTeam1 = eligible1.has(team1Id) ? team1Id : "";
  const team1 = teams.find((t) => t.id === effectiveTeam1);
  const team2 = teams.find((t) => t.id === team2Id);
  const without = (exclude: string) => (g: { label: string; teams: SetupTeam[] }) => ({
    ...g,
    teams: g.teams.filter((t) => t.id !== exclude),
  });
  const team1Options = groups.team1.map(without(team2Id)).filter((g) => g.teams.length);
  const team2Options = groups.team2.map(without(effectiveTeam1)).filter((g) => g.teams.length);

  const selectableTournaments = tournaments.filter(
    (t) =>
      t.id === urlTournamentId ||
      t.id === tournamentId ||
      t.created_by === userId ||
      (t.club_id && clubAdminIds.has(t.club_id)),
  );
  const selectableClubs = clubs.filter(
    (c) =>
      c.id === urlClubId ||
      c.id === clubId ||
      clubAdminIds.has(c.id) ||
      team1?.club_id === c.id ||
      team2?.club_id === c.id,
  );

  const oversNum = Number(overs);
  const wicketsNum = Number(wickets);
  const ballsNum = Number(ballsPerOver);
  const teamsLoading = wizardLoading && teams.length === 0;
  const loadError =
    (wizardQueryError instanceof Error ? wizardQueryError.message : null) ||
    wizardData?.error ||
    null;

  let blocker = teamsLoading
    ? "Loading teams"
    : setupBlocker(
        {
          team1Id: effectiveTeam1,
          team2Id,
          oversPerInnings: oversNum,
          wicketsPerInnings: wicketsNum,
          ballsPerOver: ballsNum,
          when,
          scheduledAt,
        },
        eligible1,
        eligible2,
      );
  if (
    !blocker &&
    tournamentId &&
    tournamentTeamIds.size > 0 &&
    !tournamentTeamIds.has(effectiveTeam1)
  ) {
    blocker = `Your team is not registered in ${selectedTournament?.name ?? "this tournament"}`;
  }

  const pickFormat = (format: MatchFormat) => {
    setMatchFormat(format);
    const preset = FORMAT_PRESETS.find((p) => p.format === format);
    if (preset?.overs) setOvers(String(preset.overs));
  };

  const changeOvers = (value: string) => {
    setOvers(value);
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) setMatchFormat(formatForOvers(n));
  };

  const pickTeam = (side: 1 | 2, id: string) => {
    if (side === 1) {
      setTeam1Id(id);
      if (id === team2Id) setTeam2Id("");
    } else {
      setTeam2Id(id);
      if (id === effectiveTeam1) setTeam1Id("");
    }
  };

  const createTeam = async (
    name: string,
    shortName: string,
  ): Promise<CreateTeamResult> => {
    const res = await createTeamQuick(name, shortName);
    if (res.error || !res.data) {
      return { team: null, error: res.error ?? "The team could not be created" };
    }
    const team: SetupTeam = {
      id: res.data.id,
      name: res.data.name,
      short_name: res.data.short_name,
      club_id: res.data.club_id,
      created_by: userId,
      player_count: 0,
    };
    setCreatedTeams((prev) => [team, ...prev]);
    void queryClient.invalidateQueries({ queryKey: ["matchWizardData"] });
    return { team, error: null };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocker || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await createMatch({
      title: title.trim() || defaultTitle(team1, team2),
      matchFormat,
      oversPerInnings: oversNum,
      wicketsPerInnings: wicketsNum,
      ballsPerOver: ballsNum,
      wideCountsAsBallFaced,
      wideRunsToBatsman,
      noballExtrasToBatsman,
      team1Id: effectiveTeam1,
      team2Id,
      venue: venue.trim() || undefined,
      scheduledAt:
        when === "now"
          ? new Date().toISOString()
          : new Date(scheduledAt).toISOString(),
      umpire1Name: umpire1.trim() || undefined,
      umpire2Name: umpire2.trim() || undefined,
      tournamentId: tournamentId || undefined,
      clubId: clubId || undefined,
    });
    if (result.error || !result.data) {
      setSubmitError(result.error ?? "The match could not be created");
      setSubmitting(false);
      return;
    }
    saveSetup(
      {
        matchFormat,
        oversPerInnings: oversNum,
        wicketsPerInnings: wicketsNum,
        ballsPerOver: ballsNum,
        wideCountsAsBallFaced,
        wideRunsToBatsman,
        noballExtrasToBatsman,
      },
      effectiveTeam1,
      team2Id,
    );
    // Start now: straight to scoring, where the toss opens first.
    router.push(
      when === "now"
        ? `/matches/${result.data.id}/score`
        : `/matches/${result.data.id}`,
    );
  };

  const backHref = selectedTournament
    ? `/tournaments/${selectedTournament.id}?tab=fixtures`
    : selectedClub || urlClubId
      ? `/clubs/${selectedClub?.id || urlClubId}?tab=matches`
      : "/matches";
  const context = selectedTournament?.name ?? selectedClub?.name;
  const rulesSummary = `${wicketsNum || "–"} wickets · ${ballsNum || "–"}-ball overs`;
  const opponentEmpty = tournamentId
    ? "No other teams are registered in this tournament."
    : "No opponent teams yet. Create one to continue.";

  return (
    <PageContainer size="form" stack={false}>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href={backHref}>
          <ChevronLeft className="mr-1 h-4 w-4 shrink-0" aria-hidden="true" />
          Back
        </Link>
      </Button>
      <h1 className="text-balance text-2xl font-semibold">New match</h1>
      {context && (
        <p className="mt-1 text-sm text-muted-foreground">For {context}</p>
      )}

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h2 className="font-semibold">Teams</h2>
            {loadError ? (
              <div
                role="alert"
                className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm"
              >
                <p className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Teams could not be loaded. {loadError}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            ) : teamsLoading ? (
              <p
                role="status"
                className="flex items-center gap-2 py-4 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                Loading teams
              </p>
            ) : (
              <>
                <div>
                  <TeamPicker
                    label="Your team"
                    title="Choose your team"
                    value={effectiveTeam1}
                    selected={team1}
                    groups={team1Options}
                    recentIds={stored.recentTeamIds}
                    onChange={(id) => pickTeam(1, id)}
                    onCreate={createTeam}
                    emptyMessage="You can host matches for teams you created, captain, play for or manage. Create one to continue."
                  />
                  {team1 && (team1.player_count ?? 0) < FULL_SQUAD && (
                    <QuickPlayers
                      key={team1.id}
                      teamId={team1.id}
                      teamName={team1.name}
                      playerCount={team1.player_count}
                      onAdded={() =>
                        setAddedPlayers((p) => ({ ...p, [team1.id]: (p[team1.id] ?? 0) + 1 }))
                      }
                    />
                  )}
                </div>
                <p className="text-center text-xs text-muted-foreground" aria-hidden="true">
                  vs
                </p>
                <div>
                  <TeamPicker
                    label="Opponent"
                    title="Choose the opponent"
                    value={team2Id}
                    selected={team2}
                    groups={team2Options}
                    recentIds={stored.recentTeamIds}
                    onChange={(id) => pickTeam(2, id)}
                    onCreate={tournamentId ? undefined : createTeam}
                    emptyMessage={opponentEmpty}
                  />
                  {team2 && (team2.player_count ?? 0) < FULL_SQUAD && (
                    <QuickPlayers
                      key={team2.id}
                      teamId={team2.id}
                      teamName={team2.name}
                      playerCount={team2.player_count}
                      onAdded={() =>
                        setAddedPlayers((p) => ({ ...p, [team2.id]: (p[team2.id] ?? 0) + 1 }))
                      }
                    />
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h2 id={`${ids.overs}-heading`} className="font-semibold">
              Format
            </h2>
            <div
              role="radiogroup"
              aria-labelledby={`${ids.overs}-heading`}
              className={cn(segmentedTrack, "sm:flex sm:w-full")}
            >
              {FORMAT_PRESETS.map((p) => (
                <button
                  key={p.format}
                  type="button"
                  role="radio"
                  aria-checked={matchFormat === p.format}
                  onClick={() => pickFormat(p.format)}
                  className={segmentedItem(
                    matchFormat === p.format,
                    "min-h-11 sm:min-h-10 sm:flex-1",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <NumberField
                id={ids.overs}
                label="Overs per side"
                field="overs"
                value={overs}
                onChange={changeOvers}
              />
              <p className="pb-2 text-sm text-muted-foreground">
                {rulesSummary}
                <span className="sr-only">. Change these under more options.</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <h2 id={ids.when} className="font-semibold">
              When
            </h2>
            <div role="radiogroup" aria-labelledby={ids.when} className={cn(segmentedTrack, "sm:flex sm:w-full")}>
              {(
                [
                  ["now", "Start now"],
                  ["later", "Schedule"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={when === value}
                  onClick={() => setWhen(value)}
                  className={segmentedItem(when === value, "min-h-11 sm:min-h-10 sm:flex-1")}
                >
                  {label}
                </button>
              ))}
            </div>
            {when === "later" ? (
              <div>
                <Label htmlFor={ids.datetime}>Date and time</Label>
                <Input
                  id={ids.datetime}
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1.5"
                  required
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                The scoring screen opens next, starting with the toss.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
              aria-controls={ids.more}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6"
            >
              <span>
                <span className="block font-semibold">More options</span>
                <span className="block text-xs text-muted-foreground">
                  Title, venue, tournament, club, wickets, extras, umpires
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  moreOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            <div
              id={ids.more}
              hidden={!moreOpen}
              className="space-y-4 border-t px-4 pb-5 pt-4 sm:px-6"
            >
              <div>
                <Label htmlFor={ids.title}>Match title</Label>
                <Input
                  id={ids.title}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={defaultTitle(team1, team2) || "Team A vs Team B"}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave empty to use the team names.
                </p>
              </div>
              <div>
                <Label htmlFor={ids.venue}>Venue</Label>
                <Input
                  id={ids.venue}
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Central Park ground"
                  className="mt-1.5"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={ids.tournament}>Tournament</Label>
                  <Select
                    value={tournamentId || "none"}
                    onValueChange={(v) => setTournamentId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id={ids.tournament} className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (friendly)</SelectItem>
                      {selectableTournaments.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={ids.club}>Club</Label>
                  <Select
                    value={clubId || "none"}
                    onValueChange={(v) => setClubId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id={ids.club} className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {selectableClubs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <NumberField
                  id={ids.wickets}
                  label="Wickets per side"
                  field="wickets"
                  value={wickets}
                  onChange={setWickets}
                />
                <NumberField
                  id={ids.balls}
                  label="Balls per over"
                  field="ballsPerOver"
                  value={ballsPerOver}
                  onChange={setBallsPerOver}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Extras</legend>
                {(
                  [
                    [wideCountsAsBallFaced, setWideCountsAsBallFaced, "A wide counts as a ball faced"],
                    [wideRunsToBatsman, setWideRunsToBatsman, "Runs off a wide go to the batter"],
                    [noballExtrasToBatsman, setNoballExtrasToBatsman, "No-ball extras go to the batter"],
                  ] as const
                ).map(([checked, set, label]) => (
                  <label key={label} className="flex min-h-9 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => set(e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={ids.umpire1}>Umpire 1</Label>
                  <Input
                    id={ids.umpire1}
                    value={umpire1}
                    onChange={(e) => setUmpire1(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor={ids.umpire2}>Umpire 2</Label>
                  <Input
                    id={ids.umpire2}
                    value={umpire2}
                    onChange={(e) => setUmpire2(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
          {submitError && (
            <p
              role="alert"
              className="mb-2 flex items-start gap-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {submitError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              id={ids.blocker}
              className="text-center text-xs text-muted-foreground sm:text-left"
              aria-live="polite"
            >
              {blocker ??
                (when === "now"
                  ? "Next: the toss, then the opening batters and bowler."
                  : "The match will appear in the fixtures list.")}
            </p>
            <Button
              type="submit"
              disabled={Boolean(blocker) || submitting}
              aria-describedby={ids.blocker}
              className="h-12 w-full sm:h-11 sm:w-auto sm:px-8"
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
              )}
              {when === "now" ? "Start match" : "Schedule match"}
            </Button>
          </div>
        </div>
      </form>
    </PageContainer>
  );
}

/** Number input with its range error shown as soon as it is out of range. */
function NumberField({
  id,
  label,
  field,
  value,
  onChange,
}: {
  id: string;
  label: string;
  field: keyof typeof LIMITS;
  value: string;
  onChange: (value: string) => void;
}) {
  const error = value === "" ? null : fieldError(field, Number(value));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={LIMITS[field].min}
        max={LIMITS[field].max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1.5 w-24 tabular-nums"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function CreateMatchGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="mb-2 text-xl font-semibold">Sign in required</h1>
            <p className="mb-4 text-muted-foreground">
              Sign in to create and score a match.
            </p>
            <Button asChild>
              <Link href="/auth/login?redirect=/matches/create">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <MatchSetupForm userId={user.id} />;
}

export default function CreateMatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" />
        </div>
      }
    >
      <CreateMatchGate />
    </Suspense>
  );
}
