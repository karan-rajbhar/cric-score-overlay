import Link from "next/link";
import { cn } from "~/lib/utils";

/**
 * A player's name, opening their profile when there is one: plain text
 * without an `href`, so a name that cannot be linked reads the same. Not
 * prefetched: a scorecard lists every player and fetched each page again and
 * again while open (1,638 fetches in a match day, 18 of them real visits).
 */
export function PlayerLink({
  name,
  href,
  className,
}: {
  name: string;
  href?: string;
  className?: string;
}) {
  if (!href) return <>{name}</>;
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {name}
    </Link>
  );
}
