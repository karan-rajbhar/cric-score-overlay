"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { createTeam } from "../actions";
import { useAuth } from "~/lib/auth";
import { useUserManagedClubsQuery } from "~/lib/hooks/useMatchQueries";
import { ChevronDown, ChevronLeft, Loader2, Users, Shield } from "lucide-react";
import { TeamColourPicker } from "~/components/teams/team-colour-picker";
import { isTeamColor } from "~/lib/team-colors";
import { cn } from "~/lib/utils";
import { PageContainer } from "~/components/layout/page";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";


function CreateTeamForm() {
  const searchParams = useSearchParams();
  const prefilledClubId = searchParams.get("clubId") ?? "";
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: clubsData } = useUserManagedClubsQuery(
    user?.id,
    prefilledClubId,
  );
  const clubs = clubsData ?? [];
  const [selectedClubId, setSelectedClubId] = useState<string>(prefilledClubId);
  const [joinSquad, setJoinSquad] = useState(true);
  const [shortName, setShortName] = useState("");
  const [coloursOpen, setColoursOpen] = useState(false);
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if ([primary, secondary].some((c) => c.trim() !== "" && !isTeamColor(c))) {
      setError("Team colours must look like #1a2b3c");
      return;
    }
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("primary_color", primary.trim());
    fd.set("secondary_color", secondary.trim());
    if (selectedClubId && selectedClubId !== "none") {
      fd.set("club_id", selectedClubId);
    } else {
      fd.delete("club_id");
    }
    fd.set("join_squad", joinSquad ? "true" : "false");

    try {
      // On success the action redirects to the new team's page.
      const res = await createTeam(fd);
      if (res?.error) {
        setError(res.error);
        setSaving(false);
      }
    } catch (err) {
      unstable_rethrow(err);
      setError(NETWORK_ERROR_MESSAGE);
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5 shrink-0" />
          <span className="text-xs font-semibold text-primary">
            New team
          </span>
        </div>
        <CardTitle className="text-xl">Create a team</CardTitle>
        <CardDescription>
          Name the side and, if it plays for a club you run, link the club.
          You add players next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Team name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g. Royal Challengers"
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <Label htmlFor="short_name">Short name</Label>
              <Input
                id="short_name"
                name="short_name"
                placeholder="e.g. RCB"
                value={shortName}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
                maxLength={5}
                autoCapitalize="characters"
                aria-describedby="short_name-hint"
                className="mt-2 uppercase"
              />
              <p
                id="short_name-hint"
                className="mt-1 text-xs text-muted-foreground"
              >
                Shown on the scoreboard. Up to 5 letters.
              </p>
            </div>

            <div>
              <Label htmlFor="team_type">Team type</Label>
              <Select name="team_type" defaultValue="club">
                <SelectTrigger
                  id="team_type"
                  aria-describedby="team_type-hint"
                  className="mt-2"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="club">Club team</SelectItem>
                  <SelectItem value="tournament">Tournament squad</SelectItem>
                  <SelectItem value="match">Match-only team</SelectItem>
                </SelectContent>
              </Select>
              <p
                id="team_type-hint"
                className="mt-1 text-xs text-muted-foreground"
              >
                A label on the team page. It changes nothing else.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="club_select">Affiliated club (optional)</Label>
            <Select
              value={selectedClubId || "none"}
              onValueChange={(val) =>
                setSelectedClubId(val === "none" ? "" : val)
              }
            >
              <SelectTrigger id="club_select" className="mt-2">
                <SelectValue placeholder="Independent team (no club)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  Independent (no club affiliation)
                </SelectItem>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>{c.name}</span>
                      {c.short_name && (
                        <span className="text-xs text-muted-foreground">
                          ({c.short_name})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">About the team</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Home ground, history or a short bio"
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setColoursOpen((o) => !o)}
              aria-expanded={coloursOpen}
              aria-controls="team-colours"
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left"
            >
              <span>
                <span className="block text-sm font-medium">
                  Team colours (optional)
                </span>
                <span className="block text-xs text-muted-foreground">
                  Used on scoreboards and overlays.
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  coloursOpen && "rotate-180",
                )}
                aria-hidden="true"
              />
            </button>
            <div id="team-colours" hidden={!coloursOpen} className="border-t p-3">
              <TeamColourPicker
                shortName={shortName}
                primary={primary}
                secondary={secondary}
                onPrimaryChange={setPrimary}
                onSecondaryChange={setSecondary}
              />
            </div>
          </div>

          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={joinSquad}
              onChange={(e) => setJoinSquad(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
            />
            <span>
              <span className="font-medium text-foreground">
                I play for this team
              </span>
              <span className="block text-xs text-muted-foreground">
                You join the squad as captain. Untick it when you set up a side
                for others: you still manage it.
              </span>
            </span>
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={saving} className="h-11 min-h-[44px] w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                Creating team…
              </>
            ) : (
              "Create team"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CreateTeamBackButton() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");
  const tournamentId = searchParams.get("tournamentId");

  const backHref = tournamentId
    ? `/tournaments/${tournamentId}?tab=teams`
    : clubId
      ? `/clubs/${clubId}?tab=teams`
      : "/teams";

  const backLabel = tournamentId
    ? "Back to tournament"
    : clubId
      ? "Back to club"
      : "Back to teams";

  return (
    <Button variant="ghost" asChild className="mb-4">
      <Link href={backHref}>
        <ChevronLeft className="mr-2 h-4 w-4 shrink-0" /> {backLabel}
      </Link>
    </Button>
  );
}

export default function CreateTeamPage() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="mx-4 w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h2 className="mb-1 text-lg font-semibold">Sign in required</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              You must be signed in to create and manage teams.
            </p>
            <Button asChild>
              <Link href="/auth/login?redirect=/teams/create">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageContainer size="form" stack={false}>
        <Suspense fallback={null}>
          <CreateTeamBackButton />
        </Suspense>

        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          }
        >
          <CreateTeamForm />
        </Suspense>
    </PageContainer>
  );
}
