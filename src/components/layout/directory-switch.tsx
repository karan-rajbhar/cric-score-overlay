import Link from "next/link";
import { segmentedItem, segmentedTrack } from "~/components/ui/segmented";
import { cn } from "~/lib/utils";

/** Navigation on phones: a full 44px to tap. */
const TAP_TARGET = "min-h-11 sm:min-h-9";

const PLACES = [
  { href: "/clubs", label: "Clubs" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
] as const;

/**
 * The Clubs tab holds three lists, one tap from each other. Phones only:
 * from tablets up the sidebar lists them.
 */
export function DirectorySwitch({
  current,
}: {
  current: (typeof PLACES)[number]["href"];
}) {
  return (
    <nav
      aria-label="Clubs, teams and players"
      className={cn(segmentedTrack, "flex w-full md:hidden")}
    >
      {PLACES.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === current ? "page" : undefined}
          className={segmentedItem(href === current, TAP_TARGET)}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** My clubs / All clubs, the same switch on each list that has both. */
export function MineAllSwitch({
  label,
  mine,
  all,
  view,
}: {
  label: string;
  mine: { label: string; href: string };
  all: { label: string; href: string };
  view: "mine" | "all";
}) {
  return (
    <nav aria-label={label} className={segmentedTrack}>
      <Link
        href={mine.href}
        aria-current={view === "mine" ? "page" : undefined}
        className={segmentedItem(view === "mine", TAP_TARGET)}
      >
        {mine.label}
      </Link>
      <Link
        href={all.href}
        aria-current={view === "all" ? "page" : undefined}
        className={segmentedItem(view === "all", TAP_TARGET)}
      >
        {all.label}
      </Link>
    </nav>
  );
}
