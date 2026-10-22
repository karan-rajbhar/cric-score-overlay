import Link from "next/link";
import { notFound } from "next/navigation";
import type { Doc } from "~/lib/firebase/datasource";
import { playerDirectory } from "~/lib/firebase/directory";
import { sortRows } from "~/lib/firebase/filters";
import {
  battingRowsOfPlayerMatch,
  bowlingRowsOfPlayerMatch,
} from "~/lib/firebase/scorecard";
import { cache } from "react";
import type { Metadata } from "next";
import { createServerClient } from "~/lib/firebase/server";
import type { PlayerMatchesRow } from "~/lib/firebase/types";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlayerHeader } from "~/components/ds/player-header";
import {
  CareerCards,
  ProfileHighlights,
  ProfileTeams,
} from "~/components/players/player-profile";
import {
  PlayerActivityTabs,
  type PlayerTeamMembership,
  type PlayerBattingPerformance,
  type PlayerBowlingPerformance,
  type PlayerMatchItem,
} from "~/components/players/player-activity-tabs";
import { EditUsernameDialog } from "~/components/players/edit-username-dialog";
import { InviteDialog } from "~/components/invite-dialog";
import { ContentSheet, ScreenBar } from "~/components/ds/screen";
import { PageContainer } from "~/components/layout/page";
import { LivePerformanceCard } from "~/components/players/live-performance-card";
import { liveScorecardInnings } from "~/lib/firebase/live-innings";
import { livePerformanceOf } from "~/lib/firebase/live-player";
import type { LiveScorecardDoc } from "~/lib/firebase/live-scorecard";

export const dynamic = "force-dynamic";

/** Live matches checked for in-progress figures (1 read each). */
const MAX_LIVE_MATCHES = 3;

/** The player id or @handle in the URL, normalised; null when invalid. */
function playerParam(rawId: string): { value: string; isUuid: boolean } | null {
  const value = decodeURIComponent(rawId).replace(/^@/, "").trim().toLowerCase();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  const isValidHandle = /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/.test(value);
  return isUuid || isValidHandle ? { value, isUuid } : null;
}

/**
 * The player, by UUID or by @username handle (usernames are stored lower
 * case, so the handle is one equality lookup). Read once per request, by
 * the page and its title.
 */
const loadPlayer = cache(async (value: string, isUuid: boolean) => {
  const db = await createServerClient();
  return db
    .from("users")
    .select("id, full_name, avatar_url, username")
    .eq(isUuid ? "id" : "username", value)
    .maybeSingle();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const param = playerParam((await params).id);
  if (!param) return { title: "Player" };
  const { data: player } = await loadPlayer(param.value, param.isUuid);
  return { title: player?.full_name ?? "Player" };
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
  const param = playerParam((await params).id);
  if (!param) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const { teamId, tournamentId, matchId, clubId, tab } =
    resolvedSearchParams ?? {};

  const db = await createServerClient();

  const { data: user } = await loadPlayer(param.value, param.isUuid);
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
        id, title, match_format, overs_per_innings, balls_per_over, status, venue, scheduled_at,
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
  // Only the rosters of the matches with a bowler or fielder to name, not
  // of every fixture listed.
  const dismissalMatchIds = new Set(
    battingRows
      .filter((b) => b.bowler_id || b.fielder_id)
      .map((b) => b.match_id),
  );
  const names = await playerDirectory(
    db,
    matchesData
      .filter((m) => dismissalMatchIds.has(String(m.id)))
      .flatMap((m) => [m.team1_id as string, m.team2_id as string]),
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
  // Innings in progress are not in player_matches yet: for the player's
  // live matches (already loaded above) read each one's live_scorecard
  // doc, 1 read per live match (capped). It also carries the score of the
  // innings in progress, which the match summary does not follow per ball.
  const livePerformances = (
    await Promise.all(
      matchesData
        .filter((m) => m.status === "live")
        .slice(0, MAX_LIVE_MATCHES)
        .map(async (m) => {
          const { data } = await db.rpc<LiveScorecardDoc | null>(
            "ensure_live_scorecard",
            { p_match_id: m.id },
          );
          if (data) {
            m.innings = liveScorecardInnings(
              m as { status?: unknown; innings?: Record<string, unknown>[] },
              data,
            ).innings;
          }
          const perf = data
            ? livePerformanceOf(data, id, Number(m.balls_per_over) || 6)
            : null;
          const match = matchOf(String(m.id));
          return perf && match ? { ...perf, match } : null;
        }),
    )
  ).filter((p) => p !== null);

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
  let backLabel = "Back to players";
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
    backLabel = "Back to match";
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
      {/* Phones: the screen's own bar instead of the header. */}
      <ScreenBar
        className="mb-5 md:hidden"
        title="Player"
        backHref={backHref}
        backLabel={backLabel}
      />
      {/* Contextual Breadcrumbs and Back Navigation */}
      <div className="mb-6 flex flex-col gap-2.5 max-md:hidden">
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

      <div className="space-y-4">
        <PlayerHeader
          name={user.full_name}
          detail={[user.username ? `@${user.username}` : null, ownEmail]
            .filter(Boolean)
            .join(" · ")}
          photoUrl={user.avatar_url}
          actions={
            isSelf ? (
              <>
                <EditUsernameDialog currentUsername={user.username ?? ""} />
                <InviteDialog />
              </>
            ) : undefined
          }
        />
        <ProfileTeams teams={teams} tournamentId={tournamentId} />
      </div>

      {/* Career figures first, then the innings, matches and teams. */}
      <ContentSheet className="mt-8">
        <PlayerActivityTabs
          userId={id}
          teams={teams}
          batting={batting}
          bowling={bowling}
          matches={matchesList}
          tournamentId={tournamentId}
          teamId={teamId}
          initialTab={tab}
          statistics={
            <>
              <ProfileHighlights
                matches={totalMatches}
                runs={totalRuns}
                wickets={totalWickets}
                catches={stats?.total_catches ?? 0}
              />
              {livePerformances.length > 0 && (
                <LivePerformanceCard performances={livePerformances} />
              )}
              <CareerCards
                batting={[
                  ["Matches", totalMatches],
                  ["Runs", totalRuns],
                  ["Average", stats?.batting_average ?? "–"],
                  ["Strike rate", stats?.strike_rate ?? "–"],
                  ["50s", stats?.half_centuries ?? 0],
                  ["100s", stats?.centuries ?? 0],
                ]}
                bowling={[
                  ["Wickets", totalWickets],
                  ["Average", stats?.bowling_average ?? "–"],
                  ["Economy", stats?.economy_rate ?? "–"],
                  ["5 wickets", stats?.five_wicket_hauls ?? 0],
                ]}
                fielding={[
                  ["Catches", stats?.total_catches ?? 0],
                  ["Stumpings", stats?.total_stumpings ?? 0],
                  ["Run outs", stats?.total_run_outs ?? 0],
                ]}
              />
            </>
          }
        />
      </ContentSheet>
    </PageContainer>
  );
}
