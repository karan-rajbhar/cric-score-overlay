import { notFound } from "next/navigation";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { Chip } from "~/components/ds/chip";
import { TeamCrest } from "~/components/ds/avatar";
import { MetaItem } from "~/components/ds/list";
import { ProfileHeader } from "~/components/ds/player-header";
import {
  ChevronLeft,
  Users,
  Trophy,
  Calendar,
  AlertCircle,
  Swords,
  Percent,
  UserRound,
  X,
} from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { cache } from "react";
import type { Metadata } from "next";
import { getTeam } from "../actions";
import type { Doc } from "~/lib/firebase/datasource";
import { sortRows } from "~/lib/firebase/filters";
import { withLiveInnings } from "~/lib/firebase/live-innings";
import { createServerClient } from "~/lib/firebase/server";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
import { PlayerList } from "~/components/teams/player-list";
import { AddPlayerDialog } from "~/components/teams/add-player-dialog";
import { formatTeamType } from "~/lib/cricket";
import { EditTeamDialog } from "~/components/teams/edit-team-dialog";
import { squadClaims, type PlayerClaim } from "~/lib/squad-claims";
import { TeamSquadShare } from "~/components/teams/team-squad-share";
import { PageTrail } from "~/components/ds/page-trail";
import { backLabelOf, parentOf, teamTrail } from "~/lib/navigation";
import { ActionsSheet } from "~/components/ds/actions-sheet";
import { PinnedTitle } from "~/components/ds/pinned-title";
import { PinnedTabs } from "~/components/ds/tabs";
import { TabsContent, UrlTabs } from "~/components/ui/tabs";
import {
  TeamMatchesView,
  type TeamMatchItem,
} from "~/components/teams/team-matches-view";
import { ContentSheet, pinnedPage, ScreenBar } from "~/components/ds/screen";
import { PageContainer } from "~/components/layout/page";
import {
  FINISHED_STATUSES,
  teamRecordFromCounts,
  teamRecordOf,
} from "~/lib/team-record";
import { ShowMoreLink } from "~/components/layout/pager";

/** Matches listed at first; "Show older matches" adds as many again. */
const MATCH_PAGE = 50;

function latestCount(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > MATCH_PAGE ? Math.min(n, 1000) : MATCH_PAGE;
}
import { EntityActions } from "~/components/follow/entity-actions";

/** The team: read once per request, by the page and its title. */
const loadTeam = cache(getTeam);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data: team } = await loadTeam(id);
  return { title: team?.name ?? "Team" };
}

export default async function TeamDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    /** How many of the latest matches to list ("Show older matches"). */
    matches?: string;
    /** Only this tournament's matches (a filter). */
    tournamentId?: string;
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
  const { tournamentId, tab } = resolvedSearchParams ?? {};

  const { data: team, error } = await loadTeam(id);

  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  let tournamentInfo: { id: string; name: string } | null = null;
  if (
    tournamentId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tournamentId,
    )
  ) {
    const { data: t } = await db
      .from("tournaments")
      .select("id, name")
      .eq("id", tournamentId)
      .single();
    if (t) tournamentInfo = t;
  }

  const targetClubId = team?.club_id;
  let clubInfo: { id: string; name: string; owner_id?: string | null } | null =
    null;
  if (
    targetClubId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      targetClubId,
    )
  ) {
    const { data: c } = await db
      .from("clubs")
      .select("id, name, owner_id")
      .eq("id", targetClubId)
      .single();
    if (c) clubInfo = c;
  }

  let isClubAdmin = false;
  if (user && targetClubId) {
    if (clubInfo?.owner_id === user.id) {
      isClubAdmin = true;
    } else {
      const { data: mem } = await db
        .from("club_memberships")
        .select("id")
        .eq("club_id", targetClubId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();
      if (mem) isClubAdmin = true;
    }
  }

  const canManageTeam =
    !!user &&
    (team?.captain_id === user.id ||
      team?.vice_captain_id === user.id ||
      team?.created_by === user.id ||
      isClubAdmin);

  const trail = teamTrail({ club: clubInfo, tournament: tournamentInfo });
  const backHref = parentOf(trail);
  const backLabel = backLabelOf(trail);

  if (error || !team) {
    if (!team) notFound();
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={AlertCircle}
          title="Could not load the team"
          description={error || "Failed to retrieve team details."}
          primaryAction={{
            label: backLabel,
            href: backHref,
            icon: ChevronLeft,
          }}
        />
      </div>
    );
  }

  // Flatten the player structure for the PlayerList component
  const players =
    (team.team_players as Array<{
      id: string;
      user_id: string;
      role_in_team?: string;
      jersey_number?: number;
      user?: {
        id: string;
        full_name: string;
        avatar_url?: string;
      };
    }> | null) || [];

  // Team admins see who in the squad has no account yet ("Not on
  // CricScore") or was invited to claim their profile (masked email; the
  // address itself stays on the server). Viewers pay no extra reads.
  let claims: Record<string, PlayerClaim> = {};
  const squadIds = [...new Set(players.map((p) => p.user_id).filter(Boolean))];
  if (canManageTeam && squadIds.length > 0) {
    const [{ data: profiles }, { data: privates }] = await Promise.all([
      db.from("users").select("id, is_placeholder").in("id", squadIds),
      db.from("users_private").select("id, email").in("id", squadIds),
    ]);
    claims = squadClaims(
      (profiles ?? []) as { id: string; is_placeholder?: boolean | null }[],
      (privates ?? []) as { id: string; email?: string | null }[],
    );
  }

  // The latest matches, one indexed query per side (an `or` would read
  // every match), merged in the order the `or` query returned, plus any
  // live ones; the totals and the record are count()s, so a team with
  // hundreds of matches costs a few dozen reads.
  const matchLimit = latestCount(resolvedSearchParams?.matches);
  const columns = `
      id, title, match_format, overs_per_innings, status, venue, scheduled_at,
      result_type, win_margin, win_margin_type, result_description, winning_team_id,
      tournament_id,
      tournament:tournaments(id, name),
      ${MATCH_TEAM_COLUMNS},
      innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
    `;
  const SIDES = ["team1_id", "team2_id"] as const;
  const countQuery = (side: (typeof SIDES)[number]) =>
    db
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq(side, id);
  type CountQuery = ReturnType<typeof countQuery>;
  /** The team's matches on either side (a count() per side). */
  const both = async (
    narrow: (q: CountQuery) => CountQuery = (q) => q,
  ): Promise<number> => {
    const counts = await Promise.all(
      SIDES.map(async (side) => (await narrow(countQuery(side))).count ?? 0),
    );
    return counts[0]! + counts[1]!;
  };
  const sides = await Promise.all(
    SIDES.map((side) =>
      db
        .from("matches")
        .select(columns)
        .eq(side, id)
        .order("scheduled_at", { ascending: false })
        .limit(matchLimit + 1),
    ),
  );
  // Every match is at hand unless a side filled its page.
  const complete = sides.every(({ data }) => (data ?? []).length <= matchLimit);
  const byId = new Map<string, Doc>();
  for (const { data } of sides) {
    for (const m of (data ?? []) as Doc[]) byId.set(m.id, m);
  }
  const latest = sortRows(
    [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    [{ field: "scheduled_at", ascending: false, nullsFirst: true }],
  );
  const moreMatches = latest.length > matchLimit;
  const shown = new Map(latest.slice(0, matchLimit).map((m) => [m.id, m]));

  // Beyond the page: the live matches, the totals and the record as
  // count()s (a few reads however many matches there are).
  const [liveSides, counts] = complete
    ? [[], null]
    : await Promise.all([
        Promise.all(
          SIDES.map((side) =>
            db.from("matches").select(columns).eq(side, id).eq("status", "live"),
          ),
        ),
        Promise.all([
          both(),
          tournamentInfo
            ? both((q) => q.eq("tournament_id", tournamentInfo!.id))
            : Promise.resolve(undefined),
          both((q) => q.in("status", FINISHED_STATUSES)),
          both((q) =>
            q.in("status", FINISHED_STATUSES).eq("winning_team_id", id),
          ),
          both((q) =>
            q.in("status", FINISHED_STATUSES).gt("winning_team_id", ""),
          ),
        ]),
      ]);
  for (const { data } of liveSides) {
    for (const m of (data ?? []) as Doc[]) shown.set(m.id, m);
  }
  const matchesData = sortRows(
    [...shown.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    [{ field: "scheduled_at", ascending: false, nullsFirst: true }],
  );

  // Live matches: their innings in progress, which the match summaries do
  // not follow ball by ball (1 read per live match).
  const teamMatches = (await withLiveInnings(
    db,
    await attachMatchTeams(db, matchesData ?? []),
  )) as unknown as TeamMatchItem[];

  // The team's record: finished matches only (upcoming ones are not played).
  const record = counts
    ? teamRecordFromCounts({ played: counts[2], won: counts[3], decided: counts[4] })
    : teamRecordOf(latest as unknown as TeamMatchItem[], id);
  const totalCount = counts ? counts[0] : latest.length;
  const tournamentCount = counts
    ? counts[1]
    : tournamentInfo
      ? latest.filter((m) => m.tournament_id === tournamentInfo!.id).length
      : undefined;

  const editTeam = canManageTeam && (
    <EditTeamDialog
      team={{
        id: team.id,
        name: team.name,
        short_name: team.short_name,
        description: team.description,
        logo_url: team.logo_url,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
      }}
    />
  );

  return (
    <PageContainer stack={false} className={pinnedPage}>
      {/* Phones: the screen's own bar instead of the header. */}
      <ScreenBar
        className="mb-4 md:hidden"
        backHref={backHref}
        backLabel={backLabel}
        action={
          <>
            <EntityActions
              kind="team"
              id={team.id}
              name={team.name}
              only="follow"
            />
            <ActionsSheet title={team.name} label="Team actions">
              <EntityActions
                kind="team"
                id={team.id}
                name={team.name}
                only="calendar"
              />
              {editTeam}
            </ActionsSheet>
          </>
        }
      />
      <PageTrail crumbs={trail} current={team.name} className="mb-6" />

      <ProfileHeader
        name={team.name}
        crest={
          <TeamCrest
            name={team.name}
            shortName={team.short_name}
            logoUrl={team.logo_url}
            size="xl"
            className="shadow-soft ring-4 ring-card sm:h-24 sm:w-24 sm:text-2xl"
          />
        }
        actions={
          <>
            <EntityActions kind="team" id={team.id} name={team.name} />
            {editTeam}
          </>
        }
        labels={
          <>
            {team.short_name && <Chip tone="outline">{team.short_name}</Chip>}
            <Chip>{formatTeamType(team.team_type)}</Chip>
          </>
        }
        description={team.description}
        meta={
          <>
            <MetaItem icon={Users}>
              {players.length} {players.length === 1 ? "player" : "players"}
            </MetaItem>
            {team.captain && (
              <MetaItem icon={UserRound}>
                {team.captain.full_name} (c)
                {team.vice_captain && ` · ${team.vice_captain.full_name} (vc)`}
              </MetaItem>
            )}
            <MetaItem icon={Calendar}>
              Since {new Date(team.created_at).getFullYear()}
            </MetaItem>
          </>
        }
      />
      <PinnedTitle>{team.name}</PinnedTitle>

      <ContentSheet className="mt-4 sm:mt-8">
        <StatGrid compact>
          <StatTile compact
            icon={Swords}
            label="Played"
            value={record.played}
            hint={
              record.noWinner > 0
                ? `${record.noWinner} tied or no result`
                : undefined
            }
          />
          <StatTile compact icon={Trophy} label="Won" value={record.won} />
          <StatTile compact icon={X} label="Lost" value={record.lost} />
          <StatTile compact
            icon={Percent}
            label="Win rate"
            value={record.winRate !== null ? `${record.winRate}%` : "–"}
          />
        </StatGrid>

        <div className="mt-3 space-y-6 sm:mt-8">
          {/* Matches and squad */}
          <div>
            <UrlTabs
              defaultValue={tab === "squad" ? "squad" : "matches"}
              fallback="matches"
              className="w-full"
            >
              <PinnedTabs
                label="Team sections"
                tabs={[
                  { value: "matches", label: "Matches" },
                  { value: "squad", label: "Squad" },
                ]}
              />

              <TabsContent value="matches" className="mt-4">
                <TeamMatchesView
                  matches={teamMatches}
                  tournamentInfo={tournamentInfo}
                  totalCount={totalCount}
                  tournamentCount={tournamentCount}
                />
                {moreMatches && (
                  <ShowMoreLink
                    href={`/teams/${team.id}?${new URLSearchParams({
                      ...(tournamentId ? { tournamentId } : {}),
                      matches: String(matchLimit + MATCH_PAGE),
                    })}`}
                    label="Show older matches"
                  />
                )}
              </TabsContent>

              <TabsContent value="squad" className="mt-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                    Squad
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <TeamSquadShare
                      teamId={team.id}
                      teamName={team.name}
                      shortName={team.short_name}
                      players={players.map((p) => ({
                        full_name: p.user?.full_name ?? "Unknown",
                        role_in_team: p.role_in_team,
                        jersey_number: p.jersey_number,
                      }))}
                    />
                    {canManageTeam && <AddPlayerDialog teamId={team.id} clubId={team.club_id} />}
                  </div>
                </div>

                <PlayerList
                  teamId={team.id}
                  teamName={team.name}
                  players={players}
                  claims={claims}
                  allowEdit={canManageTeam}
                />
              </TabsContent>
            </UrlTabs>
          </div>
        </div>
      </ContentSheet>
    </PageContainer>
  );
}
