"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useSignInHref } from "~/lib/sign-in";

/**
 * The one gate for a page that needs an account (N31): the empty state's
 * look, the page's h1, what signing in allows, and a Sign in that comes
 * back here.
 */
export function SignInRequired({
  title,
  allows,
}: {
  /** The page's heading: "Sign in to create a club". */
  title: string;
  /** One sentence on what an account lets the person do here. */
  allows: string;
}) {
  const href = useSignInHref();
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md items-center px-4 py-8">
      <div className="flex w-full flex-col items-center rounded-xl bg-card p-8 text-center shadow-soft ring-1 ring-border/40 dark:ring-border">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <LogIn className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mb-1 text-balance text-lg font-semibold text-foreground">
          {title}
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {allows} CricScore is invite-only: sign in with the Google account
          your invite was sent to.
        </p>
        <Button asChild>
          <Link href={href}>Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
