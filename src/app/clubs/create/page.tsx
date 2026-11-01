"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "~/components/ds/back-link";
import { unstable_rethrow } from "next/navigation";
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
import { createClub } from "../actions";
import { useAuth } from "~/lib/auth";
import { ChevronLeft, Loader2 } from "lucide-react";
import { PageContainer } from "~/components/layout/page";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

export default function CreateClubPage() {
  const { user, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
              Sign in to create a club.
            </p>
            <Button asChild>
              <Link href="/auth/login?redirect=/clubs/create">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      // On success the action redirects to the new club.
      const res = await createClub(fd);
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
    <PageContainer size="form" stack={false}>
        <Button variant="ghost" asChild className="mb-4">
          <BackLink href="/clubs">
            <ChevronLeft className="mr-2 h-4 w-4 shrink-0" /> Back
          </BackLink>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create club</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Club name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="e.g. Riverside Cricket Club"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="short_name">Short name</Label>
                <Input
                  id="short_name"
                  name="short_name"
                  placeholder="e.g. RCC"
                  className="mt-2"
                  maxLength={10}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g. Mumbai"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="club-type">Club type</Label>
                <Select name="club_type" defaultValue="community">
                  <SelectTrigger id="club-type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community">Community club</SelectItem>
                    <SelectItem value="corporate">Corporate club</SelectItem>
                    <SelectItem value="school">
                      School / college academy
                    </SelectItem>
                    <SelectItem value="professional">
                      Professional league club
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="About the club"
                  className="mt-2"
                  rows={3}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}

              <Button type="submit" disabled={saving} className="h-11 min-h-[44px] w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                    Creating club…
                  </>
                ) : (
                  "Create club"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
    </PageContainer>
  );
}
