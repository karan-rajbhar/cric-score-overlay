"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { AlertCircle } from "lucide-react";
import { reportClientError } from "~/lib/report-error";

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

      <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        {error.message ||
          "An unexpected error occurred while loading this page."}
      </p>

      {error.digest && (
        <p className="mb-6 font-mono text-xs text-muted-foreground/60">
          Digest: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
