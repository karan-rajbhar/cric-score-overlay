import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { EmptyState } from "~/components/ui/empty-state";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
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
  }>;
}) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    notFound();
  }
  const resolvedSearchParams = await searchParams;
  const { teamId, tournamentId, matchId } = resolvedSearchParams ?? {};

  const supabase = await createServerClient();

  const [{ data: user }, { data: stats }] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, avatar_url, email")
      .eq("id", id)
      .single(),
    supabase.from("player_career_stats").select("*").eq("user_id", id).single(),
  ]);

  if (!user) notFound();

  // Contextual navigation resolution
  let teamInfo: { id: string; name: string } | null = null;
  if (
    teamId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      teamId,
    )
  ) {
    const { data: t } = await supabase
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
    const { data: tr } = await supabase
      .from("tournaments")
      .select("id, name")
      .eq("id", tournamentId)
      .single();
    if (tr) tournamentInfo = tr;
  }

  let backHref = "/players";
  let backLabel = "Back to Players";
  if (teamInfo) {
    backHref = `/teams/${teamInfo.id}`;
    backLabel = `Back to ${teamInfo.name}`;
  } else if (tournamentInfo) {
    backHref = `/tournaments/${tournamentInfo.id}?tab=analysis`;
    backLabel = `Back to ${tournamentInfo.name}`;
  } else if (matchId) {
    backHref = `/matches/${matchId}`;
    backLabel = "Back to Match";
  }

  // Recent performances (last 5 innings appearances)
  const { data: recentBatting } = await supabase
    .from("batting_performances")
    .select("runs_scored, balls_faced, is_out, match_id, innings_id")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2.5">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {teamInfo ? (
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
          className="interactive-button w-fit pl-0"
        >
          <Link href={backHref}>
            <ChevronLeft className="mr-1.5 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
          {user.full_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">{user.email ?? "—"}</p>
        </div>
      </div>

      {!stats ? (
        <EmptyState
          icon={BarChart3}
          title="No Career Stats Yet"
          description="Match statistics, runs, wickets, and milestones will automatically appear here as this player participates in matches."
          primaryAction={{
            label: "Browse Matches",
            href: "/matches",
          }}
          className="mt-8"
        />
      ) : (
        <>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batting</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Stat label="Matches" value={stats.total_matches} />
                <Stat label="Runs" value={stats.total_runs} />
                <Stat label="Avg" value={stats.batting_average ?? "—"} />
                <Stat label="SR" value={stats.strike_rate ?? "—"} />
                <Stat label="50s" value={stats.half_centuries} />
                <Stat label="100s" value={stats.centuries} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bowling</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Stat label="Wkts" value={stats.total_wickets} />
                <Stat label="Avg" value={stats.bowling_average ?? "—"} />
                <Stat label="Econ" value={stats.economy_rate ?? "—"} />
                <Stat label="5w" value={stats.five_wicket_hauls} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fielding</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <Stat label="Catches" value={stats.total_catches} />
                <Stat label="Stumpings" value={stats.total_stumpings} />
                <Stat label="Run outs" value={stats.total_run_outs} />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Recent innings</CardTitle>
            </CardHeader>
            <CardContent>
              {(recentBatting ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent batting data.
                </p>
              ) : (
                <div className="flex gap-2">
                  {recentBatting!.map((r, i) => (
                    <Badge
                      key={i}
                      variant={r.is_out ? "secondary" : "outline"}
                      className="tabular"
                    >
                      {r.runs_scored}
                      {!r.is_out && "*"} ({r.balls_faced})
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
