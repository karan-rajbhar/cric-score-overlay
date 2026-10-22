import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { createServerClient } from "~/lib/firebase/server";
import {
  attachMatchTeams,
  MATCH_TEAM_COLUMNS,
} from "~/lib/firebase/team-snapshot";
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
  Shield,
  Swords,
  CheckCircle2,
  CalendarClock,
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
import type { LeaderboardData } from "~/lib/leaderboard";
import {
  loadScopeLeaderboard,
  type ScopeMatch,
} from "~/lib/firebase/leaderboards";
import { ContentSheet, ScreenBar } from "~/components/ds/screen";
import { PageContainer } from "~/components/layout/page";
import { MatchCard } from "~/components/matches/match-card";
import type { Match } from "~/lib/match-types";
import { Chip } from "~/components/ds/chip";
import { ListCard, ListRow, MetaItem } from "~/components/ds/list";
import { TeamCrest } from "~/components/ds/avatar";
import { ProfileHeader } from "~/components/ds/player-header";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import { PointsTable } from "~/components/ds/standings";
import { matchGroupsOf } from "~/lib/match-groups";

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

/** The tournament: read once per request, by the page and its title. */
const loadTournament = cache(async (id: string) => {
  const db = await createServerClient();
  return db
    .from("tournaments")
    // owner_id: the club admin check below needs no second club read.
    .select("*, club:clubs(id, name, short_name, owner_id)")
    .eq("id", id)
    .single();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { title: "Tournament" };
  const { data: tournament } = await loadTournament(id);
  return { title: tournament?.name ?? "Tournament" };
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
  const db = await createServerClient();

  const [
    { data: tournament },
    { data: standingRows },
    { data: registrations },
    { data: matches },
  ] = await Promise.all([
    loadTournament(id),
    db
      .from("tournament_standings")
      .select("*")
      .eq("tournament_id", id)
      .order("points", { ascending: false })
      .order("net_run_rate", { ascending: false }),
    db
      .from("tournament_registrations")
      .select(
        // team_players(count) first: served from the roster, whose player
        // snapshots then answer the captain lookup (no reads).
        "*, team:teams(id, name, short_name, logo_url, team_players(count), captain:users!teams_captain_id_fkey(full_name))",
      )
      .eq("tournament_id", id)
      .order("registered_at", { ascending: true }),
    db
      .from("matches")
      .select(
        `
                id, title, match_format, overs_per_innings, status, venue, scheduled_at,
                result_type, win_margin, win_margin_type, result_description, winning_team_id,
                ${MATCH_TEAM_COLUMNS},
                innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
            `,
      )
      .eq("tournament_id", id)
      .order("scheduled_at", { ascending: true }),
  ]);

  if (!tournament) notFound();
  await attachMatchTeams(db, matches ?? []);

  // The points table's teams are the registered teams, whose documents the
  // registrations query has just read: only a team no longer registered is
  // read again (as `team:teams(id, name, short_name, logo_url)` would).
  type StandingTeam = {
    id: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
  };
  const standingTeams = new Map<string, StandingTeam | null>();
  for (const r of registrations ?? []) {
    const t = r.team as StandingTeam | null;
    standingTeams.set(
      r.team_id,
      t
        ? {
            id: t.id,
            name: t.name,
            short_name: t.short_name,
            logo_url: t.logo_url,
          }
        : null,
    );
  }
  const unregistered = [
    ...new Set((standingRows ?? []).map((s) => s.team_id)),
  ].filter((teamId) => !standingTeams.has(teamId));
  if (unregistered.length) {
    const { data } = await db
      .from("teams")
      .select("id, name, short_name, logo_url")
      .in("id", unregistered);
    for (const t of (data ?? []) as StandingTeam[]) standingTeams.set(t.id, t);
  }
  const standings = (standingRows ?? []).map((s) => ({
    ...s,
    team: standingTeams.get(s.team_id) ?? null,
  }));

  // Super Stars & Leaderboards: the tournament's stored leaderboard (one
  // read) plus any innings still in play.
  const leaderboardData: LeaderboardData = await loadScopeLeaderboard(
    db,
    "tournament",
    id,
    (matches ?? []) as unknown as ScopeMatch[],
  );

  const {
    data: { user },
  } = await db.auth.getUser();

  let isClubAdmin = false;
  if (user && tournament.club_id) {
    const club = tournament.club as { owner_id?: string | null } | null;

    if (club?.owner_id === user.id) {
      isClubAdmin = true;
    } else {
      const { data: mem } = await db
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

  // Teams the viewer may register: every team for tournament admins,
  // otherwise only teams they have a stake in (indexed queries instead of
  // reading every team). Anonymous viewers need none.
  const TEAM_COLUMNS =
    "id, name, short_name, club_id, created_by, captain_id, vice_captain_id";
  let allTeams: Array<{ id: string; name: string; short_name: string | null }> =
    [];
  const myTeamIds = new Set<string>();
  if (user && isTournamentAdmin) {
    const { data } = await db.from("teams").select(TEAM_COLUMNS).order("name");
    allTeams = data ?? [];
  } else if (user) {
    const [teamPlayersRes, clubMemsRes, clubsRes] = await Promise.all([
      db.from("team_players").select("team_id").eq("user_id", user.id),
      db
        .from("club_memberships")
        .select("club_id")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active"),
      db.from("clubs").select("id").eq("owner_id", user.id),
    ]);

    const adminClubIds = new Set<string>([
      ...(clubMemsRes.data ?? []).map((m) => m.club_id),
      ...(clubsRes.data ?? []).map((c) => c.id),
    ]);
    const playerTeamIds = new Set<string>(
      (teamPlayersRes.data ?? []).map((r) => r.team_id),
    );

    const stakes = await Promise.all([
      db.from("teams").select(TEAM_COLUMNS).eq("created_by", user.id),
      db.from("teams").select(TEAM_COLUMNS).eq("captain_id", user.id),
      db.from("teams").select(TEAM_COLUMNS).eq("vice_captain_id", user.id),
      playerTeamIds.size
        ? db.from("teams").select(TEAM_COLUMNS).in("id", [...playerTeamIds])
        : Promise.resolve({ data: [] }),
      adminClubIds.size
        ? db
            .from("teams")
            .select(TEAM_COLUMNS)
            .in("club_id", [...adminClubIds])
        : Promise.resolve({ data: [] }),
    ]);
    const byId = new Map<string, (typeof allTeams)[number]>();
    for (const res of stakes) {
      for (const t of (res.data ?? []) as typeof allTeams) byId.set(t.id, t);
    }
    allTeams = [...byId.values()].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );

    allTeams.forEach(
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
      ? allTeams
      : allTeams.filter((t: { id: string }) => myTeamIds.has(t.id))
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
  const {
    live: liveMatches,
    upcoming: upcomingMatches,
    results: completedMatches,
    noResult: noResultMatches,
  } = matchGroupsOf(typedMatches);

  const targetClubId = resolvedSearchParams?.clubId;
  const matchQuery = `tournamentId=${tournament.id}${
    targetClubId ? `&clubId=${targetClubId}` : ""
  }`;
  const clubInfo = tournament.club as { id: string; name: string } | null;
  const backHref = targetClubId
    ? `/clubs/${targetClubId}?tab=tournaments`
    : "/tournaments";
  const backLabel =
    targetClubId && clubInfo?.name
      ? `Back to ${clubInfo.name}`
      : "All tournaments";

  return (
    <PageContainer stack={false}>
      {/* Phones: the screen's own bar instead of the header. */}
      <ScreenBar
        className="mb-5 md:hidden"
        title="Tournament"
        backHref={backHref}
        backLabel={backLabel}
      />
      {/* Top Back Nav & Breadcrumbs */}
      <div className="mb-4 flex flex-wrap items-center gap-2 max-md:hidden">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="pl-0 text-xs sm:text-sm"
        >
          <Link href={backHref}>
            <ChevronLeft className="mr-1 h-4 w-4 shrink-0" />
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

      <ProfileHeader
        name={tournament.name}
        crest={
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground shadow-soft ring-4 ring-card sm:h-24 sm:w-24">
            <Trophy className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden="true" />
          </span>
        }
        labels={
          <>
            <Chip
              tone={
                tournament.status === "ongoing"
                  ? "primary"
                  : tournament.status === "completed"
                    ? "neutral"
                    : "outline"
              }
            >
              {formatStatus(tournament.status)}
            </Chip>
            <Chip tone="outline">
              {formatTournamentFormat(tournament.tournament_format)} format
            </Chip>
            {tournament.match_format && <Chip>{tournament.match_format}</Chip>}
            {tournament.club && (
              <Link href={`/clubs/${(tournament.club as { id: string }).id}`}>
                <Chip tone="outline" className="hover:bg-accent">
                  <Shield className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {(tournament.club as { name: string }).name}
                </Chip>
              </Link>
            )}
          </>
        }
        description={tournament.description}
        meta={
          <>
            {tournament.venue && (
              <MetaItem icon={MapPin}>{tournament.venue}</MetaItem>
            )}
            {(tournament.start_date || tournament.end_date) && (
              <MetaItem icon={Calendar}>
                {tournament.start_date ?? "TBD"}
                {tournament.end_date ? ` to ${tournament.end_date}` : ""}
              </MetaItem>
            )}
          </>
        }
        actions={
          <>
            {canRegisterTeams && (
              <RegisterTeamDialog
                tournamentId={tournament.id}
                availableTeams={availableTeams}
                registeredTeamIds={registeredTeamIds}
              />
            )}
            {isTournamentAdmin && (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/matches/create?tournamentId=${tournament.id}`}>
                  <Plus className="h-4 w-4 shrink-0" />
                  Schedule match
                </Link>
              </Button>
            )}
          </>
        }
      />

      <ContentSheet className="mt-6 sm:mt-8">
      <StatGrid>
        <StatTile icon={Users} label="Teams" value={(registrations ?? []).length} />
        <StatTile icon={Swords} label="Matches" value={typedMatches.length} />
        <StatTile icon={CheckCircle2} label="Completed" value={completedMatches.length} />
        <StatTile
          icon={CalendarClock}
          label="Upcoming"
          value={upcomingMatches.length}
          hint={liveMatches.length > 0 ? `${liveMatches.length} live now` : undefined}
        />
      </StatGrid>

      {/* Main Tabs Navigation */}
      <Tabs
        defaultValue={resolvedSearchParams?.tab ?? "standings"}
        className="mt-6 sm:mt-8"
      >
        <TabsList className="flex h-auto w-full justify-start">
          <TabsTrigger
            value="standings"
          >
            Points table
          </TabsTrigger>
          <TabsTrigger
            value="fixtures"
          >
            Fixtures
          </TabsTrigger>
          <TabsTrigger
            value="teams"
          >
            Teams
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
          >
            Leaderboard & stats
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: POINTS TABLE */}
        <TabsContent value="standings" className="mt-4 space-y-4 sm:mt-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
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
          {(standings ?? []).length === 0 ? (
            <div className="space-y-4">
              <EmptyState
                icon={Trophy}
                title="No standings yet"
                description="The points table fills in as registered teams play their fixtures."
              />
              {canRegisterTeams && (
                <div className="flex justify-center">
                  <RegisterTeamDialog
                    tournamentId={tournament.id}
                    availableTeams={availableTeams}
                    registeredTeamIds={registeredTeamIds}
                  />
                </div>
              )}
            </div>
          ) : (
            <PointsTable
              title="Points table"
              aside="Net run rate breaks ties"
              rows={(standings ?? []).map((s) => {
                const teamObj = s.team as {
                  id: string;
                  name: string;
                  short_name: string | null;
                  logo_url?: string | null;
                } | null;
                const name = teamObj?.name ?? s.team_id.slice(0, 8);
                const nrr = Number(s.net_run_rate ?? 0);
                const adj = Number(s.points_adjustment ?? 0);
                return {
                  team: {
                    name,
                    shortName: teamObj?.short_name,
                    logoUrl: teamObj?.logo_url,
                  },
                  href: `/teams/${teamObj?.id ?? s.team_id}?tournamentId=${tournament.id}`,
                  played: s.matches_played ?? 0,
                  won: s.wins ?? 0,
                  lost: s.losses ?? 0,
                  tied: s.ties ?? 0,
                  noResult: s.no_results ?? 0,
                  points: Number(s.points ?? 0),
                  netRunRate: nrr > 0 ? `+${nrr.toFixed(2)}` : nrr.toFixed(2),
                  status:
                    s.qualification_status === "qualified" ||
                    s.qualification_status === "eliminated"
                      ? s.qualification_status
                      : null,
                  adjustment: adj ? `${adj > 0 ? "+" : ""}${adj} adj` : null,
                  action: isTournamentAdmin ? (
                    <PointsOverrideButton
                      tournamentId={tournament.id}
                      teamId={s.team_id}
                      teamName={name}
                      currentAdjustment={s.points_adjustment}
                      currentReason={s.adjustment_reason}
                      currentStatus={s.qualification_status}
                    />
                  ) : undefined,
                };
              })}
            />
          )}
        </TabsContent>

        {/* TAB 2: FIXTURES & MATCHES */}
        <TabsContent value="fixtures" className="mt-4 space-y-6 sm:mt-6">
          {isTournamentAdmin && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {typedMatches.length === 0 && (
                <GenerateFixturesButton tournamentId={tournament.id} />
              )}
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/matches/create?tournamentId=${tournament.id}`}>
                  <Plus className="h-4 w-4 shrink-0" />
                  Schedule match
                </Link>
              </Button>
            </div>
          )}

          {/* Live Matches Section */}
          {liveMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <span
                  className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-live motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Live now
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {liveMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m as unknown as Match}
                    contextQuery={matchQuery}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Fixtures */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">
              Upcoming
            </h3>
            {upcomingMatches.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No upcoming fixtures"
                description="Scheduled matches appear here."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m as unknown as Match}
                    contextQuery={matchQuery}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Completed Matches */}
          {completedMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                Results
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {completedMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m as unknown as Match}
                    contextQuery={matchQuery}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Abandoned or cancelled: the points table's NR column. */}
          {noResultMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                No result
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {noResultMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m as unknown as Match}
                    contextQuery={matchQuery}
                    showActions={false}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 3: TEAMS & SQUADS */}
        <TabsContent value="teams" className="mt-4 space-y-6 sm:mt-6">
          {canRegisterTeams && (
            <div className="flex justify-end">
              <RegisterTeamDialog
                tournamentId={tournament.id}
                availableTeams={availableTeams}
                registeredTeamIds={registeredTeamIds}
              />
            </div>
          )}

          {/* Join requests, for the organisers */}
          {isTournamentAdmin && pendingRegistrations.length > 0 && (
            <section aria-labelledby="pending-requests" className="space-y-2">
              <h3
                id="pending-requests"
                className="px-1 text-base font-semibold text-foreground"
              >
                Waiting for approval
              </h3>
              <ListCard>
                {pendingRegistrations.map((r) => {
                  const team = r.team as {
                    name: string;
                    short_name: string | null;
                    logo_url?: string | null;
                  } | null;
                  return (
                    <div
                      key={r.id}
                      className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                    >
                      <TeamCrest
                        name={team?.name ?? "Team"}
                        shortName={team?.short_name}
                        logoUrl={team?.logo_url}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {team?.name ?? "Team"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Asked{" "}
                          {r.registered_at
                            ? new Date(r.registered_at).toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "short" },
                              )
                            : "recently"}
                        </span>
                      </span>
                      <RegistrationApprovalActions
                        registrationId={r.id}
                        tournamentId={tournament.id}
                      />
                    </div>
                  );
                })}
              </ListCard>
            </section>
          )}

          {confirmedRegistrations.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No teams yet"
              description="Teams appear here once their registration is confirmed."
            />
          ) : (
            <ListCard aria-label="Teams in the tournament">
              {confirmedRegistrations.map((r) => {
                const team = r.team as {
                  id: string;
                  name: string;
                  short_name: string | null;
                  logo_url?: string | null;
                  captain?: { full_name: string } | null;
                  team_players?: { count: number }[];
                } | null;
                const playerCount = team?.team_players?.[0]?.count ?? 0;
                return (
                  <ListRow
                    key={r.id}
                    href={`/teams/${r.team_id}?tournamentId=${tournament.id}`}
                    leading={
                      <TeamCrest
                        name={team?.name ?? "Team"}
                        shortName={team?.short_name}
                        logoUrl={team?.logo_url}
                        size="sm"
                      />
                    }
                    title={team?.name ?? r.team_id}
                    subtitle={[
                      `${playerCount} ${playerCount === 1 ? "player" : "players"}`,
                      team?.captain?.full_name
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

        {/* TAB 4: SUPER STARS & LEADERBOARDS */}
        <TabsContent value="analysis" className="mt-6 space-y-6">
          <LeaderboardView
            title="Leaderboard"
            subtitle={`The leading run scorers, wicket takers and all-rounders in ${tournament.name}.`}
            data={leaderboardData}
            showHighlights={true}
          />
        </TabsContent>
      </Tabs>
      </ContentSheet>
    </PageContainer>
  );
}
