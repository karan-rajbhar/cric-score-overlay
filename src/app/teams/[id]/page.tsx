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
} from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";
import { getTeam } from "../actions";
import { createServerClient } from "~/lib/supabase/server";
import { PlayerList } from "~/components/teams/player-list";
import { AddPlayerDialog } from "~/components/teams/add-player-dialog";
import { TeamLogoEditor } from "~/components/teams/team-logo-editor";
import { TeamLogo } from "~/components/teams/team-logo";
import { TeamSquadShare } from "~/components/teams/team-squad-share";

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

  // Only captain/creator can edit the crest.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEditLogo =
    !!user && (team?.captain_id === user.id || team?.created_by === user.id);

  // Contextual navigation resolution
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
  let clubInfo: { id: string; name: string } | null = null;
  if (
    targetClubId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      targetClubId,
    )
  ) {
    const { data: c } = await supabase
      .from("clubs")
      .select("id, name")
      .eq("id", targetClubId)
      .single();
    if (c) clubInfo = c;
  }

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

  return (
    <div className="container mx-auto px-4 py-8">
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
            {backLabel}
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
                <Button variant="outline" size="icon" title="Edit Team">
                  <Edit className="h-4 w-4" />
                </Button>
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
                  <Badge variant="secondary" className="capitalize">
                    {team.team_type}
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
        </div>

        {/* Main Content - Squad */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Squad</h2>
            <div className="flex items-center gap-2">
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
              <AddPlayerDialog teamId={team.id} />
            </div>
          </div>

          <PlayerList teamId={team.id} players={players} allowEdit={true} />
        </div>
      </div>
    </div>
  );
}
