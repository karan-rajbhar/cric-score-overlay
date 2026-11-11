"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { AlertCircle } from "lucide-react";
import { reportClientError } from "~/lib/report-error";
import { BackLink } from "~/components/ds/back-link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application runtime error:", error);
    reportClientError({
      kind: "boundary",
      message: error.message || "Unknown render error",
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <AlertCircle className="mb-4 h-8 w-8 text-destructive" aria-hidden="true" />

      <h1 className="mb-2 text-balance text-2xl font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>

      {/* Never the error's own text: in production it is Next.js's
          paragraph about Server Components, and it means nothing here (N7).
          The message goes to the server log above. */}
      <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        This page could not be shown. Try again, or go back to where you
        were.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <BackLink href="/">Back</BackLink>
        </Button>
        <Button asChild variant="ghost">
          {/* "/": a signed-out visitor is not sent to the sign-in wall, and
              a signed-in one goes on to Home from there (N20). */}
          <Link href="/">Home</Link>
        </Button>
      </div>

      {error.digest && (
        <p className="mt-6 text-xs text-muted-foreground">
          Error code {error.digest}
        </p>
      )}
    </div>
  );
}
