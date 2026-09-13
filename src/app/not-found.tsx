import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Compass, Home, Search, Trophy } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[65vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
        <Compass className="h-8 w-8 animate-spin-slow" />
      </div>

      <span className="mb-3 rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        404 · Clean Bowled
      </span>

      <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        Match or Page Not Found
      </h1>

      <p className="mb-8 max-w-md text-sm leading-relaxed text-muted-foreground">
        The match, team, tournament, or club you are looking for might have been
        moved, concluded, or doesn&apos;t exist on this pitch.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="default" className="interactive-button gap-2">
          <Link href="/dashboard">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="default"
          className="interactive-button gap-2"
        >
          <Link href="/matches">
            <Trophy className="h-4 w-4" />
            Browse Matches
          </Link>
        </Button>
        <Button
          asChild
          variant="secondary"
          size="default"
          className="interactive-button gap-2"
        >
          <Link href="/search">
            <Search className="h-4 w-4" />
            Search
          </Link>
        </Button>
      </div>
    </div>
  );
}
