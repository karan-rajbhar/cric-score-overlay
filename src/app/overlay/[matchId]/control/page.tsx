import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { canProduceOverlay } from "~/lib/firebase/permissions";
import { createServerClient } from "~/lib/firebase/server";
import { getMatch, getLiveMatchState } from "~/app/matches/queries";
import { DEMO_MATCH_STATE, DEMO_MATCH_DETAILS } from "../demo-data";
import { ControlClient } from "./control-client";
import type { LiveMatchState } from "~/components/overlay/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control room",
  robots: { index: false, follow: false },
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <CardTitle className="mt-2 text-xl font-semibold [text-wrap:balance]">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}

/** The score and match, and the server's clock when they were read. */
async function loadControlRoom(matchId: string) {
  const [liveResult, matchResult] = await Promise.all([
    getLiveMatchState(matchId, { skipCache: true }),
    getMatch(matchId),
  ]);
  return { liveResult, matchResult, serverNow: Date.now() };
}

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
      <Notice title="Match not found">
        <p className="text-sm text-muted-foreground">
          This control room link does not match a CricScore match.
        </p>
        <Button asChild className="w-full">
          <Link href="/matches">Browse matches</Link>
        </Button>
      </Notice>
    );
  }

  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return (
      <Notice title="Sign in to run the graphics">
        <p className="text-sm text-muted-foreground">
          The control room is for this match&apos;s scorers, organisers and
          streamers.
        </p>
        <Button asChild className="w-full">
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(`/overlay/${matchId}/control`)}`}
          >
            Sign in
          </Link>
        </Button>
      </Notice>
    );
  }

  // Its admins and its streamers (who run the graphics but cannot score).
  if (!(await canProduceOverlay(db, matchId, user.id))) {
    return (
      <Notice title="Only for this match's scorers and streamers">
        <p className="text-sm text-muted-foreground">
          The match creator, its scorers and streamers, and club or tournament
          organisers can run its graphics. Anyone can add the overlay to a
          stream.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="flex-1">
            <Link href={`/matches/${matchId}`}>View match</Link>
          </Button>
          <Button asChild className="flex-1">
            <Link href={`/matches/${matchId}/stream`}>Stream setup</Link>
          </Button>
        </div>
      </Notice>
    );
  }

  const { liveResult, matchResult, serverNow } = await loadControlRoom(matchId);

  return (
    <ControlClient
      matchId={matchId}
      initialState={(liveResult.data as LiveMatchState | null) ?? null}
      initialMatch={matchResult.data}
      serverNow={serverNow}
    />
  );
}
