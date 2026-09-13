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
  Calendar,
  MapPin,
  Trophy,
  Users,
  Flame,
  Award,
  Plus,
  Radio,
  Sparkles,
  Shield,
  ExternalLink,
} from "lucide-react";
import { RegisterTeamDialog } from "~/components/tournaments/register-team-dialog";
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    supabase.from("teams").select("id, name, short_name").order("name"),
  ]);

  if (!tournament) notFound();

  const matchIds = ((matches ?? []) as unknown as MatchRow[]).map((m) => m.id);

  // Super Stars & Leaderboards computation
  let battingLeaders: Array<{
    userId: string;
    name: string;
    avatar?: string | null;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    inningsCount: number;
    strikeRate: string;
  }> = [];

  let bowlingLeaders: Array<{
    userId: string;
    name: string;
    avatar?: string | null;
    wickets: number;
    overs: string;
    runs: number;
    economy: string;
  }> = [];

  interface UserJoined {
    full_name?: string | null;
    avatar_url?: string | null;
  }

  const resolveUser = (
    raw: unknown,
  ): { name: string; avatar?: string | null } => {
    if (!raw) return { name: "Player" };
    const u = Array.isArray(raw)
      ? (raw[0] as UserJoined | undefined)
      : (raw as UserJoined);
    return {
      name: u?.full_name ?? "Player",
      avatar: u?.avatar_url ?? null,
    };
  };

  if (matchIds.length > 0) {
    const [{ data: batting }, { data: bowling }] = await Promise.all([
      supabase
        .from("batting_performances")
        .select(
          "user_id, runs_scored, balls_faced, fours, sixes, user:users(id, full_name, avatar_url)",
        )
        .in("match_id", matchIds),
      supabase
        .from("bowling_performances")
        .select(
          "user_id, overs_bowled, balls_bowled, runs_conceded, wickets_taken, user:users(id, full_name, avatar_url)",
        )
        .in("match_id", matchIds),
    ]);

    // Aggregate batting
    const batMap = new Map<
      string,
      {
        name: string;
        avatar?: string | null;
        runs: number;
        balls: number;
        fours: number;
        sixes: number;
        innings: number;
      }
    >();

    for (const b of batting ?? []) {
      const userInfo = resolveUser(b.user);
      const current = batMap.get(b.user_id) ?? {
        name: userInfo.name,
        avatar: userInfo.avatar,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        innings: 0,
      };
      current.runs += b.runs_scored ?? 0;
      current.balls += b.balls_faced ?? 0;
      current.fours += b.fours ?? 0;
      current.sixes += b.sixes ?? 0;
      current.innings += 1;
      batMap.set(b.user_id, current);
    }

    battingLeaders = Array.from(batMap.entries())
      .map(([userId, stats]) => ({
        userId,
        name: stats.name,
        avatar: stats.avatar,
        runs: stats.runs,
        balls: stats.balls,
        fours: stats.fours,
        sixes: stats.sixes,
        inningsCount: stats.innings,
        strikeRate:
          stats.balls > 0
            ? ((stats.runs / stats.balls) * 100).toFixed(1)
            : "0.0",
      }))
      .sort((a, b) => b.runs - a.runs);

    // Aggregate bowling
    const bowlMap = new Map<
      string,
      {
        name: string;
        avatar?: string | null;
        wickets: number;
        balls: number;
        runs: number;
      }
    >();

    for (const b of bowling ?? []) {
      const userInfo = resolveUser(b.user);
      const current = bowlMap.get(b.user_id) ?? {
        name: userInfo.name,
        avatar: userInfo.avatar,
        wickets: 0,
        balls: 0,
        runs: 0,
      };
      current.wickets += b.wickets_taken ?? 0;
      current.balls += b.balls_bowled ?? 0;
      current.runs += b.runs_conceded ?? 0;
      bowlMap.set(b.user_id, current);
    }

    bowlingLeaders = Array.from(bowlMap.entries())
      .map(([userId, stats]) => {
        const oversNum = Math.floor(stats.balls / 6) + (stats.balls % 6) / 10;
        const totalOversDec = stats.balls / 6;
        return {
          userId,
          name: stats.name,
          avatar: stats.avatar,
          wickets: stats.wickets,
          overs: oversNum.toFixed(1),
          runs: stats.runs,
          economy:
            totalOversDec > 0
              ? (stats.runs / totalOversDec).toFixed(2)
              : "0.00",
        };
      })
      .sort((a, b) => b.wickets - a.wickets);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isTournamentAdmin = !!user && tournament.created_by === user.id;

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

  const topBatter = battingLeaders[0];
  const topBowler = bowlingLeaders[0];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Top Back Nav */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/tournaments">
          <ChevronLeft className="mr-1 h-4 w-4" />
          All Tournaments
        </Link>
      </Button>

      {/* Tournament Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/80 to-primary/5 p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  tournament.status === "ongoing"
                    ? "default"
                    : tournament.status === "completed"
                      ? "secondary"
                      : "outline"
                }
                className="capitalize"
              >
                {tournament.status === "ongoing" && (
                  <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                )}
                {tournament.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {tournament.tournament_format} Format
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

            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
              {tournament.name}
            </h1>

            {tournament.description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {tournament.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
          <div className="flex flex-wrap items-center gap-2">
            <PointsTableShare
              tournamentName={tournament.name}
              tournamentId={tournament.id}
              format={tournament.match_format ?? "T20"}
              standings={shareRows}
            />
            <RegisterTeamDialog
              tournamentId={tournament.id}
              availableTeams={
                (allTeams ?? []) as Array<{
                  id: string;
                  name: string;
                  short_name: string | null;
                }>
              }
              registeredTeamIds={registeredTeamIds}
            />
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/matches/create?tournamentId=${tournament.id}`}>
                <Plus className="h-4 w-4" />
                Schedule Match
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="standings" className="mt-8">
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="standings" className="gap-1.5">
            <Trophy className="h-4 w-4" />
            Points Table
          </TabsTrigger>
          <TabsTrigger value="fixtures" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Fixtures ({typedMatches.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="h-4 w-4" />
            Teams ({(registrations ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Super Stars
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: POINTS TABLE */}
        <TabsContent value="standings" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg">Tournament Standings</CardTitle>
                <CardDescription>
                  Points table with automated ICC Net Run Rate (NRR)
                  calculations.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
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
                <div className="py-12 text-center">
                  <Trophy className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <h3 className="mt-4 text-base font-semibold">
                    No Standings Yet
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Register teams and schedule tournament matches to activate
                    the automated points table.
                  </p>
                  <div className="mt-4">
                    <RegisterTeamDialog
                      tournamentId={tournament.id}
                      availableTeams={
                        (allTeams ?? []) as Array<{
                          id: string;
                          name: string;
                          short_name: string | null;
                        }>
                      }
                      registeredTeamIds={registeredTeamIds}
                    />
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                                href={`/teams/${teamObj?.id ?? s.team_id}`}
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
        <TabsContent value="fixtures" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">
                Tournament Fixtures & Matches
              </h2>
              <p className="text-xs text-muted-foreground">
                Track live scores, upcoming matches, and completed match
                results.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTournamentAdmin && typedMatches.length === 0 && (
                <GenerateFixturesButton tournamentId={tournament.id} />
              )}
              <Button asChild size="sm" className="gap-1.5">
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
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-500">
                  Live Now
                </h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {liveMatches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Fixtures */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming Fixtures ({upcomingMatches.length})
            </h3>
            {upcomingMatches.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No upcoming matches scheduled.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingMatches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            )}
          </div>

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Completed Results ({completedMatches.length})
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {completedMatches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: TEAMS & SQUADS */}
        <TabsContent value="teams" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Registered Teams</h2>
              <p className="text-xs text-muted-foreground">
                Participating teams and rosters in this tournament.
              </p>
            </div>
            <RegisterTeamDialog
              tournamentId={tournament.id}
              availableTeams={
                (allTeams ?? []) as Array<{
                  id: string;
                  name: string;
                  short_name: string | null;
                }>
              }
              registeredTeamIds={registeredTeamIds}
            />
          </div>

          {/* Admin Pending Join Requests Inbox */}
          {isTournamentAdmin && pendingRegistrations.length > 0 && (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Shield className="h-4 w-4" />
                Pending Registration Requests ({pendingRegistrations.length})
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
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No confirmed teams in this tournament yet.
              </CardContent>
            </Card>
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
                    href={`/teams/${r.team_id}`}
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
                          <span className="font-medium capitalize text-emerald-500">
                            {r.status}
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

        {/* TAB 4: SUPER STARS & LEADERBOARDS (STUMPS ANALYSIS) */}
        <TabsContent value="analysis" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Tournament Super Stars & Insights
              </h2>
              <p className="text-xs text-muted-foreground">
                Top performers, Orange Cap (Most Runs), and Purple Cap (Most
                Wickets) across all matches.
              </p>
            </div>
          </div>

          {/* Cap Highlights */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Orange Cap Leader */}
            <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card to-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="gap-1 bg-amber-500 text-black hover:bg-amber-400">
                    <Flame className="h-3.5 w-3.5 fill-current" />
                    ORANGE CAP LEADER
                  </Badge>
                  <span className="text-xs font-semibold uppercase text-amber-500">
                    Top Run Scorer
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {!topBatter ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Batting statistics will appear once tournament matches are
                    played.
                  </p>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">
                        {topBatter.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {topBatter.inningsCount} Innings · SR{" "}
                        {topBatter.strikeRate}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Fours:{" "}
                          <strong className="text-foreground">
                            {topBatter.fours}
                          </strong>
                        </span>
                        <span>
                          Sixes:{" "}
                          <strong className="text-foreground">
                            {topBatter.sixes}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-amber-500">
                        {topBatter.runs}
                      </div>
                      <span className="text-xs uppercase text-muted-foreground">
                        Runs
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Purple Cap Leader */}
            <Card className="border-purple-500/40 bg-gradient-to-br from-purple-500/10 via-card to-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="gap-1 bg-purple-600 text-white hover:bg-purple-500">
                    <Award className="h-3.5 w-3.5 fill-current" />
                    PURPLE CAP LEADER
                  </Badge>
                  <span className="text-xs font-semibold uppercase text-purple-400">
                    Top Wicket Taker
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {!topBowler ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Bowling statistics will appear once tournament matches are
                    played.
                  </p>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">
                        {topBowler.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {topBowler.overs} Overs Bowled · Econ{" "}
                        {topBowler.economy}
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Runs Conceded:{" "}
                        <strong className="text-foreground">
                          {topBowler.runs}
                        </strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-black text-purple-400">
                        {topBowler.wickets}
                      </div>
                      <span className="text-xs uppercase text-muted-foreground">
                        Wickets
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Leaderboard Tables */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Batting Leaderboard */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Most Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {battingLeaders.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No batting records yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border text-sm">
                    {battingLeaders.slice(0, 5).map((player, idx) => (
                      <div
                        key={player.userId}
                        className="flex items-center justify-between py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-xs font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-foreground">
                              {player.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {player.balls} balls · SR {player.strikeRate}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-foreground">
                            {player.runs}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {player.fours}×4, {player.sixes}×6
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bowling Leaderboard */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-purple-500" />
                  Most Wickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bowlingLeaders.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No bowling records yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border text-sm">
                    {bowlingLeaders.slice(0, 5).map((player, idx) => (
                      <div
                        key={player.userId}
                        className="flex items-center justify-between py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-xs font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-foreground">
                              {player.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {player.overs} ov · Econ {player.economy}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-foreground">
                            {player.wickets} wkt
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {player.runs} runs
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchCard({ match }: { match: MatchRow }) {
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";

  // Find innings for team1 and team2
  const inn1 = match.innings?.find((i) => i.team_id === match.team1?.id);
  const inn2 = match.innings?.find((i) => i.team_id === match.team2?.id);

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
            className="capitalize"
          >
            {isLive && (
              <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            )}
            {match.status}
          </Badge>
        </div>

        <div className="space-y-2">
          {/* Team 1 Score */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {match.team1?.name ?? "Team 1"}
            </span>
            {inn1?.total_runs !== undefined && inn1.total_runs !== null ? (
              <span className="tabular text-sm font-bold">
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
              <span className="tabular text-sm font-bold">
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
            <Link href={`/matches/${match.id}`}>
              {isLive ? "Match Center (Live)" : "View Scorecard"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
