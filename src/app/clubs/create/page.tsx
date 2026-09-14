"use client";

import { useState } from "react";
import Link from "next/link";
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
            <p className="mb-4 text-sm text-muted-foreground">
              Sign in to create a club
            </p>
            <Button asChild>
              <Link href="/auth/login">Sign in</Link>
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
    const res = await createClub(fd);
    if (res?.error) {
      setError(res.error);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/clubs">
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to clubs
          </Link>
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
                  placeholder="e.g., Riverside Cricket Club"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="short_name">Short name</Label>
                <Input
                  id="short_name"
                  name="short_name"
                  placeholder="e.g., RCC"
                  className="mt-2"
                  maxLength={10}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g., Mumbai"
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Club type</Label>
                <Select name="club_type" defaultValue="community">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community">Community Club</SelectItem>
                    <SelectItem value="corporate">Corporate Club</SelectItem>
                    <SelectItem value="school">
                      School / College Academy
                    </SelectItem>
                    <SelectItem value="professional">
                      Professional League Club
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
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  "Create club"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
