"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { unstable_rethrow, useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
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
import { createTournament } from "../actions";
import { useAuth } from "~/lib/auth";
import { useUserManagedClubsQuery } from "~/lib/hooks/useMatchQueries";
import { Loader2, Shield } from "lucide-react";
import { PageContainer } from "~/components/layout/page";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";
import {
  FORMAT_PRESETS,
  formatForOvers,
  LIMITS,
} from "~/app/matches/create/match-setup";
import type { MatchFormat } from "~/app/matches/types";

function CreateTournamentForm() {
  const searchParams = useSearchParams();
  const prefilledClubId = searchParams.get("clubId") ?? "";
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const { errors, show, clear } = useFieldErrors<
    "name" | "overs" | "end_date"
  >();
  const { data: clubsData } = useUserManagedClubsQuery(
    user?.id,
    prefilledClubId,
  );
  const clubs = clubsData ?? [];
  const [selectedClubId, setSelectedClubId] = useState<string>(prefilledClubId);
  const [matchFormat, setMatchFormat] = useState<MatchFormat>("T20");
  const [overs, setOvers] = useState("20");

  const pickFormat = (format: MatchFormat) => {
    setMatchFormat(format);
    const preset = FORMAT_PRESETS.find((p) => p.format === format);
    if (preset?.overs) setOvers(String(preset.overs));
    clear("overs");
  };

  const changeOvers = (value: string) => {
    setOvers(value);
    clear("overs");
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) setMatchFormat(formatForOvers(n));
  };

  /** Each mistake on its own field; none: null. */
  const check = (fd: FormData) => {
    const found: Partial<Record<"name" | "overs" | "end_date", string>> = {};
    if (!String(fd.get("name") ?? "").trim()) {
      found.name = "Enter the tournament's name.";
    }
    const n = Number(overs);
    if (
      !(Number.isInteger(n) && n >= LIMITS.overs.min && n <= LIMITS.overs.max)
    ) {
      found.overs = `Enter a number from ${LIMITS.overs.min} to ${LIMITS.overs.max}.`;
    }
    const start = String(fd.get("start_date") ?? "");
    const end = String(fd.get("end_date") ?? "");
    if (start && end && end < start) {
      found.end_date = "The end date is before the start date.";
    }
    return found;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const found = check(fd);
    if (Object.keys(found).length > 0) {
      show(form, found);
      return;
    }
    show(form, {});
    setSaving(true);
    try {
      // On success the action redirects to the new tournament.
      const res = await createTournament(fd);
      if (res?.error) {
        // The server's words, on the field they are about when there is one.
        const message = res.error;
        show(
          form,
          /end date/i.test(message)
            ? { end_date: message }
            : /name/i.test(message)
              ? { name: message }
              : /overs/i.test(message)
                ? { overs: message }
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
      <CardContent className="pt-6">
        <form noValidate onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="club_id" value={selectedClubId} />

          {clubs.length > 0 && (
            <Field label="Hosting club" optional>
              {(p) => (
                <Select
                  value={selectedClubId || "none"}
                  onValueChange={(val) =>
                    setSelectedClubId(val === "none" ? "" : val)
                  }
                >
                  <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
                    <SelectValue placeholder="None (independent tournament)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      None (independent tournament)
                    </SelectItem>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span>
                            {c.name} {c.short_name ? `(${c.short_name})` : ""}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          )}

          <Field label="Tournament name" error={errors.name}>
            {(p) => (
              <Input
                {...p}
                name="name"
                placeholder="e.g. Summer Cup 2026"
                onChange={() => clear("name")}
              />
            )}
          </Field>

          <Field label="Description" optional>
            {(p) => (
              <Textarea
                {...p}
                name="description"
                placeholder="About the tournament"
                rows={3}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tournament format">
              {(p) => (
                <Select name="tournament_format" defaultValue="league">
                  <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="league">League (round robin)</SelectItem>
                    <SelectItem value="knockout">Knockout</SelectItem>
                    <SelectItem value="mixed">Mixed / groups</SelectItem>
                    <SelectItem value="round_robin">Double round robin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Match format">
              {(p) => (
                <Select
                  name="match_format"
                  value={matchFormat}
                  onValueChange={(v) => pickFormat(v as MatchFormat)}
                >
                  <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAT_PRESETS.map((f) => (
                      <SelectItem key={f.format} value={f.format}>
                        {f.overs ? `${f.label} (${f.overs} overs)` : f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          <Field
            label="Overs per side"
            error={errors.overs}
            hint="New matches in the tournament start with these overs."
          >
            {(p) => (
              <Input
                {...p}
                name="overs_per_innings"
                type="number"
                inputMode="numeric"
                min={LIMITS.overs.min}
                max={LIMITS.overs.max}
                value={overs}
                onChange={(e) => changeOvers(e.target.value)}
                className="w-28 tabular-nums"
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" optional>
              {(p) => (
                <Input
                  {...p}
                  name="start_date"
                  type="date"
                  onChange={() => clear("end_date")}
                />
              )}
            </Field>
            <Field label="End date" optional error={errors.end_date}>
              {(p) => (
                <Input
                  {...p}
                  name="end_date"
                  type="date"
                  onChange={() => clear("end_date")}
                />
              )}
            </Field>
          </div>

          <Field label="Venue" optional>
            {(p) => (
              <Input {...p} name="venue" placeholder="e.g. Riverside ground" />
            )}
          </Field>

          {errors.form && (
            <div
              role="alert"
              tabIndex={-1}
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.form}
            </div>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="h-11 min-h-[44px] w-full"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                Creating tournament…
              </>
            ) : (
              "Create tournament"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** The round Back of every screen, and the page's one heading (F3, F6). */
function CreateTournamentBar() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");
  const backHref = clubId ? `/clubs/${clubId}?tab=tournaments` : "/tournaments";
  return <ScreenBar className="mb-4" backHref={backHref} title="New tournament" />;
}

export default function CreateTournamentPage() {
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
            <h1 className="mb-2 text-lg font-semibold">Sign in required</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              Sign in to create a tournament.
            </p>
            <Button asChild>
              <Link href="/auth/login?redirect=/tournaments/create">
                Sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageContainer size="form" stack={false}>
        <Suspense fallback={null}>
          <CreateTournamentBar />
        </Suspense>

        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          }
        >
          <CreateTournamentForm />
        </Suspense>
    </PageContainer>
  );
}
