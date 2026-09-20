import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Trophy,
  Users,
  Plus,
  Radio,
  Shield,
  ExternalLink,
} from "lucide-react";
import { RegisterTeamDialog } from "~/components/tournaments/register-team-dialog";
import { EmptyState } from "~/components/ui/empty-state";
import {
  PointsTableShare,
  type StandingsShareRow,
} from "~/components/tournaments/points-table-share";
import {
  PointsOverrideButton,
  QualificationCalculatorButton,
  GenerateFixturesButton,
  RegistrationApprovalActions,
} from "~/components/tournaments/tournament-admin-actions";
import { formatStatus, formatTournamentFormat } from "~/lib/cricket";
import { LeaderboardView } from "~/components/leaderboard/leaderboard-view";
import { buildLeaderboardData, LeaderboardData } from "~/lib/leaderboard";

export const dynamic = "force-dynamic";

interface InningsRow {
  id: string;
  team_id: string;
  innings_number: number;
  total_runs: number | null;
  total_wickets: number | null;
  total_balls: number | null;
  total_overs: number | null;
}

interface MatchRow {
  id: string;
  title: string;
  match_format: string | null;
  overs_per_innings: number | null;
  status: string | null;
  venue: string | null;
  scheduled_at: string | null;
  result_type: string | null;
  win_margin: number | null;
  win_margin_type: string | null;
  result_description: string | null;
  winning_team_id: string | null;
  team1: { id: string; name: string; short_name: string | null } | null;
  team2: { id: string; name: string; short_name: string | null } | null;
  innings?: InningsRow[];
}

export default async function TournamentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string; clubId?: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerClient();

  const [
    { data: tournament },
    { data: standings },
    { data: registrations },
    { data: matches },
    { data: allTeams },
  ] = await Promise.all([
    supabase
      .from("tournaments")
      .select("*, club:clubs(id, name, short_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("tournament_standings")
      .select(
        "*, team:teams!tournament_standings_team_id_fkey(id, name, short_name, logo_url)",
      )
      .eq("tournament_id", id)
      .order("points", { ascending: false })
      .order("net_run_rate", { ascending: false }),
    supabase
      .from("tournament_registrations")
      .select(
        "*, team:teams(id, name, short_name, logo_url, captain:users!teams_captain_id_fkey(full_name), team_players(count))",
      )
      .eq("tournament_id", id)
      .order("registered_at", { ascending: true }),
    supabase
      .from("matches")
      .select(
        `
                id, title, match_format, overs_per_innings, status, venue, scheduled_at,
                result_type, win_margin, win_margin_type, result_description, winning_team_id,
                team1:teams!matches_team1_id_fkey(id, name, short_name),
                team2:teams!matches_team2_id_fkey(id, name, short_name),
                innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs)
            `,
      )
      .eq("tournament_id", id)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("teams")
      .select(
        "id, name, short_name, club_id, created_by, captain_id, vice_captain_id",
      )
      .order("name"),
  ]);

  if (!tournament) notFound();

  const matchIds = ((matches ?? []) as unknown as MatchRow[]).map((m) => m.id);

  // Super Stars & Leaderboards computation
  let leaderboardData: LeaderboardData = buildLeaderboardData({});

  if (matchIds.length > 0) {
    const [battingRes, bowlingRes, fowRes] =
      await Promise.all([
        supabase
          .from("batting_performances")
          .select(
            "match_id, innings_id, user_id, runs_scored, balls_faced, fours, sixes, is_out, dismissal_type, bowler_id, fielder_id, user:users!batting_performances_user_id_fkey(id, full_name, avatar_url), fielder:users!batting_performances_fielder_id_fkey(id, full_name, avatar_url)",
          )
          .in("match_id", matchIds),
        supabase
          .from("bowling_performances")
          .select(
            "match_id, innings_id, user_id, overs_bowled, balls_bowled, runs_conceded, wickets_taken, maidens, wides, no_balls, user:users!bowling_performances_user_id_fkey(id, full_name, avatar_url)",
          )
          .in("match_id", matchIds),
        supabase
          .from("fall_of_wickets")
          .select(
            "match_id, innings_id, batsman_out_id, bowler_id, fielder_id, dismissal_type, fielder:users!fall_of_wickets_fielder_id_fkey(id, full_name, avatar_url)",
          )
          .in("match_id", matchIds),
      ]);

    if (battingRes.error) {
      console.error("Error fetching tournament batting performances:", battingRes.error);
    }
    if (bowlingRes.error) {
      console.error("Error fetching tournament bowling performances:", bowlingRes.error);
    }
    if (fowRes.error) {
      console.error("Error fetching tournament fall of wickets:", fowRes.error);
    }

    leaderboardData = buildLeaderboardData({
      batting: battingRes.data,
      bowling: bowlingRes.data,
      fallOfWickets: fowRes.data,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isClubAdmin = false;
  if (user && tournament.club_id) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", tournament.club_id)
      .single();

    if (club?.owner_id === user.id) {
      isClubAdmin = true;
    } else {
      const { data: mem } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", tournament.club_id)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();

      if (mem) isClubAdmin = true;
    }
  }

  const isTournamentAdmin =
    !!user && (tournament.created_by === user.id || isClubAdmin);

  const myTeamIds = new Set<string>();
  if (user && !isTournamentAdmin) {
    const [teamPlayersRes, clubMemsRes, clubsRes] = await Promise.all([
      supabase.from("team_players").select("team_id").eq("user_id", user.id),
      supabase
        .from("club_memberships")
        .select("club_id")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active"),
      supabase.from("clubs").select("id").eq("owner_id", user.id),
    ]);

    const adminClubIds = new Set<string>([
      ...(clubMemsRes.data ?? []).map((m) => m.club_id),
      ...(clubsRes.data ?? []).map((c) => c.id),
    ]);
    const playerTeamIds = new Set<string>(
      (teamPlayersRes.data ?? []).map((r) => r.team_id),
    );

    (allTeams ?? []).forEach(
      (t: {
        id: string;
        club_id?: string | null;
        created_by?: string | null;
        captain_id?: string | null;
        vice_captain_id?: string | null;
      }) => {
        if (
          t.created_by === user.id ||
          t.captain_id === user.id ||
          t.vice_captain_id === user.id ||
          playerTeamIds.has(t.id) ||
          (t.club_id && adminClubIds.has(t.club_id))
        ) {
          myTeamIds.add(t.id);
        }
      },
    );
  }

  const availableTeams = (
    isTournamentAdmin
      ? (allTeams ?? [])
      : (allTeams ?? []).filter((t: { id: string }) => myTeamIds.has(t.id))
  ) as Array<{
    id: string;
    name: string;
    short_name: string | null;
  }>;

  const canRegisterTeams = isTournamentAdmin || availableTeams.length > 0;

  const pendingRegistrations = (registrations ?? []).filter(
    (r) => r.status === "pending",
  );
  const confirmedRegistrations = (registrations ?? []).filter(
    (r) => r.status === "confirmed",
  );
  const registeredTeamIds = (registrations ?? []).map((r) => r.team_id);

  const teamsForCalculator = (standings ?? []).map((s) => {
    const teamObj = s.team as { name: string } | null;
    return {
      teamId: s.team_id,
      teamName: teamObj?.name ?? s.team_id.slice(0, 8),
      matchesPlayed: s.matches_played ?? 0,
      points: Number(s.points ?? 0),
      netRunRate: Number(s.net_run_rate ?? 0),
      qualificationStatus: s.qualification_status ?? "in_contention",
    };
  });

  const shareRows: StandingsShareRow[] = (standings ?? []).map((s, idx) => {
    const teamObj = s.team as {
      name: string;
      short_name: string | null;
    } | null;
    return {
      pos: idx + 1,
      teamName: teamObj?.name ?? s.team_id.slice(0, 8),
      shortName: teamObj?.short_name ?? null,
      p: s.matches_played ?? 0,
      w: s.wins ?? 0,
      l: s.losses ?? 0,
      t: s.ties ?? 0,
      pts: s.points ?? 0,
      nrr:
        Number(s.net_run_rate ?? 0) >= 0
          ? `+${Number(s.net_run_rate ?? 0).toFixed(2)}`
          : Number(s.net_run_rate ?? 0).toFixed(2),
    };
  });

  const typedMatches = (matches ?? []) as unknown as MatchRow[];
  const liveMatches = typedMatches.filter((m) => m.status === "live");
  const upcomingMatches = typedMatches.filter((m) => m.status === "scheduled");
  const completedMatches = typedMatches.filter((m) => m.status === "completed");

  const targetClubId = resolvedSearchParams?.clubId;
  const clubInfo = tournament.club as { id: string; name: string } | null;
  const backHref = targetClubId
    ? `/clubs/${targetClubId}?tab=tournaments`
    : "/tournaments";
  const backLabel =
    targetClubId && clubInfo?.name
      ? `Back to ${clubInfo.name}`
      : "All Tournaments";

  return (
    <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      {/* Top Back Nav & Breadcrumbs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="interactive-button pl-0 text-xs sm:text-sm"
        >
          <Link href={backHref}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        </Button>
        {targetClubId && clubInfo && (
          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-1.5 border-l pl-3 text-xs text-muted-foreground sm:flex"
          >
            <Link href="/clubs" className="hover:text-foreground">
              Clubs
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <Link
              href={`/clubs/${targetClubId}?tab=tournaments`}
              className="max-w-[150px] truncate hover:text-foreground"
            >
              {clubInfo.name}
            </Link>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="max-w-[180px] truncate font-medium text-foreground">
              {tournament.name}
            </span>
          </nav>
        )}
      </div>

      {/* Tournament Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/80 to-primary/5 p-4 shadow-sm sm:p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge
                variant={
                  tournament.status === "ongoing"
                    ? "default"
                    : tournament.status === "completed"
                      ? "secondary"
                      : "outline"
                }
              >
                {tournament.status === "ongoing" && (
                  <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                )}
                {formatStatus(tournament.status)}
              </Badge>
              <Badge variant="outline">
                {formatTournamentFormat(tournament.tournament_format)} Format
              </Badge>
              <Badge variant="secondary">{tournament.match_format}</Badge>
              {tournament.club && (
                <Link href={`/clubs/${(tournament.club as { id: string }).id}`}>
                  <Badge variant="outline" className="hover:border-primary/50">
                    <Shield className="mr-1 h-3 w-3" />
                    {(tournament.club as { name: string }).name}
                  </Badge>
                </Link>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">
              {tournament.name}
            </h1>

            {tournament.description && (
              <p className="mt-2 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                {tournament.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4">
              {tournament.venue && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{tournament.venue}</span>
                </div>
              )}
              {(tournament.start_date || tournament.end_date) && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {tournament.start_date ?? "TBD"}
                    {tournament.end_date ? ` to ${tournament.end_date}` : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>{(registrations ?? []).length} Teams registered</span>
              </div>
            </div>
          </div>

          {/* Hero Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <PointsTableShare
              tournamentName={tournament.name}
              tournamentId={tournament.id}
              format={tournament.match_format ?? "T20"}
              standings={shareRows}
            />
            {canRegisterTeams && (
              <RegisterTeamDialog
                tournamentId={tournament.id}
                availableTeams={availableTeams}
                registeredTeamIds={registeredTeamIds}
              />
            )}
            {isTournamentAdmin && (
              <Button
                asChild
                size="sm"
                className="w-full justify-center gap-1.5 sm:w-auto"
              >
                <Link href={`/matches/create?tournamentId=${tournament.id}`}>
                  <Plus className="h-4 w-4" />
                  Schedule Match
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs
        defaultValue={resolvedSearchParams?.tab ?? "standings"}
        className="mt-6 sm:mt-8"
      >
        <TabsList className="flex h-auto w-full overflow-x-auto no-scrollbar gap-1 rounded-xl p-1 sm:grid sm:grid-cols-4 sm:max-w-xl">
          <TabsTrigger
            value="standings"
            className="shrink-0 whitespace-nowrap gap-1.5 px-3.5 py-2 text-xs font-semibold min-h-[40px] sm:min-h-0 sm:px-3 sm:text-sm"
          >
            <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Points Table
          </TabsTrigger>
          <TabsTrigger
            value="fixtures"
            className="shrink-0 whitespace-nowrap gap-1.5 px-3.5 py-2 text-xs font-semibold min-h-[40px] sm:min-h-0 sm:px-3 sm:text-sm"
          >
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Fixtures ({typedMatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="shrink-0 whitespace-nowrap gap-1.5 px-3.5 py-2 text-xs font-semibold min-h-[40px] sm:min-h-0 sm:px-3 sm:text-sm"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Teams ({(registrations ?? []).length})
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="shrink-0 whitespace-nowrap gap-1.5 px-3.5 py-2 text-xs font-semibold min-h-[40px] sm:min-h-0 sm:px-3 sm:text-sm"
          >
            <Trophy className="h-3.5 w-3.5 text-amber-500 sm:h-4 sm:w-4" />
            Leaderboard & Stats
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: POINTS TABLE */}
        <TabsContent value="standings" className="mt-4 space-y-6 sm:mt-6">
          <Card>
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  Tournament Standings
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Points table with automated ICC Net Run Rate (NRR)
                  calculations.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <QualificationCalculatorButton
                  tournamentName={tournament.name}
                  teams={teamsForCalculator}
                />
                <PointsTableShare
                  tournamentName={tournament.name}
                  tournamentId={tournament.id}
                  format={tournament.match_format ?? "T20"}
                  standings={shareRows}
                />
              </div>
            </CardHeader>
            <CardContent>
              {(standings ?? []).length === 0 ? (
                <div className="py-6 text-center">
                  <EmptyState
                    icon={Trophy}
                    title="No Standings Yet"
                    description="Register participating squads and start tournament fixtures to begin auto-computing points tables and net run rates."
                  />
                  {canRegisterTeams && (
                    <div className="mt-4 flex justify-center">
                      <RegisterTeamDialog
                        tournamentId={tournament.id}
                        availableTeams={availableTeams}
                        registeredTeamIds={registeredTeamIds}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr className="border-b text-xs font-semibold text-muted-foreground">
                        <th className="px-3 py-3 text-left">Pos</th>
                        <th className="px-3 py-3 text-left">Team</th>
                        <th className="px-3 py-3 text-center">Status</th>
                        <th className="px-3 py-3 text-center">P</th>
                        <th className="px-3 py-3 text-center">W</th>
                        <th className="px-3 py-3 text-center">L</th>
                        <th className="px-3 py-3 text-center">T</th>
                        <th className="px-3 py-3 text-center">Pts</th>
                        <th className="px-3 py-3 text-center">NRR</th>
                        {isTournamentAdmin && (
                          <th className="px-3 py-3 text-center">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(standings ?? []).map((s, idx) => {
                        const isTop = idx === 0;
                        const teamObj = s.team as {
                          id: string;
                          name: string;
                          short_name: string | null;
                        } | null;
                        const nrrVal = Number(s.net_run_rate ?? 0);
                        return (
                          <tr
                            key={s.id}
                            className={`transition-colors hover:bg-muted/40 ${
                              isTop ? "bg-primary/5 font-medium" : ""
                            }`}
                          >
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                  isTop
                                    ? "bg-amber-500/20 text-amber-500"
                                    : idx === 1
                                      ? "bg-slate-300/20 text-slate-400"
                                      : idx === 2
                                        ? "bg-amber-700/20 text-amber-600"
                                        : "text-muted-foreground"
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <Link
                                href={`/teams/${teamObj?.id ?? s.team_id}?tournamentId=${tournament.id}`}
                                className="flex items-center gap-2 transition-colors hover:text-primary"
                              >
                                <span className="font-semibold text-foreground">
                                  {teamObj?.name ?? s.team_id.slice(0, 8)}
                                </span>
                                {teamObj?.short_name && (
                                  <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0 text-[10px]"
                                  >
                                    {teamObj.short_name}
                                  </Badge>
                                )}
                              </Link>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {s.qualification_status === "qualified" && (
                                <Badge className="border-emerald-500/40 bg-emerald-500/20 px-1.5 py-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  Q
                                </Badge>
                              )}
                              {s.qualification_status === "eliminated" && (
                                <Badge
                                  variant="destructive"
                                  className="px-1.5 py-0 text-[10px] font-bold"
                                >
                                  E
                                </Badge>
                              )}
                              {(!s.qualification_status ||
                                s.qualification_status === "in_contention") && (
                                <span className="text-[10px] text-muted-foreground/60">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="tabular px-3 py-3 text-center">
                              {s.matches_played}
                            </td>
                            <td className="tabular px-3 py-3 text-center font-medium text-emerald-500">
                              {s.wins}
                            </td>
                            <td className="tabular px-3 py-3 text-center text-red-400">
                              {s.losses}
                            </td>
                            <td className="tabular px-3 py-3 text-center text-muted-foreground">
                              {s.ties}
                            </td>
                            <td className="tabular px-3 py-3 text-center text-base font-bold text-foreground">
                              <div>{s.points}</div>
                              {s.points_adjustment &&
                                Number(s.points_adjustment) !== 0 && (
                                  <span className="block text-[10px] font-normal text-muted-foreground">
                                    {Number(s.points_adjustment) > 0
                                      ? `+${s.points_adjustment}`
                                      : s.points_adjustment}{" "}
                                    adj
                                  </span>
                                )}
                            </td>
                            <td
                              className={`tabular px-3 py-3 text-center font-mono text-xs ${
                                nrrVal > 0
                                  ? "font-semibold text-emerald-500"
                                  : nrrVal < 0
                                    ? "text-red-400"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {nrrVal > 0
                                ? `+${nrrVal.toFixed(2)}`
                                : nrrVal.toFixed(2)}
                            </td>
                            {isTournamentAdmin && (
                              <td className="px-3 py-3 text-center">
                                <PointsOverrideButton
                                  tournamentId={tournament.id}
                                  teamId={s.team_id}
                                  teamName={
                                    teamObj?.name ?? s.team_id.slice(0, 8)
                                  }
                                  currentAdjustment={s.points_adjustment}
                                  currentReason={s.adjustment_reason}
                                  currentStatus={s.qualification_status}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: FIXTURES & MATCHES */}
        <TabsContent value="fixtures" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Tournament Fixtures & Matches
              </h2>
              <p className="text-xs text-muted-foreground">
                Track live scores, upcoming matches, and completed match
                results.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isTournamentAdmin && typedMatches.length === 0 && (
                <GenerateFixturesButton tournamentId={tournament.id} />
              )}
              <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
                <Link href={`/matches/create?tournamentId=${tournament.id}`}>
                  <Plus className="h-4 w-4" />
                  Schedule Match
                </Link>
              </Button>
            </div>
          </div>

          {/* Live Matches Section */}
          {liveMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 animate-pulse text-emerald-400" />
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Live now
                </h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {liveMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    tournamentId={tournament.id}
                    clubId={targetClubId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Fixtures */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Upcoming fixtures ({upcomingMatches.length})
            </h3>
            {upcomingMatches.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No upcoming fixtures"
                description="No upcoming tournament matches are scheduled. Generate fixtures from the admin tab or schedule new matches."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    tournamentId={tournament.id}
                    clubId={targetClubId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Completed results ({completedMatches.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {completedMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    tournamentId={tournament.id}
                    clubId={targetClubId}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: TEAMS & SQUADS */}
        <TabsContent value="teams" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Registered teams
              </h2>
              <p className="text-xs text-muted-foreground">
                Participating teams and rosters in this tournament.
              </p>
            </div>
            {canRegisterTeams && (
              <RegisterTeamDialog
                tournamentId={tournament.id}
                availableTeams={availableTeams}
                registeredTeamIds={registeredTeamIds}
              />
            )}
          </div>

          {/* Admin Pending Join Requests Inbox */}
          {isTournamentAdmin && pendingRegistrations.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <Shield className="h-4 w-4" />
                Pending registration requests ({pendingRegistrations.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {pendingRegistrations.map((r) => {
                  const team = r.team as {
                    name: string;
                    short_name: string | null;
                  } | null;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {team?.name ?? "Team"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested:{" "}
                          {r.registered_at
                            ? new Date(r.registered_at).toLocaleDateString()
                            : "Recently"}
                        </p>
                      </div>
                      <RegistrationApprovalActions
                        registrationId={r.id}
                        tournamentId={tournament.id}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {confirmedRegistrations.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No Confirmed Teams"
              description="No confirmed squads have joined this tournament yet. Approve pending team registrations or register squads directly."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {confirmedRegistrations.map((r) => {
                const team = r.team as {
                  id: string;
                  name: string;
                  short_name: string | null;
                  captain?: { full_name: string } | null;
                  team_players?: { count: number }[];
                } | null;
                const playerCount = team?.team_players?.[0]?.count ?? 0;
                return (
                  <Link
                    key={r.id}
                    href={`/teams/${r.team_id}?tournamentId=${tournament.id}`}
                    className="group"
                  >
                    <Card className="transition-colors group-hover:border-primary/50">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-foreground transition-colors group-hover:text-primary">
                              {team?.name ?? r.team_id}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Captain:{" "}
                              {team?.captain?.full_name ?? "Not assigned"}
                            </p>
                          </div>
                          {team?.short_name && (
                            <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                              {team.short_name}
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                          <span>{playerCount} Players in Squad</span>
                          <span className="font-medium text-emerald-500">
                            {formatStatus(r.status)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: SUPER STARS & LEADERBOARDS */}
        <TabsContent value="analysis" className="mt-6 space-y-6">
          <LeaderboardView
            title="Tournament Super Stars & Leaderboards"
            subtitle={`Complete player statistics, Orange & Purple caps, and MVP rankings for ${tournament.name}`}
            data={leaderboardData}
            showHighlights={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchCard({
  match,
  tournamentId,
  clubId,
}: {
  match: MatchRow;
  tournamentId?: string;
  clubId?: string;
}) {
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";

  // Find innings for team1 and team2
  const inn1 = match.innings?.find((i) => i.team_id === match.team1?.id);
  const inn2 = match.innings?.find((i) => i.team_id === match.team2?.id);

  const matchHref = `/matches/${match.id}?tournamentId=${tournamentId ?? ""}${
    clubId ? `&clubId=${clubId}` : ""
  }`;

  return (
    <Card
      className={`transition-colors hover:border-primary/40 ${isLive ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}
    >
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {match.venue ?? "Venue TBD"}
          </span>
          <Badge
            variant={isLive ? "default" : isCompleted ? "secondary" : "outline"}
          >
            {isLive && (
              <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            )}
            {formatStatus(match.status)}
          </Badge>
        </div>

        <div className="space-y-2">
          {/* Team 1 Score */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {match.team1?.name ?? "Team 1"}
            </span>
            {inn1?.total_runs !== undefined && inn1.total_runs !== null ? (
              <span className="tabular text-base font-bold">
                {inn1.total_runs}/{inn1.total_wickets ?? 0}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({inn1.total_overs ?? 0} ov)
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          {/* Team 2 Score */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {match.team2?.name ?? "Team 2"}
            </span>
            {inn2?.total_runs !== undefined && inn2.total_runs !== null ? (
              <span className="tabular text-base font-bold">
                {inn2.total_runs}/{inn2.total_wickets ?? 0}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({inn2.total_overs ?? 0} ov)
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        </div>

        {match.result_description && (
          <div className="mt-3 rounded-md bg-muted/60 p-2 text-xs font-medium text-primary">
            {match.result_description}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 gap-1 text-xs"
          >
            <Link href={`/overlay/${match.id}`} target="_blank">
              <ExternalLink className="h-3 w-3" />
              Overlay
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild className="h-7 text-xs">
            <Link href={matchHref}>
              {isLive ? "Match Center" : "View Scorecard"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
