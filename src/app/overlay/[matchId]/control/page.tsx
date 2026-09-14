import { createServerClient } from "~/lib/supabase/server";
import { getMatch } from "~/app/matches/queries";
import { DEMO_MATCH_STATE, DEMO_MATCH_DETAILS } from "../demo-data";
import { ControlClient } from "./control-client";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OverlayControlPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  if (matchId === "test") {
    return (
      <ControlClient
        matchId={matchId}
        initialState={DEMO_MATCH_STATE}
        initialMatch={DEMO_MATCH_DETAILS}
      />
    );
  }

  if (!UUID_REGEX.test(matchId)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">
              Invalid Match
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The specified match could not be found.
            </p>
            <Button asChild className="w-full">
              <Link href="/matches">Browse Matches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">
              Authentication Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You must be signed in as a match administrator to access the
              broadcast control room.
            </p>
            <Button asChild className="w-full">
              <Link href={`/login?redirect=/overlay/${matchId}/control`}>
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: isAdmin } = await supabase.rpc("is_match_admin", {
    p_match_id: matchId,
    p_user_id: user.id,
  });

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You do not have administrative permissions to control broadcast
              graphics for this match. Only match creators, designated match
              admins, or club officials have control access.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild className="flex-1">
                <Link href={`/matches/${matchId}`}>View Match</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href={`/overlay/${matchId}`} target="_blank">
                  View Overlay
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [liveResult, matchResult] = await Promise.all([
    supabase
      .from("live_match_state")
      .select("*")
      .eq("match_id", matchId)
      .single(),
    getMatch(matchId),
  ]);

  return (
    <ControlClient
      matchId={matchId}
      initialState={liveResult.data}
      initialMatch={matchResult.data}
    />
  );
}
