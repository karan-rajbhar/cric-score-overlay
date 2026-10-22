import Link from "next/link";
import { Initials } from "~/components/ui/initials";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { createServerClient } from "~/lib/firebase/server";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
import { Card, CardContent } from "~/components/ui/card";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { Chip } from "~/components/ds/chip";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { ListCard, ListRow } from "~/components/ds/list";
import { ProfileHeader } from "~/components/ds/player-header";
import { ClubContacts } from "~/components/clubs/club-contacts";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  ChevronLeft,
  Calendar,
  Users,
  Trophy,
  Shield,
  Plus,
  Award,
} from "lucide-react";
import { ClubMembershipButton } from "~/components/clubs/club-membership-button";
import {
  MemberRoleAction,
  RemoveMemberButton,
} from "~/components/clubs/member-role-action";
import {
  HallOfFameDialog,
  RemoveHallOfFameButton,
} from "~/components/clubs/hall-of-fame-dialog";
import {
  SeasonDialog,
  DeleteSeasonButton,
} from "~/components/clubs/season-dialog";
import { ClubSettingsDialog } from "~/components/clubs/club-settings-dialog";
import { InviteMemberDialog } from "~/components/clubs/invite-member-dialog";
import { ClubLogo } from "~/components/clubs/club-logo";
import { ClubMediaDialog } from "~/components/clubs/club-media-dialog";
import { ClubTournamentsTab } from "~/components/clubs/club-tournaments-tab";
import { ClubMatchesTab } from "~/components/clubs/club-matches-tab";
import {
  ClubStatsTab,
  ClubBatterLeader,
  ClubBowlerLeader,
  ClubMilestones,
} from "~/components/clubs/club-stats-tab";
import { EmptyState } from "~/components/ui/empty-state";
import {
  formatClubType,
  formatTeamType,
} from "~/lib/cricket";
import type { LeaderboardData } from "~/lib/leaderboard";
import {
  loadScopeLeaderboard,
  type ScopeMatch,
} from "~/lib/firebase/leaderboards";
import { ContentSheet, ScreenBar } from "~/components/ds/screen";
import { PageContainer } from "~/components/layout/page";

export const dynamic = "force-dynamic";

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
  logo_url?: string | null;
  team_type: string | null;
  captain?: { full_name: string } | null;
  team_players?: { count: number }[];
}

interface TournamentRow {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  tournament_format: string | null;
  match_format: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  season_id: string | null;
  overs_per_innings?: number | null;
}

interface MatchRow {
  id: string;
  title: string;
  match_format: string | null;
  overs_per_innings: number | null;
  status: string;
  venue: string | null;
  scheduled_at: string | null;
  result_type: string | null;
  win_margin: number | null;
  win_margin_type: string | null;
  result_description: string | null;
  season_id: string | null;
  team1: { id: string; name: string; short_name: string | null } | null;
  team2: { id: string; name: string; short_name: string | null } | null;
  innings?: Array<{
    id: string;
    team_id: string;
    innings_number: number;
    total_runs: number | null;
    total_wickets: number | null;
    total_balls: number | null;
    total_overs: number | null;
  }>;
}

interface MemberRow {
  id: string;
  role: string;
  status: string;
  joined_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface SeasonRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
}

interface HallOfFameRow {
  id: string;
  category: string;
  title: string;
  description: string | null;
  season_or_year: string | null;
  record_metric: string | null;
  inducted_at: string | null;
  player: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

/** The club document: read once per request, by the page and its title. */
const loadClub = cache(async (id: string) => {
  const db = await createServerClient();
  return db.from("clubs").select("*").eq("id", id).single();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { title: "Club" };
  const { data: club } = await loadClub(id);
  return { title: club?.name ?? "Club" };
}

type Profile = NonNullable<MemberRow["user"]>;

/**
 * Hall of fame entries with their player. Players are usually members,
 * whose profiles the members' snapshots carry: only the others are read
 * (as `users!club_hall_of_fame_player_id_fkey(...)` read each one).
 */
async function withHallOfFamePlayers(
  db: Awaited<ReturnType<typeof createServerClient>>,
  rows: Array<Record<string, unknown> & { player_id?: string | null }>,
  members: MemberRow[],
): Promise<HallOfFameRow[]> {
  const profiles = new Map<string, Profile>();
  for (const m of members) if (m.user) profiles.set(m.user.id, m.user);
  const unknown = [
    ...new Set(
      rows
        .map((h) => h.player_id)
        .filter((pid): pid is string => !!pid && !profiles.has(pid)),
    ),
  ];
  if (unknown.length) {
    const { data } = await db
      .from("users")
      .select("id, full_name, avatar_url")
      .in("id", unknown);
    for (const p of (data ?? []) as Profile[]) profiles.set(p.id, p);
  }
  return rows.map(({ player_id, ...entry }) => ({
    ...(entry as unknown as Omit<HallOfFameRow, "player">),
    player: (player_id && profiles.get(player_id)) || null,
  }));
}

export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const db = await createServerClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  const [
    { data: club },
    { data: teams },
    { data: tournaments },
    { data: matches },
    { data: members },
    { data: seasons },
    { data: hallOfFame },
  ] = await Promise.all([
    loadClub(id),
    db
      .from("teams")
      .select(
        // team_players(count) first: it is served from the roster, whose
        // player snapshots then answer the captain lookup (no reads).
        "id, name, short_name, logo_url, team_type, team_players(count), captain:users!teams_captain_id_fkey(full_name)",
      )
      .eq("club_id", id)
      .order("name"),
    db
      .from("tournaments")
      .select(
        "id, name, description, status, tournament_format, match_format, start_date, end_date, venue, season_id, overs_per_innings",
      )
      .eq("club_id", id)
      .order("start_date", { ascending: false }),
    db
      .from("matches")
      .select(
        `
                id, title, match_format, overs_per_innings, status, venue, scheduled_at,
                result_type, win_margin, win_margin_type, result_description, season_id,
                ${MATCH_TEAM_COLUMNS},
                innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
            `,
      )
      .eq("club_id", id)
      .order("scheduled_at", { ascending: false }),
    db
      .from("club_memberships")
      .select(
        "id, role, status, joined_at, user:users(id, full_name, avatar_url)",
      )
      .eq("club_id", id)
      .order("joined_at", { ascending: true }),
    db
      .from("club_seasons")
      .select("id, name, start_date, end_date, is_current")
      .eq("club_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("club_hall_of_fame")
      .select(
        `
                id, category, title, description, season_or_year, record_metric, inducted_at,
                player_id
            `,
      )
      .eq("club_id", id)
      .order("inducted_at", { ascending: false }),
  ]);

  if (!club) notFound();

  const typedTeams = (teams ?? []) as unknown as TeamRow[];
  const typedTournaments = (tournaments ?? []) as unknown as TournamentRow[];
  const typedMatches = (await attachMatchTeams(
    db,
    matches ?? [],
  )) as unknown as MatchRow[];
  const typedMembers = (members ?? []) as unknown as MemberRow[];
  const typedSeasons = (seasons ?? []) as unknown as SeasonRow[];
  const typedHallOfFame = await withHallOfFamePlayers(
    db,
    hallOfFame ?? [],
    typedMembers,
  );

  const isOwner = user?.id === club.owner_id;
  const myMembership = typedMembers.find((m) => m.user?.id === user?.id);
  const isAdmin = isOwner || myMembership?.role === "admin";
  const isMember = !!myMembership;

  // Private clubs are only visible to their owner and members.
  if (club.is_public === false && !isOwner && !isMember) notFound();

  const socialLinks =
    (club.social_links as Record<string, string> | null) ?? {};

  const memberCandidates = typedMembers
    .filter((m) => m.user?.id)
    .map((m) => ({
      id: m.user!.id,
      name: m.user!.full_name,
    }));

  // Aggregate Club Statistics
  const matchIds = typedMatches.map((m) => m.id);
  let battingLeaders: ClubBatterLeader[] = [];
  let bowlingLeaders: ClubBowlerLeader[] = [];
  let leaderboardData: LeaderboardData | null = null;
  let totalRuns = 0;
  let totalWickets = 0;
  let highestTeamScore: {
    runs: number;
    wickets: number;
    overs: number;
    teamName?: string;
  } | null = null;

  if (matchIds.length > 0) {
    // The club's stored leaderboard (one read) plus innings still in play
    // (which also brings the live matches' scores below up to date).
    leaderboardData = await loadScopeLeaderboard(
      db,
      "club",
      id,
      typedMatches as unknown as ScopeMatch[],
    );

    battingLeaders = leaderboardData.batting.map((b) => ({
      userId: b.userId,
      name: b.name,
      avatar: b.avatar,
      runs: b.runs,
      balls: b.balls,
      fours: b.fours,
      sixes: b.sixes,
      inningsCount: b.innings,
      highestScore: b.highestScore,
      strikeRate: b.strikeRateDisplay,
    }));

    bowlingLeaders = leaderboardData.bowling.map((bw) => ({
      userId: bw.userId,
      name: bw.name,
      avatar: bw.avatar,
      wickets: bw.wickets,
      overs: bw.overs,
      runs: bw.runsConceded,
      economy: bw.economyDisplay,
    }));
  }

  typedMatches.forEach((m) => {
    m.innings?.forEach((inn) => {
      const runs = inn.total_runs ?? 0;
      const wickets = inn.total_wickets ?? 0;
      const overs = inn.total_overs ?? 0;
      totalRuns += runs;
      totalWickets += wickets;

      if (!highestTeamScore || runs > highestTeamScore.runs) {
        const team =
          inn.team_id === m.team1?.id
            ? m.team1
            : inn.team_id === m.team2?.id
              ? m.team2
              : null;
        highestTeamScore = {
          runs,
          wickets,
          overs,
          teamName: team?.name ?? undefined,
        };
      }
    });
  });

  const milestones: ClubMilestones = {
    totalMatches: typedMatches.length,
    completedMatches: typedMatches.filter((m) => m.status === "completed").length,
    totalRuns,
    totalWickets,
    highestTeamScore,
  };

  return (
    <PageContainer stack={false}>
      {/* Phones: the screen's own bar instead of the header. */}
      <ScreenBar
        className="mb-5 md:hidden"
        title="Club"
        backHref={"/clubs"}
        backLabel={"All clubs"}
      />
      <Button variant="ghost" size="sm" asChild className="mb-4 max-md:hidden">
        <Link href="/clubs">
          <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
          All clubs
        </Link>
      </Button>

      <ProfileHeader
        name={club.name}
        bannerUrl={club.banner_url}
        crest={
          <ClubLogo
            name={club.name}
            shortName={club.short_name}
            logoUrl={club.logo_url}
            className="h-20 w-20 rounded-full text-xl shadow-soft ring-4 ring-card sm:h-24 sm:w-24 sm:text-2xl"
          />
        }
        labels={
          <>
            {club.club_type && (
              <Chip tone="outline">{formatClubType(club.club_type)} club</Chip>
            )}
            {club.founded_year && <Chip>Est. {club.founded_year}</Chip>}
            {typedSeasons.map((s) => (
              <Chip key={s.id} tone={s.is_current ? "primary" : "outline"}>
                <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                {s.name}
                {s.is_current && (
                  <span className="font-normal opacity-80">· Active</span>
                )}
                {isAdmin && !s.is_current && (
                  <DeleteSeasonButton
                    clubId={club.id}
                    seasonId={s.id}
                    seasonName={s.name}
                  />
                )}
              </Chip>
            ))}
          </>
        }
        description={club.description}
        meta={<ClubContacts club={club} socialLinks={socialLinks} />}
        actions={
          <>
            {isAdmin && (
              <ClubMediaDialog
                clubId={club.id}
                clubName={club.name}
                shortName={club.short_name}
                initialLogoUrl={club.logo_url}
                initialBannerUrl={club.banner_url}
              />
            )}
            {isAdmin && <ClubSettingsDialog club={club} />}
            {isAdmin && <SeasonDialog clubId={club.id} />}
            <ClubMembershipButton
              clubId={club.id}
              isMember={isMember}
              isOwner={isOwner}
              isAuthenticated={!!user}
            />
            {isAdmin && (
              <>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link href={`/tournaments/create?clubId=${club.id}`}>
                    New tournament
                  </Link>
                </Button>
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={`/teams/create?clubId=${club.id}`}>
                    <Plus className="h-4 w-4 shrink-0" />
                    New team
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      <ContentSheet className="mt-6 sm:mt-8">
      <StatGrid>
        <StatTile icon={Shield} label="Teams" value={typedTeams.length} />
        <StatTile icon={Trophy} label="Tournaments" value={typedTournaments.length} />
        <StatTile icon={Award} label="Hall of fame" value={typedHallOfFame.length} />
        <StatTile icon={Users} label="Members" value={typedMembers.length} />
      </StatGrid>

      {/* Club Tabs */}
      <Tabs
        defaultValue={resolvedSearchParams?.tab ?? "teams"}
        className="mt-6 sm:mt-8"
      >
        <TabsList className="flex h-auto w-full justify-start">
          <TabsTrigger
            value="teams"
          >
            Teams
          </TabsTrigger>
          <TabsTrigger
            value="tournaments"
          >
            Tournaments
          </TabsTrigger>
          <TabsTrigger
            value="matches"
          >
            Matches
          </TabsTrigger>
          <TabsTrigger
            value="stats"
          >
            Stats & records
          </TabsTrigger>
          <TabsTrigger
            value="hall-of-fame"
          >
            Hall of fame
          </TabsTrigger>
          <TabsTrigger
            value="members"
          >
            Members
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CLUB TEAMS */}
        <TabsContent value="teams" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Teams</h2>
              <p className="text-xs text-muted-foreground">
                Teams representing {club.name} in leagues and friendly matches.
              </p>
            </div>
            {isAdmin && (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/teams/create?clubId=${club.id}`}>
                  <Plus className="h-4 w-4 shrink-0" />
                  Add team
                </Link>
              </Button>
            )}
          </div>

          {typedTeams.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No teams yet"
              description="Add a team to start scheduling matches and tracking player stats."
              primaryAction={
                isAdmin
                  ? {
                      label: "New team",
                      href: `/teams/create?clubId=${club.id}`,
                      icon: Plus,
                    }
                  : undefined
              }
            />
          ) : (
            <ListCard aria-label={`${club.name} teams`}>
              {typedTeams.map((team) => {
                const players = team.team_players?.[0]?.count ?? 0;
                return (
                  <ListRow
                    key={team.id}
                    href={`/teams/${team.id}?clubId=${club.id}`}
                    leading={
                      <TeamCrest
                        name={team.name}
                        shortName={team.short_name}
                        logoUrl={team.logo_url}
                        size="sm"
                      />
                    }
                    title={team.name}
                    subtitle={[
                      `${players} ${players === 1 ? "player" : "players"}`,
                      formatTeamType(team.team_type),
                      team.captain?.full_name
                        ? `${team.captain.full_name} (c)`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                );
              })}
            </ListCard>
          )}
        </TabsContent>

        {/* TAB 2: CLUB TOURNAMENTS */}
        <TabsContent value="tournaments" className="mt-4 sm:mt-6">
          <ClubTournamentsTab
            clubId={club.id}
            clubName={club.name}
            tournaments={typedTournaments}
            seasons={typedSeasons}
            teams={typedTeams}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {/* TAB 3: CLUB MATCHES */}
        <TabsContent value="matches" className="mt-4 sm:mt-6">
          <ClubMatchesTab
            clubId={club.id}
            matches={typedMatches}
            seasons={typedSeasons}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {/* TAB 4: CLUB STATS & RECORDS */}
        <TabsContent value="stats" className="mt-4 sm:mt-6">
          <ClubStatsTab
            clubName={club.name}
            milestones={milestones}
            battingLeaders={battingLeaders}
            bowlingLeaders={bowlingLeaders}
            leaderboardData={leaderboardData}
          />
        </TabsContent>

        {/* TAB 4: HALL OF FAME */}
        <TabsContent value="hall-of-fame" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Hall of fame</h2>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Honours, records and champions of {club.name}.
              </p>
            </div>
            {isAdmin && (
              <HallOfFameDialog clubId={club.id} members={memberCandidates} />
            )}
          </div>

          {typedHallOfFame.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <h3 className="mb-1 text-base font-semibold text-foreground">
                  No one in the hall of fame yet
                </h3>
                <p className="mx-auto mb-4 max-w-sm text-xs">
                  Admins can add players to recognise records, titles and long
                  service.
                </p>
                {isAdmin && (
                  <HallOfFameDialog
                    clubId={club.id}
                    members={memberCandidates}
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typedHallOfFame.map((entry) => {
                const category = entry.category.replace(/_/g, " ");
                return (
                  <Card key={entry.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={entry.player?.full_name ?? "Member"}
                        src={entry.player?.avatar_url}
                        size="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-foreground">
                          {entry.player?.full_name ?? "Honoured member"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {entry.title}
                        </span>
                      </span>
                      {isAdmin && (
                        <RemoveHallOfFameButton
                          clubId={club.id}
                          hallOfFameId={entry.id}
                          playerName={entry.player?.full_name ?? "Honoured member"}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="primary" size="sm">
                        {category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}
                      </Chip>
                      {entry.season_or_year && (
                        <span className="font-score text-xs tabular-nums text-muted-foreground">
                          {entry.season_or_year}
                        </span>
                      )}
                    </div>
                    {entry.record_metric && (
                      <p className="font-score text-lg font-semibold tabular-nums text-foreground">
                        {entry.record_metric}
                      </p>
                    )}
                    {entry.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {entry.description}
                      </p>
                    )}
                    {entry.inducted_at && (
                      <p className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                        Inducted{" "}
                        {new Date(entry.inducted_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 5: CLUB MEMBERS */}
        <TabsContent value="members" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Members
              </h2>
              <p className="text-xs text-muted-foreground">
                Owners, administrators, coaches, and registered players.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && <InviteMemberDialog clubId={club.id} />}
              <ClubMembershipButton
                clubId={club.id}
                isMember={isMember}
                isOwner={isOwner}
                isAuthenticated={!!user}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {typedMembers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No members yet"
                  description="No players or club administrators are registered in this club directory yet."
                  className="border-0 bg-transparent py-12"
                />
              ) : (
                <div className="divide-y divide-border text-sm">
                  {typedMembers.map((m) => {
                    const isClubOwner = m.role === "owner";
                    const isClubAdmin = m.role === "admin";
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Initials name={m.user?.full_name} fallback="U" className="h-9 w-9" />
                          <div>
                            <div className="font-semibold text-foreground">
                              {m.user?.full_name ?? "Unnamed member"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Joined{" "}
                              {new Date(m.joined_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              isClubOwner
                                ? "default"
                                : isClubAdmin
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs capitalize"
                          >
                            {m.role}
                          </Badge>
                          {isOwner && !isClubOwner && (
                            <MemberRoleAction
                              clubId={club.id}
                              membershipId={m.id}
                              currentRole={m.role}
                              userName={m.user?.full_name ?? "Member"}
                            />
                          )}
                          {(isOwner || (isAdmin && !isClubAdmin)) &&
                            !isClubOwner && (
                              <RemoveMemberButton
                                clubId={club.id}
                                membershipId={m.id}
                                userName={m.user?.full_name ?? "Member"}
                              />
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </ContentSheet>
    </PageContainer>
  );
}
