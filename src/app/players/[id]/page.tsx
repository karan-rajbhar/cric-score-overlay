import Link from "next/link";
import { notFound } from "next/navigation";
import type { Doc } from "~/lib/firebase/datasource";
import { playerDirectory } from "~/lib/firebase/directory";
import { sortRows } from "~/lib/firebase/filters";
import {
  battingRowsOfPlayerMatch,
  bowlingRowsOfPlayerMatch,
} from "~/lib/firebase/scorecard";
import { createServerClient } from "~/lib/firebase/server";
import type { PlayerMatchesRow } from "~/lib/firebase/types";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { StatTile } from "~/components/ui/stat-tile";
import { Initials } from "~/components/ui/initials";
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
import { EditUsernameDialog } from "~/components/players/edit-username-dialog";
import { InviteDialog } from "~/components/invite-dialog";
import { PageContainer } from "~/components/layout/page";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return <StatTile label={label} value={value} className="bg-muted/30" />;
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
  const { id: rawId } = await params;
  const cleanParam = decodeURIComponent(rawId).replace(/^@/, "").trim().toLowerCase();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cleanParam,
    );
  const isValidHandle = /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/.test(cleanParam);

  if (!isUuid && !isValidHandle) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const { teamId, tournamentId, matchId, clubId, tab } =
    resolvedSearchParams ?? {};

  const db = await createServerClient();

  // Find user by UUID or by @username handle (usernames are stored lower
  // case, so the handle is one equality lookup).
  const userQuery = isUuid
    ? db
        .from("users")
        .select("id, full_name, avatar_url, username")
        .eq("id", cleanParam)
        .maybeSingle()
    : db
        .from("users")
        .select("id, full_name, avatar_url, username")
        .eq("username", cleanParam)
        .maybeSingle();

  const { data: user } = await userQuery;
  if (!user) {
    notFound();
  }

  const id = user.id;

  // Career figures are one document (player_career_stats/{userId}); the
  // per-match history is the player's player_matches records, read once
  // for both the batting and the bowling list.
  const [
    { data: currentUserData },
    { data: stats },
    { data: teamPlayersData },
    { data: recordsData },
  ] = await Promise.all([
    db.auth.getUser(),
    db.from("player_career_stats").select("*").eq("id", id).maybeSingle(),
    db
      .from("team_players")
      .select(
        `
        id, role_in_team, jersey_number, batting_order, created_at,
        team:teams(id, name, short_name, logo_url, team_type, description, club:clubs(id, name))
      `,
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    db.from("player_matches").select("*").eq("user_id", id),
  ]);

  const records = (recordsData ?? []) as unknown as PlayerMatchesRow[];
  const teams = (teamPlayersData ?? []) as unknown as PlayerTeamMembership[];

  // Matches: the player's teams' fixtures plus any other match they have a
  // record in (indexed queries, each match read once).
  const teamIds = Array.from(
    new Set(teams.map((tp) => tp.team?.id).filter(Boolean)),
  ) as string[];
  const matchColumns = `
        id, title, match_format, overs_per_innings, status, venue, scheduled_at,
        result_type, win_margin, win_margin_type, result_description, winning_team_id,
        tournament_id,
        tournament:tournaments(id, name),
        ${MATCH_TEAM_COLUMNS},
        innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
      `;
  const byMatchId = new Map<string, Record<string, unknown>>();
  if (teamIds.length > 0) {
    const sides = await Promise.all(
      (["team1_id", "team2_id"] as const).map((field) =>
        db.from("matches").select(matchColumns).in(field, teamIds),
      ),
    );
    for (const { data } of sides) {
      for (const m of (data ?? []) as Record<string, unknown>[]) {
        byMatchId.set(String(m.id), m);
      }
    }
  }
  const recordMatchIds = Array.from(new Set(records.map((r) => r.match_id)));
  const otherIds = recordMatchIds.filter((mid) => !byMatchId.has(mid));
  if (otherIds.length > 0) {
    const { data } = await db
      .from("matches")
      .select(matchColumns)
      .in("id", otherIds);
    for (const m of (data ?? []) as Record<string, unknown>[]) {
      byMatchId.set(String(m.id), m);
    }
  }
  const matchesData = sortRows(
    [...byMatchId.values()].sort((a, b) =>
      String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0,
    ) as Doc[],
    [{ field: "scheduled_at", ascending: false, nullsFirst: true }],
  );
  // Team and tournament names come from the matches' snapshots.
  await attachMatchTeams(db, matchesData);

  // Batting / bowling history from the records, newest first; dismissal
  // names come from the rosters of the teams involved.
  const byNewest = <T extends { id: string; created_at: string | null }>(
    rows: T[],
  ) =>
    sortRows(
      [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) as
        unknown as Doc[],
      [{ field: "created_at", ascending: false, nullsFirst: true }],
    ) as unknown as T[];
  const battingRows = byNewest(records.flatMap(battingRowsOfPlayerMatch));
  const bowlingRows = byNewest(records.flatMap(bowlingRowsOfPlayerMatch));
  const names = await playerDirectory(
    db,
    matchesData.flatMap((m) => [m.team1_id as string, m.team2_id as string]),
    battingRows.flatMap((b) => [b.bowler_id, b.fielder_id]),
  );
  const nameOf = (uid: string | null) => {
    const u = uid ? names.get(uid) : undefined;
    return u ? { id: u.id, full_name: u.full_name } : null;
  };
  const matchOf = (mid: string | null) => {
    const m = mid ? byMatchId.get(mid) : undefined;
    if (!m) return null;
    return {
      id: m.id,
      title: m.title,
      match_format: m.match_format,
      scheduled_at: m.scheduled_at,
      status: m.status,
      venue: m.venue,
      result_description: m.result_description,
      winning_team_id: m.winning_team_id,
      team1: m.team1,
      team2: m.team2,
    };
  };
  const batting = battingRows.map((b) => ({
    id: b.id,
    match_id: b.match_id,
    innings_id: b.innings_id,
    batting_position: b.batting_position,
    runs_scored: b.runs_scored,
    balls_faced: b.balls_faced,
    fours: b.fours,
    sixes: b.sixes,
    is_out: b.is_out,
    dismissal_type: b.dismissal_type,
    bowler_id: b.bowler_id,
    fielder_id: b.fielder_id,
    created_at: b.created_at,
    bowler: nameOf(b.bowler_id),
    fielder: nameOf(b.fielder_id),
    match: matchOf(b.match_id),
  })) as unknown as PlayerBattingPerformance[];
  const bowling = bowlingRows.map((b) => ({
    id: b.id,
    match_id: b.match_id,
    innings_id: b.innings_id,
    overs_bowled: b.overs_bowled,
    balls_bowled: b.balls_bowled,
    runs_conceded: b.runs_conceded,
    wickets_taken: b.wickets_taken,
    maidens: b.maidens,
    wides: b.wides,
    no_balls: b.no_balls,
    created_at: b.created_at,
    match: matchOf(b.match_id),
  })) as unknown as PlayerBowlingPerformance[];

  const isSelf = currentUserData?.user?.id === user.id;
  // Contact details are not on the public profile; the signed-in user sees
  // their own email from the session (no read).
  const ownEmail = isSelf ? (currentUserData?.user?.email ?? null) : null;

  // Contextual navigation resolution
  let teamInfo: { id: string; name: string } | null = null;
  if (
    teamId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      teamId,
    )
  ) {
    const { data: t } = await db
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
    const { data: tr } = await db
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

  const matchesList: PlayerMatchItem[] = matchesData.map((m) => {
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
    <PageContainer stack={false}>
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
          className="min-h-[36px] w-fit pl-0"
        >
          <Link href={backHref}>
            <ChevronLeft className="mr-1.5 h-4 w-4 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        </Button>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Initials
            name={user.full_name}
            letters={2}
            className="h-12 w-12 text-lg sm:h-16 sm:w-16 sm:text-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {user.full_name}
              </h1>
              {user.username && (
                <span className="font-mono text-sm text-muted-foreground">
                  @{user.username}
                </span>
              )}
              {isSelf && (
                <EditUsernameDialog currentUsername={user.username ?? ""} />
              )}
            </div>
            {ownEmail && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                {ownEmail}
              </p>
            )}
            {isSelf && (
              <div className="mt-2.5">
                <InviteDialog />
              </div>
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
                      className="h-4 w-4 shrink-0 text-2xs"
                    />
                    <span>{tm.team.name}</span>
                    {tm.jersey_number !== undefined &&
                      tm.jersey_number !== null && (
                        <span className="font-mono text-muted-foreground">
                          #{tm.jersey_number}
                        </span>
                      )}
                    {tm.role_in_team && (
                      <span className="text-muted-foreground">
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
        <div className="grid grid-cols-3 gap-6 border-t pt-4 sm:flex sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <StatTile bordered={false} label="Matches" value={totalMatches} />
          <StatTile bordered={false} label="Runs" value={totalRuns} />
          <StatTile bordered={false} label="Wickets" value={totalWickets} />
        </div>
      </div>

      {/* Career Overview Stats Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Batting
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
            <CardTitle className="text-base">
              Bowling
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
            <CardTitle className="text-base">
              Fielding
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
    </PageContainer>
  );
}
