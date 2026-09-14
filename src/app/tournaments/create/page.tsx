"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { createTournament } from "../actions";
import { useAuth } from "~/lib/auth";
import { createClient } from "~/lib/supabase/client";
import { ChevronLeft, Loader2, Shield } from "lucide-react";

interface ClubOption {
  id: string;
  name: string;
  short_name?: string | null;
}

function CreateTournamentForm() {
  const searchParams = useSearchParams();
  const prefilledClubId = searchParams.get("clubId") ?? "";
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>(prefilledClubId);

  useEffect(() => {
    let cancelled = false;
    const fetchClubs = async () => {
      if (!user) return;
      const supabase = createClient();
      const [ownedClubsRes, memberClubsRes] = await Promise.all([
        supabase
          .from("clubs")
          .select("id, name, short_name")
          .eq("owner_id", user.id)
          .order("name"),
        supabase
          .from("club_memberships")
          .select("club:clubs(id, name, short_name)")
          .eq("user_id", user.id)
          .in("role", ["owner", "admin"])
          .eq("status", "active"),
      ]);

      if (cancelled) return;

      const clubMap = new Map<string, ClubOption>();
      (ownedClubsRes.data ?? []).forEach((c) => {
        clubMap.set(c.id, c);
      });
      (memberClubsRes.data ?? []).forEach((m) => {
        const c = Array.isArray(m.club) ? m.club[0] : m.club;
        if (c) clubMap.set(c.id, c);
      });

      if (prefilledClubId && !clubMap.has(prefilledClubId)) {
        const { data: prefClub } = await supabase
          .from("clubs")
          .select("id, name, short_name")
          .eq("id", prefilledClubId)
          .single();
        if (prefClub) clubMap.set(prefClub.id, prefClub);
      }

      const available = Array.from(clubMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      setClubs(available);
      if (prefilledClubId) {
        setSelectedClubId(prefilledClubId);
      }
    };

    void fetchClubs();
    return () => {
      cancelled = true;
    };
  }, [user, prefilledClubId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await createTournament(fd);
    if (res?.error) {
      setError(res.error);
      setSaving(false);
    }
    // on success, server action redirects
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create tournament</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="club_id" value={selectedClubId} />

          {clubs.length > 0 && (
            <div>
              <Label htmlFor="club_id">Hosting Club (Optional)</Label>
              <Select
                value={selectedClubId || "none"}
                onValueChange={(val) =>
                  setSelectedClubId(val === "none" ? "" : val)
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select club (or none for independent)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    None (Independent Tournament)
                  </SelectItem>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {c.name} {c.short_name ? `(${c.short_name})` : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="name">Tournament name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="e.g., Summer Cup 2026"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="About the tournament"
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tournament format</Label>
              <Select name="tournament_format" defaultValue="league">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="league">League</SelectItem>
                  <SelectItem value="knockout">Knockout</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Match format</Label>
              <Select name="match_format" defaultValue="T20">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T20">T20 (20 ov)</SelectItem>
                  <SelectItem value="ODI">ODI (50 ov)</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="venue">Venue</Label>
            <Input
              id="venue"
              name="venue"
              placeholder="e.g., Lord's Cricket Ground"
              className="mt-2"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating tournament...
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

function CreateTournamentBackButton() {
  const searchParams = useSearchParams();
  const clubId = searchParams.get("clubId");

  const backHref = clubId ? `/clubs/${clubId}?tab=tournaments` : "/tournaments";
  const backLabel = clubId ? "Back to club" : "Back to tournaments";

  return (
    <Button variant="ghost" asChild className="mb-4">
      <Link href={backHref}>
        <ChevronLeft className="mr-2 h-4 w-4" /> {backLabel}
      </Link>
    </Button>
  );
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
            <h2 className="mb-2 text-lg font-semibold">Sign in required</h2>
            <p className="mb-4">Sign in to create a tournament</p>
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
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <Suspense fallback={null}>
          <CreateTournamentBackButton />
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
      </div>
    </div>
  );
}
