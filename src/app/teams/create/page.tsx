"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { ChevronLeft, Loader2, Users, Shield } from "lucide-react";


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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (selectedClubId && selectedClubId !== "none") {
      fd.set("club_id", selectedClubId);
    } else {
      fd.delete("club_id");
    }

    const res = await createTeam(fd);
    if (res?.error) {
      setError(res.error);
      setSaving(false);
    }
    // on success, server action redirects to /teams/[id]
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          <span className="text-xs font-semibold text-primary">
            Team registration
          </span>
        </div>
        <CardTitle className="text-xl">Create New Team</CardTitle>
        <CardDescription>
          Form a new squad, assign team identity, and optionally link with a
          registered club.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Team Name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g., Royal Challengers"
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <Label htmlFor="short_name">Short Name / Code</Label>
              <Input
                id="short_name"
                name="short_name"
                placeholder="e.g., RCB"
                maxLength={6}
                className="mt-2 uppercase"
              />
            </div>

            <div>
              <Label htmlFor="team_type">Team Type</Label>
              <Select name="team_type" defaultValue="club">
                <SelectTrigger id="team_type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="club">Club Team</SelectItem>
                  <SelectItem value="tournament">Tournament Squad</SelectItem>
                  <SelectItem value="match">Match-only Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="club_select">Affiliated Club (Optional)</Label>
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
                  Independent (No club affiliation)
                </SelectItem>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
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
            <Label htmlFor="description">About the Team</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Home ground, history, or team bio..."
              className="mt-2"
              rows={3}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={saving} className="h-11 min-h-[44px] w-full text-sm font-bold">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating team...
              </>
            ) : (
              "Create Team & Roster"
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
    ? "Back to Tournament"
    : clubId
      ? "Back to Club"
      : "Back to Teams";

  return (
    <Button variant="ghost" asChild className="mb-4">
      <Link href={backHref}>
        <ChevronLeft className="mr-2 h-4 w-4" /> {backLabel}
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
            <h2 className="mb-1 text-lg font-semibold">Sign In Required</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              You must be signed in to create and manage teams.
            </p>
            <Button asChild>
              <Link href="/auth/login?redirect=/teams/create">Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8">
      <div className="container mx-auto max-w-xl px-3 sm:px-4">
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
      </div>
    </div>
  );
}
