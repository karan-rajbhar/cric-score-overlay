import { PageTrail } from "~/components/ds/page-trail";
import { backLabelOf, clubTrail, parentOf } from "~/lib/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { cachedForMetadata } from "~/lib/metadata-cache";
import {
  isClubId,
  loadClub,
  loadClubViewer,
  MEMBER_COLUMNS,
  withHallOfFamePlayers,
  type MemberRow,
  type SeasonRow,
  type TeamRow,
  type TournamentRow,
} from "../club-view";
import { Card, CardContent } from "~/components/ui/card";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { Chip } from "~/components/ds/chip";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import { ListCard, ListRow } from "~/components/ds/list";
import { ProfileHeader } from "~/components/ds/player-header";
import { EntityActions } from "~/components/follow/entity-actions";
import { ClubContacts } from "~/components/clubs/club-contacts";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ActionsSheet } from "~/components/ds/actions-sheet";
import { PinnedTitle } from "~/components/ds/pinned-title";
import { PinnedTabs } from "~/components/ds/tabs";
import { OnDemandPanels, OnDemandTabs } from "~/components/ui/on-demand-tabs";
import { TabsContent } from "~/components/ui/tabs";
import {
  Calendar,
  Users,
  Trophy,
  Shield,
  Plus,
  Award,
} from "lucide-react";
import { ClubMembershipButton } from "~/components/clubs/club-membership-button";
import {
  HallOfFameDialog,
  RemoveHallOfFameButton,
} from "~/components/clubs/hall-of-fame-dialog";
import {
  SeasonDialog,
  DeleteSeasonButton,
} from "~/components/clubs/season-dialog";
import { ClubSettingsDialog } from "~/components/clubs/club-settings-dialog";
import { ClubStreamingDialog } from "~/components/streaming/club-streaming-dialog";
import { ClubLogo } from "~/components/clubs/club-logo";
import { ClubMediaDialog } from "~/components/clubs/club-media-dialog";
import { ClubTournamentsTab } from "~/components/clubs/club-tournaments-tab";
import { EmptyState } from "~/components/ui/empty-state";
import {
  formatClubType,
  formatTeamType,
} from "~/lib/cricket";
import { ContentSheet, pinnedPage, ScreenBar } from "~/components/ds/screen";
import { PageContainer } from "~/components/layout/page";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isClubId(id)) return { title: "Club" };
  const name = await cachedForMetadata(
    `club:${id}`,
    async () => (await loadClub(id)).data?.name,
  );
  return { title: name ?? "Club" };
}

/**
 * The club's header and the tabs that cost little: it runs once, and opening
 * a costly tab re-renders only `page.tsx` beneath it.
 */
export default async function ClubLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const { db, user, club, isOwner, isAdmin, isMember } =
    await loadClubViewer(id);

  const [
    { data: teams },
    { data: tournaments },
    { data: seasons },
    { data: hallOfFame },
  ] = await Promise.all([
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

  const typedTeams = (teams ?? []) as unknown as TeamRow[];
  const typedTournaments = (tournaments ?? []) as unknown as TournamentRow[];
  const typedSeasons = (seasons ?? []) as unknown as SeasonRow[];

  // Admins pick members in their dialogs (hall of fame, roles): they get
  // every member here; everyone else only the count above the tabs.
  const typedMembers = (isAdmin
    ? ((
        await db
          .from("club_memberships")
          .select(MEMBER_COLUMNS)
          .eq("club_id", id)
          .order("joined_at", { ascending: true })
      ).data ?? [])
    : []) as unknown as MemberRow[];
  const memberTotal = isAdmin
    ? typedMembers.length
    : ((
        await db
          .from("club_memberships")
          .select("id", { count: "exact", head: true })
          .eq("club_id", id)
      ).count ?? 0);
  const typedHallOfFame = await withHallOfFamePlayers(
    db,
    hallOfFame ?? [],
    typedMembers,
  );

  const socialLinks =
    (club.social_links as Record<string, string> | null) ?? {};

  const memberCandidates = typedMembers
    .filter((m) => m.user?.id)
    .map((m) => ({
      id: m.user!.id,
      name: m.user!.full_name,
    }));

  const trail = clubTrail();

  const membership = (
    <ClubMembershipButton
      clubId={club.id}
      isMember={isMember}
      isOwner={isOwner}
      isAuthenticated={!!user}
    />
  );
  const newTeam = (
    <Button asChild size="sm" className="gap-1.5">
      <Link href={`/teams/create?clubId=${club.id}`}>
        <Plus className="h-4 w-4 shrink-0" />
        New team
      </Link>
    </Button>
  );
  const newTournament = (
    <Button asChild size="sm" variant="outline" className="gap-1.5">
      <Link href={`/tournaments/create?clubId=${club.id}`}>New tournament</Link>
    </Button>
  );
  const adminTools = isAdmin && (
    <>
      <ClubMediaDialog
        clubId={club.id}
        clubName={club.name}
        shortName={club.short_name}
        initialLogoUrl={club.logo_url}
        initialBannerUrl={club.banner_url}
      />
      <ClubSettingsDialog club={club} />
      <ClubStreamingDialog clubId={club.id} />
      <SeasonDialog clubId={club.id} />
    </>
  );

  // Only what has something in it; its admins can start what does not yet.
  const clubTabs = [
    { value: "teams", label: "Teams" },
    (isAdmin || typedTournaments.length > 0) && {
      value: "tournaments",
      label: "Tournaments",
    },
    { value: "matches", label: "Matches" },
    { value: "stats", label: "Stats" },
    (isAdmin || typedHallOfFame.length > 0) && {
      value: "hall-of-fame",
      label: "Hall of fame",
    },
    { value: "members", label: "Members" },
  ].filter((t) => !!t);

  return (
    <PageContainer stack={false} className={pinnedPage}>
      {/* Phones: the screen's own bar instead of the header. */}
      <ScreenBar
        className="mb-4 md:hidden"
        backHref={parentOf(trail)}
        backLabel={backLabelOf(trail)}
        action={
          <>
            {membership}
            <ActionsSheet title={club.name} label="Club actions">
              {isAdmin && newTeam}
              {isAdmin && newTournament}
              <EntityActions kind="club" id={club.id} name={club.name} />
              {adminTools}
              <div className="flex !min-h-0 flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pt-2 text-sm text-muted-foreground empty:hidden">
                <ClubContacts
                  club={club}
                  socialLinks={socialLinks}
                  part="contact"
                />
              </div>
            </ActionsSheet>
          </>
        }
      />
      <PageTrail crumbs={trail} current={club.name} className="mb-4" />

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
        meta={
          <>
            <span className="contents max-md:hidden">
              <ClubContacts club={club} socialLinks={socialLinks} />
            </span>
            <span className="contents md:hidden">
              <ClubContacts club={club} socialLinks={socialLinks} part="place" />
            </span>
          </>
        }
        actions={
          <>
            {adminTools}
            <EntityActions kind="club" id={club.id} name={club.name} />
            {membership}
            {isAdmin && newTournament}
            {isAdmin && newTeam}
          </>
        }
      />
      <PinnedTitle>{club.name}</PinnedTitle>

      <ContentSheet className="mt-4 sm:mt-8">
      <StatGrid compact>
        <StatTile compact icon={Shield} label="Teams" value={typedTeams.length} />
        <StatTile compact icon={Trophy} label="Tournaments" value={typedTournaments.length} />
        <StatTile compact icon={Award} label="Hall of fame" value={typedHallOfFame.length} />
        <StatTile compact icon={Users} label="Members" value={memberTotal} />
      </StatGrid>

      {/* Club Tabs */}
      <OnDemandTabs
        fallback="teams"
        tabs={clubTabs.map((t) => t.value)}
        onDemand={["matches", "stats", "members"]}
        className="mt-3 sm:mt-8"
      >
        <PinnedTabs label="Club sections" tabs={clubTabs} />

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
                    href={`/teams/${team.id}`}
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

        <OnDemandPanels className="mt-4 sm:mt-6">{children}</OnDemandPanels>
      </OnDemandTabs>
      </ContentSheet>
    </PageContainer>
  );
}
