"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application runtime error:", error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive shadow-sm">
        <AlertCircle className="h-8 w-8" />
      </div>

      <span className="mb-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
        Execution Error
      </span>

      <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        Something went wrong on the pitch
      </h1>

      <p className="mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
        {error.message ||
          "An unexpected error occurred while loading this scorecard or competition view. Our scorers have been alerted."}
      </p>

      {error.digest && (
        <p className="mb-6 font-mono text-xs text-muted-foreground/60">
          Digest: {error.digest}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()} className="interactive-button gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Button asChild variant="outline" className="interactive-button gap-2">
          <Link href="/dashboard">
            <Home className="h-4 w-4" />
            Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
