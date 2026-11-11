"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription } from "~/components/ui/card";
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "~/components/ds/field";
import { ScreenBar } from "~/components/ds/screen";
import { useFieldErrors } from "~/lib/hooks/useFieldErrors";
import { createTeam } from "../actions";
import { useAuth } from "~/lib/auth";
import { useUserManagedClubsQuery } from "~/lib/hooks/useMatchQueries";
import { ChevronDown, Loader2, Users, Shield } from "lucide-react";
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
  const { errors, show, clear } = useFieldErrors<"name" | "short_name" | "colours">();
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
    const form = e.currentTarget;
    const fd = new FormData(form);
    const found: Partial<Record<"name" | "colours", string>> = {};
    if (!String(fd.get("name") ?? "").trim()) found.name = "Enter the team's name.";
    if ([primary, secondary].some((c) => c.trim() !== "" && !isTeamColor(c))) {
      found.colours = "Team colours must look like #1a2b3c.";
      setColoursOpen(true);
    }
    if (Object.keys(found).length > 0) {
      show(form, found);
      return;
    }
    show(form, {});
    setSaving(true);
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
        const message = res.error;
        show(
          form,
          /short name/i.test(message)
            ? { short_name: message }
            : /name/i.test(message)
              ? { name: message }
              : /colou?r/i.test(message)
                ? { colours: message }
                : { form: message },
        );
        setSaving(false);
      }
    } catch (err) {
      unstable_rethrow(err);
      show(form, { form: NETWORK_ERROR_MESSAGE });
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Name the side and, if it plays for a club you run, link the club.
          You add players next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <Field label="Team name" error={errors.name}>
            {(p) => (
              <Input
                {...p}
                name="name"
                maxLength={60}
                placeholder="e.g. Hilltop Hawks"
                onChange={() => clear("name")}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Short name"
              optional
              error={errors.short_name}
              hint="Shown on the scoreboard. Up to 5 letters."
            >
              {(p) => (
                <Input
                  {...p}
                  name="short_name"
                  placeholder="e.g. HAW"
                  value={shortName}
                  onChange={(e) => {
                    setShortName(e.target.value.toUpperCase());
                    clear("short_name");
                  }}
                  maxLength={5}
                  autoCapitalize="characters"
                />
              )}
            </Field>

            <Field
              label="Team type"
              hint="A label on the team page. It changes nothing else."
            >
              {(p) => (
                <Select name="team_type" defaultValue="club">
                  <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="club">Club team</SelectItem>
                    <SelectItem value="tournament">Tournament squad</SelectItem>
                    <SelectItem value="match">Match-only team</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          <Field label="Club" optional>
            {(p) => (
              <Select
                value={selectedClubId || "none"}
                onValueChange={(val) =>
                  setSelectedClubId(val === "none" ? "" : val)
                }
              >
                <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
                  <SelectValue placeholder="No club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No club</SelectItem>
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
            )}
          </Field>

          <Field label="About the team" optional>
            {(p) => (
              <Textarea
                {...p}
                name="description"
                placeholder="Home ground, history or a short bio"
                rows={3}
              />
            )}
          </Field>

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
                  Team colours
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (optional)
                  </span>
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
              {errors.colours && (
                <p
                  role="alert"
                  tabIndex={-1}
                  className="mb-2 text-xs font-medium text-destructive"
                >
                  {errors.colours}
                </p>
              )}
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

          {errors.form && (
            <div
              role="alert"
              tabIndex={-1}
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.form}
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

/** The round Back of every screen, and the page's heading (F3, F6). */
function CreateTeamBar() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");
  const tournamentId = searchParams.get("tournamentId");
  const backHref = tournamentId
    ? `/tournaments/${tournamentId}?tab=teams`
    : clubId
      ? `/clubs/${clubId}?tab=teams`
      : "/teams";
  return <ScreenBar className="mb-4" backHref={backHref} title="New team" />;
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
          <CreateTeamBar />
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
