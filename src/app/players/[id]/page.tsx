import { PageTrail } from "~/components/ds/page-trail";
import { backLabelOf, parentOf, playerTrail } from "~/lib/navigation";
import { notFound, redirect } from "next/navigation";
import {
  legacyHandleOf,
  parsePlayerRef,
  playerLookup,
  playerPath,
} from "~/lib/player-ref";
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
import { PlayerHeader } from "~/components/ds/player-header";
import { ProfileTeams } from "~/components/players/player-profile";
import {
  PlayerActivityTabs,
  type PlayerTeamMembership,
  type PlayerBattingPerformance,
  type PlayerBowlingPerformance,
  type PlayerMatchItem,
} from "~/components/players/player-activity-tabs";
import { EditProfileDialog } from "~/components/players/edit-profile-dialog";
import { SeasonStatistics } from "~/components/players/season-statistics";
import { RecentForm } from "~/components/players/recent-form";
import { ShareProfileButton } from "~/components/players/share-profile-button";
import { playerDetailLine, playingRoleLabel } from "~/lib/player-profile";
import { EditUsernameDialog } from "~/components/players/edit-username-dialog";
import { InviteDialog } from "~/components/invite-dialog";
import { ActionsSheet } from "~/components/ds/actions-sheet";
import { PinnedTitle } from "~/components/ds/pinned-title";
import { ContentSheet, pinnedPage, ScreenBar } from "~/components/ds/screen";
import { PageContainer } from "~/components/layout/page";
import { LivePerformanceCard } from "~/components/players/live-performance-card";
import { EntityActions } from "~/components/follow/entity-actions";
import { liveScorecardInnings } from "~/lib/firebase/live-innings";
import { livePerformanceOf } from "~/lib/firebase/live-player";
import type { LiveScorecardDoc } from "~/lib/firebase/live-scorecard";

export const dynamic = "force-dynamic";

/** Upcoming fixtures of the player's teams listed (per side). */
const UPCOMING_FIXTURES = 20;
/** Teams of the player whose fixtures are listed (one `in` query). */
const IN_LIMIT = 30;

/** Live matches checked for in-progress figures (1 read each). */
const MAX_LIVE_MATCHES = 3;

/**
 * The player named by the URL (`@handle` or id, see `~/lib/player-ref`).
 * Read once per request, by the page and its title. A bare old-style handle
 * (`/players/karan`) that matches no id is looked up as a handle, and the
 * page redirects to its canonical address.
 */
const loadPlayer = cache(async (rawId: string) => {
  const ref = parsePlayerRef(rawId);
  if (!ref) return null;
  const db = await createServerClient();
  const select =
    "id, full_name, avatar_url, username, location, playing_role, batting_hand, bowling_style";
  const { column, value } = playerLookup(ref);
  const { data } = await db
    .from("users")
    .select(select)
    .eq(column, value)
    .maybeSingle();
  if (data) return { user: data, redirectTo: null };
  const legacy = legacyHandleOf(ref);
  if (!legacy) return null;
  const { data: byHandle } = await db
    .from("users")
    .select(select)
    .eq("username", legacy)
    .maybeSingle();
  return byHandle ? { user: byHandle, redirectTo: playerPath(byHandle) } : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const player = (await loadPlayer((await params).id))?.user;
  return { title: player?.full_name ?? "Player" };
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { tab } = resolvedSearchParams ?? {};

  const db = await createServerClient();

  const loaded = await loadPlayer((await params).id);
  if (!loaded) {
    notFound();
  }
  if (loaded.redirectTo) {
    const query = new URLSearchParams(
      Object.entries(resolvedSearchParams ?? {}).filter(
        (e): e is [string, string] => typeof e[1] === "string",
      ),
    ).toString();
    redirect(query ? `${loaded.redirectTo}?${query}` : loaded.redirectTo);
  }
  const user = loaded.user;

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

  // Matches: every match the player has a record in, plus their teams'
  // live and next fixtures (indexed, bounded queries: not every fixture
  // their teams ever played).
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
  const fixtureTeams = teamIds.slice(0, IN_LIMIT);
  const recordMatchIds = Array.from(new Set(records.map((r) => r.match_id)));
  const results = await Promise.all([
    recordMatchIds.length
      ? db.from("matches").select(matchColumns).in("id", recordMatchIds)
      : Promise.resolve({ data: [] }),
    ...(fixtureTeams.length
      ? (["team1_id", "team2_id"] as const).flatMap((field) => [
          db
            .from("matches")
            .select(matchColumns)
            .in(field, fixtureTeams)
            .eq("status", "live"),
          db
            .from("matches")
            .select(matchColumns)
            .in(field, fixtureTeams)
            .eq("status", "scheduled")
            .order("scheduled_at", { ascending: true })
            .limit(UPCOMING_FIXTURES),
        ])
      : []),
  ]);
  for (const { data } of results) {
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
      [...rows].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      ) as unknown as Doc[],
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
  const trail = playerTrail();

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

  const ownTools = isSelf && (
    <>
      <EditProfileDialog currentName={user.full_name ?? ""} current={user} />
      <EditUsernameDialog currentUsername={user.username ?? ""} />
      <InviteDialog />
    </>
  );

  return (
    <PageContainer stack={false} className={pinnedPage}>
      {/* Phones: the screen's own bar instead of the header. */}
      <ScreenBar
        className="mb-4 md:hidden"
        backHref={parentOf(trail)}
        backLabel={backLabelOf(trail)}
        action={
          <>
            {!isSelf && (
              <EntityActions
                kind="player"
                id={user.id}
                name={user.full_name}
              />
            )}
            <ShareProfileButton name={user.full_name} iconOnly />
            {isSelf && (
              <ActionsSheet title={user.full_name} label="Profile actions">
                {ownTools}
              </ActionsSheet>
            )}
          </>
        }
      />
      <PageTrail crumbs={trail} current={user.full_name} className="mb-6" />

      <div className="space-y-4">
        <PlayerHeader
          name={user.full_name}
          role={playingRoleLabel(user.playing_role) ?? undefined}
          detail={playerDetailLine(user, [
            user.username ? `@${user.username}` : null,
            ownEmail,
          ])}
          photoUrl={user.avatar_url}
          actions={
            <>
              <ShareProfileButton name={user.full_name} />
              {ownTools}
            </>
          }
        />
        <ProfileTeams teams={teams} />
        {!isSelf && (
          <EntityActions
            kind="player"
            id={user.id}
            name={user.full_name}
            className="max-md:hidden"
          />
        )}
      </div>
      <PinnedTitle>{user.full_name}</PinnedTitle>

      {/* Career figures first, then the innings, matches and teams. */}
      <ContentSheet className="mt-4 sm:mt-8">
        <PlayerActivityTabs
          teams={teams}
          batting={batting}
          bowling={bowling}
          matches={matchesList}
          initialTab={tab}
          statistics={
            <SeasonStatistics
              batting={batting}
              bowling={bowling}
              allTime={{
                matches: totalMatches,
                runs: totalRuns,
                wickets: totalWickets,
                catches: stats?.total_catches ?? 0,
                batting: [
                  ["Matches", totalMatches],
                  ["Runs", totalRuns],
                  ["Average", stats?.batting_average ?? "–"],
                  ["Strike rate", stats?.strike_rate ?? "–"],
                  ["50s", stats?.half_centuries ?? 0],
                  ["100s", stats?.centuries ?? 0],
                ],
                bowling: [
                  ["Wickets", totalWickets],
                  ["Average", stats?.bowling_average ?? "–"],
                  ["Economy", stats?.economy_rate ?? "–"],
                  ["5 wickets", stats?.five_wicket_hauls ?? 0],
                ],
                fielding: [
                  ["Catches", stats?.total_catches ?? 0],
                  ["Stumpings", stats?.total_stumpings ?? 0],
                  ["Run outs", stats?.total_run_outs ?? 0],
                ],
              }}
              between={
                <>
                  {livePerformances.length > 0 && (
                    <LivePerformanceCard performances={livePerformances} />
                  )}
                  <RecentForm batting={batting} bowling={bowling} />
                </>
              }
            />
          }
        />
      </ContentSheet>
    </PageContainer>
  );
}
