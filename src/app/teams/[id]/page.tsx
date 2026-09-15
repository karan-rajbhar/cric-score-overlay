import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Users,
  Trophy,
  Calendar,
  AlertCircle,
  Swords,
} from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { getTeam } from "../actions";
import { createServerClient } from "~/lib/supabase/server";
import { PlayerList } from "~/components/teams/player-list";
import { AddPlayerDialog } from "~/components/teams/add-player-dialog";
import { formatTeamType } from "~/lib/cricket";
import { TeamLogoEditor } from "~/components/teams/team-logo-editor";
import { TeamLogo } from "~/components/teams/team-logo";
import { TeamSquadShare } from "~/components/teams/team-squad-share";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import {
  TeamMatchesView,
  type TeamMatchItem,
} from "~/components/teams/team-matches-view";

function TeamLogoStatic({
  name,
  shortName,
  logoUrl,
}: {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
}) {
  return (
    <TeamLogo
      name={name}
      shortName={shortName}
      logoUrl={logoUrl}
      className="h-16 w-16 rounded-lg text-lg"
    />
  );
}

export default async function TeamDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tournamentId?: string; clubId?: string }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const { tournamentId, clubId } = resolvedSearchParams ?? {};

  const { data: team, error } = await getTeam(id);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tournamentInfo: { id: string; name: string } | null = null;
  if (
    tournamentId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tournamentId,
    )
  ) {
    const { data: t } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("id", tournamentId)
      .single();
    if (t) tournamentInfo = t;
  }

  const targetClubId = clubId || team?.club_id;
  let clubInfo: { id: string; name: string; owner_id?: string | null } | null =
    null;
  if (
    targetClubId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      targetClubId,
    )
  ) {
    const { data: c } = await supabase
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
      const { data: mem } = await supabase
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

  const canEditLogo = canManageTeam;

  let backHref = "/teams";
  let backLabel = "Back to Teams";
  if (tournamentInfo) {
    backHref = `/tournaments/${tournamentInfo.id}?tab=teams`;
    backLabel = `Back to ${tournamentInfo.name}`;
  } else if (clubInfo) {
    backHref = `/clubs/${clubInfo.id}?tab=teams`;
    backLabel = `Back to ${clubInfo.name}`;
  }

  if (error || !team) {
    if (!team) notFound();
    return (
      <div className="container mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={AlertCircle}
          title="Error Loading Team"
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
        email?: string;
        avatar_url?: string;
      };
    }> | null) || [];

  // Fetch all matches for this team
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
    .or(`team1_id.eq.${id},team2_id.eq.${id}`)
    .order("scheduled_at", { ascending: false });

  const teamMatches = (matchesData ?? []) as unknown as TeamMatchItem[];

  // Match statistics for this team
  const totalMatches = teamMatches.length;
  const wonMatches = teamMatches.filter((m) => m.winning_team_id === id).length;
  const lostMatches = teamMatches.filter(
    (m) =>
      m.winning_team_id && m.winning_team_id !== id && m.status === "completed",
  ).length;
  const tiedMatches = teamMatches.filter(
    (m) => m.status === "completed" && !m.winning_team_id,
  ).length;
  const completedCount = wonMatches + lostMatches + tiedMatches;
  const winRate =
    completedCount > 0 ? Math.round((wonMatches / completedCount) * 100) : null;

  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8">
      {/* Contextual Breadcrumbs and Back Navigation */}
      <div className="mb-6 flex flex-col gap-2.5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {tournamentInfo ? (
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
              <Link
                href={`/tournaments/${tournamentInfo.id}?tab=teams`}
                className="transition-colors hover:text-foreground"
              >
                Teams
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[160px] truncate font-medium text-foreground">
                {team.name}
              </span>
            </>
          ) : clubInfo ? (
            <>
              <Link
                href="/clubs"
                className="transition-colors hover:text-foreground"
              >
                Clubs
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link
                href={`/clubs/${clubInfo.id}`}
                className="max-w-[160px] truncate transition-colors hover:text-foreground"
              >
                {clubInfo.name}
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link
                href={`/clubs/${clubInfo.id}?tab=teams`}
                className="transition-colors hover:text-foreground"
              >
                Teams
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[160px] truncate font-medium text-foreground">
                {team.name}
              </span>
            </>
          ) : (
            <>
              <Link
                href="/teams"
                className="transition-colors hover:text-foreground"
              >
                Teams
              </Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="max-w-[200px] truncate font-medium text-foreground">
                {team.name}
              </span>
            </>
          )}
        </nav>

        <Button
          variant="ghost"
          className="interactive-button w-fit pl-0 text-sm font-medium"
          asChild
        >
          <Link href={backHref}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">{backLabel}</span>
          </Link>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Team Info Sidebar */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                {canEditLogo ? (
                  <TeamLogoEditor
                    teamId={team.id}
                    teamName={team.name}
                    shortName={team.short_name}
                    logoUrl={team.logo_url}
                  />
                ) : (
                  <TeamLogoStatic
                    name={team.name}
                    shortName={team.short_name}
                    logoUrl={team.logo_url}
                  />
                )}
                {canManageTeam && (
                  <Button
                    variant="outline"
                    size="icon"
                    title="Edit Team"
                    aria-label="Edit Team"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <CardTitle className="text-2xl">{team.name}</CardTitle>
              {team.short_name && (
                <CardDescription className="text-lg font-medium">
                  {team.short_name}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {team.description || "No description provided."}
              </p>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    Squad Size
                  </div>
                  <span className="font-medium">{players.length}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Trophy className="mr-2 h-4 w-4" />
                    Type
                  </div>
                  <Badge variant="secondary">
                    {formatTeamType(team.team_type)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    Created
                  </div>
                  <span className="font-medium">
                    {new Date(team.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {team.captain && (
                <div className="border-t pt-4">
                  <p className="mb-2 text-sm font-medium">Leadership</p>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge className="border-yellow-200 bg-yellow-500/10 text-yellow-600">
                      C
                    </Badge>
                    <span className="text-sm">{team.captain.full_name}</span>
                  </div>
                  {team.vice_captain && (
                    <div className="flex items-center gap-2">
                      <Badge className="border-blue-200 bg-blue-500/10 text-blue-600">
                        VC
                      </Badge>
                      <span className="text-sm">
                        {team.vice_captain.full_name}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Match Record Card in Sidebar */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Match record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="tabular text-xl font-bold">
                    {totalMatches}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Played
                  </div>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                  <div className="tabular text-xl font-bold">{wonMatches}</div>
                  <div className="text-[11px] font-medium">Won</div>
                </div>
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
                  <div className="tabular text-xl font-bold">{lostMatches}</div>
                  <div className="text-[11px] font-medium">Lost</div>
                </div>
                <div className="rounded-md border bg-muted/30 p-2">
                  <div className="tabular text-xl font-bold">{tiedMatches}</div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Tied/NR
                  </div>
                </div>
              </div>
              {winRate !== null && (
                <div className="flex items-center justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground">Win rate</span>
                  <span className="tabular font-semibold text-foreground">
                    {winRate}%
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area: Tabs for Matches & Squad */}
        <div className="space-y-6 lg:col-span-2">
          <Tabs
            defaultValue={tournamentId ? "matches" : "matches"}
            className="w-full"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:w-auto">
                <TabsTrigger
                  value="matches"
                  className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                >
                  <Swords className="h-4 w-4" />
                  Matches
                  <Badge
                    variant="secondary"
                    className="tabular ml-1 h-5 px-1.5 text-xs font-semibold"
                  >
                    {teamMatches.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="squad"
                  className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm"
                >
                  <Users className="h-4 w-4" />
                  Squad
                  <Badge
                    variant="secondary"
                    className="tabular ml-1 h-5 px-1.5 text-xs font-semibold"
                  >
                    {players.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="matches" className="mt-4">
              <TeamMatchesView
                currentTeamId={team.id}
                matches={teamMatches}
                tournamentInfo={tournamentInfo}
              />
            </TabsContent>

            <TabsContent value="squad" className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                  Squad roster
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
                  {canManageTeam && <AddPlayerDialog teamId={team.id} />}
                </div>
              </div>

              <PlayerList
                teamId={team.id}
                players={players}
                allowEdit={canManageTeam}
                tournamentId={tournamentId}
                clubId={targetClubId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
