"use client";

import { useState } from "react";
import { SignInRequired } from "~/components/ui/sign-in-required";
import { unstable_rethrow } from "next/navigation";
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
import { createClub } from "../actions";
import { useAuth } from "~/lib/auth";
import { Loader2 } from "lucide-react";
import { PageContainer } from "~/components/layout/page";
import { NETWORK_ERROR_MESSAGE } from "~/lib/network-error";

export default function CreateClubPage() {
  const { user, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const { errors, show, clear } = useFieldErrors<"name" | "short_name">();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <SignInRequired
        title="Sign in to create a club"
        allows="A club keeps its teams, members, matches and statistics together."
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!String(fd.get("name") ?? "").trim()) {
      show(form, { name: "Enter the club's name." });
      return;
    }
    show(form, {});
    setSaving(true);
    try {
      // On success the action redirects to the new club.
      const res = await createClub(fd);
      if (res?.error) {
        const message = res.error;
        show(
          form,
          /short name/i.test(message)
            ? { short_name: message }
            : /name/i.test(message)
              ? { name: message }
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
    <PageContainer size="form" stack={false}>
      {/* The round Back of every screen, and the page's heading (F3, F6). */}
      <ScreenBar className="mb-4" backHref="/clubs" title="New club" />

      <Card>
        <CardContent className="pt-6">
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <Field label="Club name" error={errors.name}>
              {(p) => (
                <Input
                  {...p}
                  name="name"
                  placeholder="e.g. Riverside Cricket Club"
                  onChange={() => clear("name")}
                />
              )}
            </Field>
            <Field
              label="Short name"
              optional
              error={errors.short_name}
              hint="Shown where the full name does not fit. Up to 10 letters."
            >
              {(p) => (
                <Input
                  {...p}
                  name="short_name"
                  placeholder="e.g. RCC"
                  maxLength={10}
                  onChange={() => clear("short_name")}
                />
              )}
            </Field>
            <Field label="Location" optional>
              {(p) => <Input {...p} name="location" placeholder="e.g. Mumbai" />}
            </Field>
            <Field label="Club type">
              {(p) => (
                <Select name="club_type" defaultValue="community">
                  <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="community">Community club</SelectItem>
                    <SelectItem value="corporate">Corporate club</SelectItem>
                    <SelectItem value="school">School / college academy</SelectItem>
                    <SelectItem value="professional">
                      Professional league club
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Description" optional>
              {(p) => (
                <Textarea
                  {...p}
                  name="description"
                  placeholder="About the club"
                  rows={3}
                />
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
