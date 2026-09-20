import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TeamLogo } from "~/components/teams/team-logo";
import { formatPlayerRole } from "~/lib/cricket";
import {
  PlayerActivityTabs,
  type PlayerTeamMembership,
  type PlayerBattingPerformance,
  type PlayerBowlingPerformance,
  type PlayerMatchItem,
} from "~/components/players/player-activity-tabs";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="text-xl font-bold tabular-nums sm:text-2xl">{value}</div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    teamId?: string;
    tournamentId?: string;
    matchId?: string;
    clubId?: string;
    tab?: string;
  }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const { teamId, tournamentId, matchId, clubId, tab } =
    resolvedSearchParams ?? {};

  const supabase = await createServerClient();

  // Concurrently fetch current user, user profile, career stats, teams, batting performances, and bowling performances
  const [
    { data: currentUserData },
    { data: user },
    { data: stats },
    { data: teamPlayersData },
    { data: battingData },
    { data: bowlingData },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("users")
      .select("id, full_name, avatar_url, email")
      .eq("id", id)
      .single(),
    supabase.from("player_career_stats").select("*").eq("user_id", id).single(),
    supabase
      .from("team_players")
      .select(
        `
        id, role_in_team, jersey_number, batting_order, created_at,
        team:teams(id, name, short_name, logo_url, team_type, description, club:clubs(id, name))
      `,
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("batting_performances")
      .select(
        `
        id, match_id, innings_id, batting_position, runs_scored, balls_faced,
        fours, sixes, is_out, dismissal_type, bowler_id, fielder_id, created_at,
        bowler:users!batting_performances_bowler_id_fkey(id, full_name),
        fielder:users!batting_performances_fielder_id_fkey(id, full_name),
        match:matches!batting_performances_match_id_fkey(
          id, title, match_format, scheduled_at, status, venue,
          result_description, winning_team_id,
          team1:teams!matches_team1_id_fkey(id, name, short_name, logo_url),
          team2:teams!matches_team2_id_fkey(id, name, short_name, logo_url)
        )
      `,
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("bowling_performances")
      .select(
        `
        id, match_id, innings_id, overs_bowled, balls_bowled, runs_conceded,
        wickets_taken, maidens, wides, no_balls, created_at,
        match:matches!bowling_performances_match_id_fkey(
          id, title, match_format, scheduled_at, status, venue,
          result_description, winning_team_id,
          team1:teams!matches_team1_id_fkey(id, name, short_name, logo_url),
          team2:teams!matches_team2_id_fkey(id, name, short_name, logo_url)
        )
      `,
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!user) notFound();

  const isSelf = currentUserData?.user?.id === user.id;
  const teams = (teamPlayersData ?? []) as unknown as PlayerTeamMembership[];
  const batting = (battingData ?? []) as unknown as PlayerBattingPerformance[];
  const bowling = (bowlingData ?? []) as unknown as PlayerBowlingPerformance[];

  // Contextual navigation resolution
  let teamInfo: { id: string; name: string } | null = null;
  if (
    teamId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      teamId,
    )
  ) {
    const { data: t } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", teamId)
      .single();
    if (t) teamInfo = t;
  }

  let tournamentInfo: { id: string; name: string } | null = null;
  if (
    tournamentId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tournamentId,
    )
  ) {
    const { data: tr } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("id", tournamentId)
      .single();
    if (tr) tournamentInfo = tr;
  }

  let backHref = "/players";
  let backLabel = "Back to Players";
  if (teamInfo) {
    const q = new URLSearchParams();
    if (tournamentId) q.set("tournamentId", tournamentId);
    if (clubId) q.set("clubId", clubId);
    const qs = q.toString();
    backHref = `/teams/${teamInfo.id}${qs ? `?${qs}` : ""}`;
    backLabel = `Back to ${teamInfo.name}`;
  } else if (tournamentInfo) {
    backHref = `/tournaments/${tournamentInfo.id}?tab=analysis`;
    backLabel = `Back to ${tournamentInfo.name}`;
  } else if (matchId) {
    backHref = `/matches/${matchId}`;
    backLabel = "Back to Match";
  }

  // Fetch matches for the player's teams and performances
  const teamIds = teams.map((tp) => tp.team?.id).filter(Boolean);
  const perfMatchIds = Array.from(
    new Set([
      ...batting.map((b) => b.match_id),
      ...bowling.map((b) => b.match_id),
    ]),
  ).filter(Boolean);

  const orConditions: string[] = [];
  if (teamIds.length > 0) {
    orConditions.push(`team1_id.in.(${teamIds.join(",")})`);
    orConditions.push(`team2_id.in.(${teamIds.join(",")})`);
  }
  if (perfMatchIds.length > 0) {
    orConditions.push(`id.in.(${perfMatchIds.join(",")})`);
  }

  let matchesList: PlayerMatchItem[] = [];
  if (orConditions.length > 0) {
    const { data: matchesData } = await supabase
      .from("matches")
      .select(
        `
        id, title, match_format, overs_per_innings, status, venue, scheduled_at,
        result_type, win_margin, win_margin_type, result_description, winning_team_id,
        tournament_id,
        tournament:tournaments(id, name),
        team1:teams!matches_team1_id_fkey(id, name, short_name, logo_url),
        team2:teams!matches_team2_id_fkey(id, name, short_name, logo_url),
        innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
      `,
      )
      .or(orConditions.join(","))
      .order("scheduled_at", { ascending: false });

    if (matchesData) {
      matchesList = matchesData.map((m) => {
        const playerBat = batting.find((b) => b.match_id === m.id);
        const playerBowl = bowling.find((b) => b.match_id === m.id);
        return {
          ...m,
          playerBatting: playerBat
            ? {
                runs_scored: playerBat.runs_scored,
                balls_faced: playerBat.balls_faced,
                is_out: playerBat.is_out,
              }
            : null,
          playerBowling: playerBowl
            ? {
                wickets_taken: playerBowl.wickets_taken,
                runs_conceded: playerBowl.runs_conceded,
                overs_bowled: playerBowl.overs_bowled,
              }
            : null,
        } as unknown as PlayerMatchItem;
      });
    }
  }

  // Summary figures for stats fallback if career aggregate row is absent
  const totalRuns =
    stats?.total_runs ?? batting.reduce((acc, b) => acc + b.runs_scored, 0);
  const totalWickets =
    stats?.total_wickets ??
    bowling.reduce((acc, b) => acc + b.wickets_taken, 0);
  const totalMatches =
    stats?.total_matches ??
    Math.max(matchesList.length, batting.length, bowling.length);

  return (
    <div className="container mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-8">
      {/* Contextual Breadcrumbs and Back Navigation */}
      <div className="mb-6 flex flex-col gap-2.5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {tournamentInfo && teamInfo ? (
            <>
              <Link
                href="/tournaments"
                className="transition-colors hover:text-foreground"
              >
                Tournaments
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link
                href={`/tournaments/${tournamentInfo.id}`}
                className="max-w-[140px] truncate transition-colors hover:text-foreground"
              >
                {tournamentInfo.name}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link
                href={`/teams/${teamInfo.id}?tournamentId=${tournamentInfo.id}`}
                className="max-w-[140px] truncate transition-colors hover:text-foreground"
              >
                {teamInfo.name}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[160px] truncate font-medium text-foreground">
                {user.full_name}
              </span>
            </>
          ) : teamInfo ? (
            <>
              <Link
                href="/teams"
                className="transition-colors hover:text-foreground"
              >
                Teams
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link
                href={`/teams/${teamInfo.id}`}
                className="max-w-[160px] truncate transition-colors hover:text-foreground"
              >
                {teamInfo.name}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[160px] truncate font-medium text-foreground">
                {user.full_name}
              </span>
            </>
          ) : tournamentInfo ? (
            <>
              <Link
                href="/tournaments"
                className="transition-colors hover:text-foreground"
              >
                Tournaments
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link
                href={`/tournaments/${tournamentInfo.id}`}
                className="max-w-[160px] truncate transition-colors hover:text-foreground"
              >
                {tournamentInfo.name}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[160px] truncate font-medium text-foreground">
                {user.full_name}
              </span>
            </>
          ) : (
            <>
              <Link
                href="/players"
                className="transition-colors hover:text-foreground"
              >
                Players
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[200px] truncate font-medium text-foreground">
                {user.full_name}
              </span>
            </>
          )}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="interactive-button min-h-[36px] w-fit pl-0"
        >
          <Link href={backHref}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        </Button>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary sm:h-16 sm:w-16 sm:text-2xl">
            {user.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {user.full_name}
            </h1>
            {isSelf && user.email && (
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {user.email}
              </p>
            )}

            {/* Quick Affiliations / Teams */}
            {teams.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                {teams.map((tm) => (
                  <Link
                    key={tm.id}
                    href={`/teams/${tm.team.id}${tournamentId ? `?tournamentId=${encodeURIComponent(tournamentId)}` : ""}`}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-muted"
                  >
                    <TeamLogo
                      name={tm.team.name}
                      shortName={tm.team.short_name}
                      logoUrl={tm.team.logo_url}
                      className="h-4 w-4 text-[9px]"
                    />
                    <span>{tm.team.name}</span>
                    {tm.jersey_number !== undefined &&
                      tm.jersey_number !== null && (
                        <span className="font-mono text-muted-foreground">
                          #{tm.jersey_number}
                        </span>
                      )}
                    {tm.role_in_team && (
                      <span className="font-semibold text-primary">
                        ({formatPlayerRole(tm.role_in_team)})
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Highlights Pill */}
        <div className="flex items-center justify-around gap-4 border-t pt-4 sm:justify-start sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums">{totalMatches}</div>
            <div className="text-xs font-medium text-muted-foreground">
              Matches
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {totalRuns}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Runs
            </div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {totalWickets}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Wickets
            </div>
          </div>
        </div>
      </div>

      {/* Career Overview Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Batting Career
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label="Matches" value={totalMatches} />
            <Stat label="Runs" value={totalRuns} />
            <Stat label="Avg" value={stats?.batting_average ?? "—"} />
            <Stat label="SR" value={stats?.strike_rate ?? "—"} />
            <Stat label="50s" value={stats?.half_centuries ?? 0} />
            <Stat label="100s" value={stats?.centuries ?? 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Bowling Career
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label="Wkts" value={totalWickets} />
            <Stat label="Avg" value={stats?.bowling_average ?? "—"} />
            <Stat label="Econ" value={stats?.economy_rate ?? "—"} />
            <Stat label="5w" value={stats?.five_wicket_hauls ?? 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Fielding Career
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <Stat label="Catches" value={stats?.total_catches ?? 0} />
            <Stat label="Stumpings" value={stats?.total_stumpings ?? 0} />
            <Stat label="Run outs" value={stats?.total_run_outs ?? 0} />
          </CardContent>
        </Card>
      </div>

      {/* Main Activity Area: Batting, Bowling, Matches, Teams */}
      <div className="mt-8">
        <PlayerActivityTabs
          userId={id}
          teams={teams}
          batting={batting}
          bowling={bowling}
          matches={matchesList}
          tournamentId={tournamentId}
          teamId={teamId}
          initialTab={tab}
        />
      </div>
    </div>
  );
}
