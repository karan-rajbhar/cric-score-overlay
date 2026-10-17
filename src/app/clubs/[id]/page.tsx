import Link from "next/link";
import { Initials } from "~/components/ui/initials";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/firebase/server";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
import { Card, CardContent } from "~/components/ui/card";
import { StatTile } from "~/components/ui/stat-tile";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Globe,
  Users,
  Trophy,
  Shield,
  Plus,
  Award,
  BarChart3,
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
import { PageContainer } from "~/components/layout/page";

export const dynamic = "force-dynamic";

interface TeamRow {
  id: string;
  name: string;
  short_name: string | null;
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
    db.from("clubs").select("*").eq("id", id).single(),
    db
      .from("teams")
      .select(
        // team_players(count) first: it is served from the roster, whose
        // player snapshots then answer the captain lookup (no reads).
        "id, name, short_name, team_type, team_players(count), captain:users!teams_captain_id_fkey(full_name)",
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
                player:users!club_hall_of_fame_player_id_fkey(id, full_name, avatar_url)
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
  const typedHallOfFame = (hallOfFame ?? []) as unknown as HallOfFameRow[];

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

  if (matchIds.length > 0) {
    // The club's stored leaderboard (one read) plus innings still in play.
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

  const milestones: ClubMilestones = {
    totalMatches: typedMatches.length,
    completedMatches: typedMatches.filter((m) => m.status === "completed").length,
    totalRuns,
    totalWickets,
    highestTeamScore,
  };

  return (
    <PageContainer stack={false}>
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/clubs">
          <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
          All clubs
        </Link>
      </Button>

      {/* Club Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-6 md:p-8">
        {club.banner_url && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 dark:opacity-20 pointer-events-none"
            style={{ backgroundImage: `url(${club.banner_url})` }}
          />
        )}
        <div className="relative z-10 flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <ClubLogo
              name={club.name}
              shortName={club.short_name}
              logoUrl={club.logo_url}
              className="h-12 w-12 shrink-0 sm:h-16 sm:w-16 text-lg sm:text-2xl rounded-2xl"
            />
            <div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {club.club_type && (
                  <Badge variant="outline">
                    {formatClubType(club.club_type)} Club
                  </Badge>
                )}
                {club.founded_year && (
                  <Badge variant="secondary">Est. {club.founded_year}</Badge>
                )}
                {club.short_name && (
                  <Badge variant="secondary" className="font-bold">
                    {club.short_name}
                  </Badge>
                )}
                {typedSeasons.map((s) => (
                  <Badge
                    key={s.id}
                    variant={s.is_current ? "default" : "outline"}
                    className="gap-1 text-xs"
                  >
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{s.name}</span>
                    {s.is_current && (
                      <span className="text-2xs font-normal opacity-80">
                        (Active)
                      </span>
                    )}
                    {isAdmin && !s.is_current && (
                      <DeleteSeasonButton
                        clubId={club.id}
                        seasonId={s.id}
                        seasonName={s.name}
                      />
                    )}
                  </Badge>
                ))}
              </div>

              <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">
                {club.name}
              </h1>

              {club.description && (
                <p className="mt-2 max-w-2xl text-xs text-muted-foreground sm:text-sm">
                  {club.description}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:gap-4">
                {club.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{club.location}</span>
                  </div>
                )}
                {club.contact_email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{club.contact_email}</span>
                  </div>
                )}
                {club.contact_phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{club.contact_phone}</span>
                  </div>
                )}
                {club.website_url && (
                  <a
                    href={
                      club.website_url.startsWith("http")
                        ? club.website_url
                        : `https://${club.website_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span>Website</span>
                  </a>
                )}
                {socialLinks.twitter && (
                  <a
                    href={
                      socialLinks.twitter.startsWith("http")
                        ? socialLinks.twitter
                        : `https://x.com/${socialLinks.twitter}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <span>X / Twitter</span>
                  </a>
                )}
                {socialLinks.instagram && (
                  <a
                    href={
                      socialLinks.instagram.startsWith("http")
                        ? socialLinks.instagram
                        : `https://instagram.com/${socialLinks.instagram}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-pink-400 hover:text-pink-300"
                  >
                    <span>Instagram</span>
                  </a>
                )}
                {socialLinks.youtube && (
                  <a
                    href={
                      socialLinks.youtube.startsWith("http")
                        ? socialLinks.youtube
                        : `https://youtube.com/${socialLinks.youtube}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-red-400 hover:text-red-300"
                  >
                    <span>YouTube</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5 sm:w-auto"
                >
                  <Link href={`/tournaments/create?clubId=${club.id}`}>
                    New tournament
                  </Link>
                </Button>
                <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
                  <Link href={`/teams/create?clubId=${club.id}`}>
                    <Plus className="h-4 w-4 shrink-0" />
                    New team
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Club Stats Counters */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <StatTile bordered={false} label="Teams" value={typedTeams.length} />
          <StatTile
            bordered={false}
            label="Tournaments"
            value={typedTournaments.length}
          />
          <StatTile
            bordered={false}
            label="Hall of fame"
            value={typedHallOfFame.length}
          />
          <StatTile bordered={false} label="Members" value={typedMembers.length} />
        </div>
      </div>

      {/* Club Tabs */}
      <Tabs
        defaultValue={resolvedSearchParams?.tab ?? "teams"}
        className="mt-6 sm:mt-8"
      >
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto no-scrollbar p-1 sm:grid sm:grid-cols-6 sm:max-w-3xl sm:justify-stretch">
          <TabsTrigger
            value="teams"
          >
            <Shield className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            Teams ({typedTeams.length})
          </TabsTrigger>
          <TabsTrigger
            value="tournaments"
          >
            <Trophy className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            Tournaments ({typedTournaments.length})
          </TabsTrigger>
          <TabsTrigger
            value="matches"
          >
            <Calendar className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            Matches ({typedMatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="stats"
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            Stats & records
          </TabsTrigger>
          <TabsTrigger
            value="hall-of-fame"
          >
            <Award className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            Hall of Fame ({typedHallOfFame.length})
          </TabsTrigger>
          <TabsTrigger
            value="members"
          >
            <Users className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
            Members ({typedMembers.length})
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {typedTeams.map((team) => (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}?clubId=${club.id}`}
                  className="group"
                >
                  <Card className="transition-colors group-hover:border-primary/50">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold transition-colors group-hover:text-primary">
                            {team.name}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Captain: {team.captain?.full_name ?? "Not assigned"}
                          </p>
                        </div>
                        {team.short_name && (
                          <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
                            {team.short_name}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                        <span>{formatTeamType(team.team_type)}</span>
                        <span>
                          <span className="tabular-nums">{team.team_players?.[0]?.count ?? 0}</span> Players
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
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
                <h2 className="text-lg font-semibold">Hall of Fame</h2>
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
                  No Hall of Fame entries yet
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
                return (
                  <Card key={entry.id}>
                    <CardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs font-medium capitalize"
                          >
                            {entry.category.replace(/_/g, " ")}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            {entry.season_or_year && (
                              <span className="font-mono text-2xs text-muted-foreground">
                                {entry.season_or_year}
                              </span>
                            )}
                            {isAdmin && (
                              <RemoveHallOfFameButton
                                clubId={club.id}
                                hallOfFameId={entry.id}
                                playerName={
                                  entry.player?.full_name ?? "Honored Member"
                                }
                              />
                            )}
                          </div>
                        </div>

                        <div className="mb-3 flex items-center gap-3">
                          <Initials name={entry.player?.full_name} fallback="L" className="h-11 w-11 text-sm" />
                          <div>
                            <h3 className="text-base font-semibold leading-tight text-foreground">
                              {entry.player?.full_name ?? "Honored Member"}
                            </h3>
                            <p className="text-xs font-medium text-muted-foreground">
                              {entry.title}
                            </p>
                          </div>
                        </div>

                        {entry.record_metric && (
                          <div className="mb-3 inline-block rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs font-semibold tabular-nums text-foreground">
                            {entry.record_metric}
                          </div>
                        )}

                        {entry.description && (
                          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                            {entry.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-2xs text-muted-foreground">
                        <span>Inducted</span>
                        {entry.inducted_at && (
                          <span>
                            {new Date(entry.inducted_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
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
                  title="No Members Registered"
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
                              {m.user?.full_name ?? "Unnamed Member"}
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
    </PageContainer>
  );
}
