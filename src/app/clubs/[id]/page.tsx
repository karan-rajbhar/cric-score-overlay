import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
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
  Radio,
  ExternalLink,
  Award,
  Sparkles,
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
import { EmptyState } from "~/components/ui/empty-state";
import {
  formatStatus,
  formatTournamentFormat,
  formatClubType,
  formatTeamType,
} from "~/lib/cricket";

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
    email: string | null;
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
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: club },
    { data: teams },
    { data: tournaments },
    { data: matches },
    { data: members },
    { data: seasons },
    { data: hallOfFame },
  ] = await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).single(),
    supabase
      .from("teams")
      .select(
        "id, name, short_name, team_type, captain:users!teams_captain_id_fkey(full_name), team_players(count)",
      )
      .eq("club_id", id)
      .order("name"),
    supabase
      .from("tournaments")
      .select(
        "id, name, description, status, tournament_format, match_format, start_date, end_date, venue",
      )
      .eq("club_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("matches")
      .select(
        `
                id, title, match_format, overs_per_innings, status, venue, scheduled_at,
                result_type, win_margin, win_margin_type, result_description,
                team1:teams!matches_team1_id_fkey(id, name, short_name),
                team2:teams!matches_team2_id_fkey(id, name, short_name),
                innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs)
            `,
      )
      .eq("club_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("club_memberships")
      .select(
        "id, role, status, joined_at, user:users(id, full_name, avatar_url, email)",
      )
      .eq("club_id", id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("club_seasons")
      .select("id, name, start_date, end_date, is_current")
      .eq("club_id", id)
      .order("created_at", { ascending: false }),
    supabase
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
  const typedMatches = (matches ?? []) as unknown as MatchRow[];
  const typedMembers = (members ?? []) as unknown as MemberRow[];
  const typedSeasons = (seasons ?? []) as unknown as SeasonRow[];
  const typedHallOfFame = (hallOfFame ?? []) as unknown as HallOfFameRow[];

  const isOwner = user?.id === club.owner_id;
  const myMembership = typedMembers.find((m) => m.user?.id === user?.id);
  const isAdmin = isOwner || myMembership?.role === "admin";
  const isMember = !!myMembership;

  const socialLinks =
    (club.social_links as Record<string, string> | null) ?? {};

  const memberCandidates = typedMembers
    .filter((m) => m.user?.id)
    .map((m) => ({
      id: m.user!.id,
      name: m.user!.full_name,
    }));

  return (
    <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/clubs">
          <ChevronLeft className="mr-1 h-4 w-4" />
          All Clubs
        </Link>
      </Button>

      {/* Club Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card/90 to-primary/10 p-4 shadow-sm sm:p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner sm:h-16 sm:w-16">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
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
                    <Calendar className="h-3 w-3" />
                    <span>{s.name}</span>
                    {s.is_current && (
                      <span className="text-[10px] font-normal opacity-80">
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

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">
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
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{club.location}</span>
                  </div>
                )}
                {club.contact_email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span>{club.contact_email}</span>
                  </div>
                )}
                {club.contact_phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-primary" />
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
                    <Globe className="h-3.5 w-3.5 text-primary" />
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
                    className="flex items-center gap-1 text-sky-400 hover:text-sky-300"
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
                    <Trophy className="h-4 w-4" />
                    Host Tournament
                  </Link>
                </Button>
                <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
                  <Link href={`/teams/create?clubId=${club.id}`}>
                    <Plus className="h-4 w-4" />
                    Create Club Team
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Club Stats Counters */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border/50 pt-4 text-center sm:grid-cols-4">
          <div>
            <div className="text-xl font-bold text-foreground">
              {typedTeams.length}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Teams
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-foreground">
              {typedTournaments.length}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Tournaments
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-foreground">
              {typedHallOfFame.length}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Hall of Fame
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-foreground">
              {typedMembers.length}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Members
            </div>
          </div>
        </div>
      </div>

      {/* Club Tabs */}
      <Tabs
        defaultValue={resolvedSearchParams?.tab ?? "teams"}
        className="mt-6 sm:mt-8"
      >
        <TabsList className="grid h-auto w-full max-w-2xl grid-cols-2 gap-1 p-1 min-[540px]:grid-cols-3 sm:grid-cols-5">
          <TabsTrigger
            value="teams"
            className="gap-1.5 px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Teams ({typedTeams.length})
          </TabsTrigger>
          <TabsTrigger
            value="tournaments"
            className="gap-1.5 px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Tournaments ({typedTournaments.length})
          </TabsTrigger>
          <TabsTrigger
            value="matches"
            className="gap-1.5 px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Matches ({typedMatches.length})
          </TabsTrigger>
          <TabsTrigger
            value="hall-of-fame"
            className="gap-1.5 px-2 py-1.5 text-xs sm:px-3 sm:text-sm"
          >
            <Award className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Hall of Fame ({typedHallOfFame.length})
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="col-span-2 gap-1.5 px-2 py-1.5 text-xs min-[540px]:col-span-2 sm:col-span-1 sm:px-3 sm:text-sm"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Members ({typedMembers.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CLUB TEAMS */}
        <TabsContent value="teams" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Club Squads & Teams</h2>
              <p className="text-xs text-muted-foreground">
                Teams representing {club.name} in leagues and friendly matches.
              </p>
            </div>
            {isAdmin && (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/teams/create?clubId=${club.id}`}>
                  <Plus className="h-4 w-4" />
                  Add Team
                </Link>
              </Button>
            )}
          </div>

          {typedTeams.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No Teams Registered Yet"
              description="Create the club's first playing squad to start organizing fixtures and player statistics."
              primaryAction={
                isAdmin
                  ? {
                      label: "Create Club Team",
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
                          {team.team_players?.[0]?.count ?? 0} Players
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
        <TabsContent value="tournaments" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold sm:text-lg">
                Hosted Tournaments
              </h2>
              <p className="text-xs text-muted-foreground">
                Cricket leagues, knockout tournaments, and events organized by
                this club.
              </p>
            </div>
            {isAdmin && (
              <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
                <Link href={`/tournaments/create?clubId=${club.id}`}>
                  <Plus className="h-4 w-4" />
                  Host Tournament
                </Link>
              </Button>
            )}
          </div>

          {typedTournaments.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No Tournaments Hosted Yet"
              description="Organize a tournament under your club with automated points tables, fixtures, and leaderboards."
              primaryAction={
                isAdmin
                  ? {
                      label: "Host Tournament",
                      href: `/tournaments/create?clubId=${club.id}`,
                      icon: Plus,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {typedTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}?clubId=${club.id}`}
                >
                  <Card className="transition-colors hover:border-primary/40">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold transition-colors hover:text-primary">
                          {t.name}
                        </CardTitle>
                        <Badge variant="outline">
                          {formatStatus(t.status)}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {formatTournamentFormat(t.tournament_format)} format,{" "}
                        {t.match_format ?? "T20"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                      {t.venue && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span>{t.venue}</span>
                        </div>
                      )}
                      {(t.start_date || t.end_date) && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>
                            {t.start_date ?? "TBD"}
                            {t.end_date ? ` to ${t.end_date}` : ""}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 3: CLUB MATCHES */}
        <TabsContent value="matches" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Club Matches</h2>
              <p className="text-xs text-muted-foreground">
                Live scores, schedules, and past results for matches hosted by
                this club.
              </p>
            </div>
            {isAdmin && (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/matches/create?clubId=${club.id}`}>
                  <Plus className="h-4 w-4" />
                  Schedule Match
                </Link>
              </Button>
            )}
          </div>

          {typedMatches.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Matches Scheduled"
              description="Schedule club matches to start tracking live scores, wagon wheels, and broadcast overlays."
              primaryAction={
                isAdmin
                  ? {
                      label: "Schedule Match",
                      href: `/matches/create?clubId=${club.id}`,
                      icon: Plus,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {typedMatches.map((m) => {
                const isLive = m.status === "live";
                const isCompleted = m.status === "completed";
                const inn1 = m.innings?.find((i) => i.team_id === m.team1?.id);
                const inn2 = m.innings?.find((i) => i.team_id === m.team2?.id);
                return (
                  <Card
                    key={m.id}
                    className={`transition-colors hover:border-primary/40 ${
                      isLive ? "border-emerald-500/50 bg-emerald-500/5" : ""
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{m.venue ?? "Venue TBD"}</span>
                        <Badge
                          variant={
                            isLive
                              ? "default"
                              : isCompleted
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {isLive && (
                            <Radio className="mr-1 h-3 w-3 animate-pulse text-emerald-400" />
                          )}
                          {formatStatus(m.status)}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {m.team1?.name ?? "Team 1"}
                          </span>
                          {inn1?.total_runs !== undefined &&
                          inn1.total_runs !== null ? (
                            <span className="tabular text-sm font-bold">
                              {inn1.total_runs}/{inn1.total_wickets ?? 0}
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({inn1.total_overs ?? 0} ov)
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">
                            {m.team2?.name ?? "Team 2"}
                          </span>
                          {inn2?.total_runs !== undefined &&
                          inn2.total_runs !== null ? (
                            <span className="tabular text-sm font-bold">
                              {inn2.total_runs}/{inn2.total_wickets ?? 0}
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({inn2.total_overs ?? 0} ov)
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </div>
                      </div>

                      {m.result_description && (
                        <div className="mt-3 rounded-md bg-muted/60 p-2 text-xs font-medium text-primary">
                          {m.result_description}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-7 gap-1 text-xs"
                        >
                          <Link href={`/overlay/${m.id}`} target="_blank">
                            <ExternalLink className="h-3 w-3" />
                            Overlay
                          </Link>
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          asChild
                          className="h-7 text-xs"
                        >
                          <Link href={`/matches/${m.id}?clubId=${club.id}`}>
                            {isLive ? "Match Center" : "View Scorecard"}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: HALL OF FAME */}
        <TabsContent value="hall-of-fame" className="mt-4 space-y-6 sm:mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold sm:text-lg">
                  Club Hall of Fame
                </h2>
                <Badge
                  variant="secondary"
                  className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-500"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Honors & Legends
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Immortalizing the finest players, record holders, and historic
                champions of {club.name}.
              </p>
            </div>
            {isAdmin && (
              <HallOfFameDialog clubId={club.id} members={memberCandidates} />
            )}
          </div>

          {typedHallOfFame.length === 0 ? (
            <Card className="border-dashed border-amber-500/20 bg-amber-500/5">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                <Trophy className="mx-auto mb-3 h-12 w-12 text-amber-500/50" />
                <h3 className="mb-1 text-base font-semibold text-foreground">
                  No legends inducted yet
                </h3>
                <p className="mx-auto mb-4 max-w-sm text-xs">
                  Honor outstanding performers, centurions, and club stalwarts
                  into the permanent Hall of Fame.
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
                const categoryColors: Record<string, string> = {
                  legend: "border-amber-500/30 bg-amber-500/5 text-amber-400",
                  top_scorer:
                    "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
                  top_wicket_taker:
                    "border-sky-500/30 bg-sky-500/5 text-sky-400",
                  champion:
                    "border-purple-500/30 bg-purple-500/5 text-purple-400",
                  record: "border-rose-500/30 bg-rose-500/5 text-rose-400",
                };
                const badgeColor =
                  categoryColors[entry.category] ?? categoryColors.legend;

                return (
                  <Card
                    key={entry.id}
                    className="relative overflow-hidden border-amber-500/20 bg-gradient-to-b from-card to-amber-950/10 shadow-sm transition-all hover:border-amber-500/50"
                  >
                    <div className="pointer-events-none absolute right-3 top-3 text-amber-400 opacity-10">
                      <Trophy className="h-24 w-24" />
                    </div>
                    <CardContent className="relative z-10 flex h-full flex-col justify-between space-y-4 p-5">
                      <div>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium capitalize ${badgeColor}`}
                          >
                            {entry.category.replace(/_/g, " ")}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            {entry.season_or_year && (
                              <span className="font-mono text-[11px] text-muted-foreground">
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
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/20 text-sm font-bold text-amber-400 shadow-inner">
                            {(entry.player?.full_name ?? "L")[0]?.toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-base font-bold leading-tight text-foreground">
                              {entry.player?.full_name ?? "Honored Member"}
                            </h3>
                            <p className="text-xs font-medium text-amber-500">
                              {entry.title}
                            </p>
                          </div>
                        </div>

                        {entry.record_metric && (
                          <div className="mb-3 inline-block rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-amber-300">
                            {entry.record_metric}
                          </div>
                        )}

                        {entry.description && (
                          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                            {entry.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                        <span>Hall of Fame Inductee</span>
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
              <h2 className="text-base font-bold sm:text-lg">
                Club Members & Staff
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
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                            {(m.user?.full_name ?? "U")[0]?.toUpperCase()}
                          </div>
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
    </div>
  );
}
