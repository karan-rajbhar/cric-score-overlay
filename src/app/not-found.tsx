import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="mb-2 text-sm font-medium text-muted-foreground tabular-nums">
        404
      </p>

      <h1 className="mb-3 text-balance text-2xl font-semibold tracking-tight text-foreground">
        Page not found
      </h1>

      <p className="mb-8 max-w-md text-sm leading-relaxed text-muted-foreground">
        The match, team, tournament or club you are looking for may have been
        moved or deleted.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/matches">Matches</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/search">Search</Link>
        </Button>
      </div>
    </div>
  );
}
